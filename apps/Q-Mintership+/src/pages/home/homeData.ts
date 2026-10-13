/**
 * Home's own reads and sums, on top of the shared hooks: the signatures
 * needed right now, the account's confirmed balance, approved invites
 * nobody used, and the admin's and nominator's slices of the decisions and
 * nominations.
 *
 * Every read here uses the same cache key as its data/ loader, so Home
 * shares results with the rest of the app instead of reading twice.
 */
import { useAtomValue } from 'jotai';
import { CUMULATIVE_BLOCKS_BY_LEVEL } from '../../data/constants';
import type { DecisionsData } from '../../data/decisions';
import { getStoredInvites } from '../../data/group';
import type { Nomination } from '../../data/nominations';
import type { TxRow } from '../../data/types';
import { useAdmins, useGroupInfo, useMembers } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import type { Decision } from '../../rules/decision';
import { isOpenState, type NominationState } from '../../rules/nomination';
import { signerState } from '../../rules/tally';
import { approvalsNeeded, thresholdPercent } from '../../rules/threshold';
import { pendingWritesAtom, writeKeys } from '../../writes/optimistic';

export interface NeededSignatures {
  /** Signatures a decision needs now (null until loaded). */
  needed: number | null;
  /** Core's admin count, null owner included: the threshold's denominator. */
  adminSeats: number | null;
  /** Admins who can actually sign. */
  signers: number | null;
  memberCount: number | null;
  /** "40" for PCT40, null for NONE/ONE. */
  percent: number | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Signatures needed now, computed the way Core does from the live threshold
 * and admin count (it moves when admins are added or removed). Whether it
 * moved since Decisions last showed it is the admin's hero's to say
 * (readSeenTarget).
 */
export function useNeededSignatures(): NeededSignatures {
  const group = useGroupInfo();
  const admins = useAdmins();
  const needed =
    group.data && admins.data
      ? approvalsNeeded(group.data.approvalThreshold, admins.data.adminCount)
      : null;
  return {
    needed,
    adminSeats: admins.data?.adminCount ?? null,
    signers: admins.data?.signers.length ?? null,
    memberCount: admins.data?.memberCount || group.data?.memberCount || null,
    percent: group.data ? thresholdPercent(group.data.approvalThreshold) : null,
    isLoading: group.isLoading || admins.isLoading,
    error: group.error ?? admins.error,
    refetch: () => {
      void group.refetch();
      void admins.refetch();
    },
  };
}

/**
 * Approved invites nobody used: stored invites whose invitee is not a
 * member. Reads the stored invites and the member list (already loaded for
 * the nominations an admin's Home shows).
 */
export function useUnusedInvites(enabled: boolean) {
  const invites = useQuery('group:invites', (force) => getStoredInvites({ force }), {
    enabled,
  });
  const members = useMembers(enabled);
  const memberSet = members.data ? new Set(members.data.members.map((m) => m.member)) : null;
  const unused =
    invites.data && memberSet ? invites.data.filter((row) => !memberSet.has(row.invitee)) : null;
  return {
    count: unused?.length ?? null,
    truncated: Boolean(members.data?.truncated),
    isLoading: invites.isLoading || members.isLoading,
    error: invites.error ?? members.error,
    refetch: () => {
      void invites.refetch();
      void members.refetch();
    },
  };
}

export interface AdminSummary {
  /** Decisions still collecting signatures that count (with a tally), doubles left out. */
  open: Decision[];
  /** Of those, the ones this admin hasn't answered (signed or rejected): most urgent first. */
  waiting: Decision[];
  /** Of the open ones, how many this admin has signed (or is confirming). */
  signed: number;
  /** Transactions about MINTER on an unusual approval route. */
  unusual: number;
}

/**
 * The admin's slice of the Decisions data. `sending(sig)` says a signature
 * from this device is already on its way (optimistic), so it doesn't ask
 * again; `rejecting(sig)` the same for a rejection (Reject or Withdraw). A
 * rejection is an answer too: it isn't waiting for this admin any more.
 */
export function adminSummary(
  data: Pick<DecisionsData, 'decisions' | 'unusual'>,
  publicKey: string,
  sending: (signature: string) => boolean = () => false,
  rejecting: (signature: string) => boolean = () => false
): AdminSummary {
  // A double (rules/double.ts) needs no signature: it doesn't count here.
  const open = data.decisions.filter(
    (d) => d.tally !== null && !d.double && (d.phase === 'open' || d.phase === 'early')
  );
  const state = (d: Decision) => (d.tally ? signerState(d.tally, publicKey) : 'none');
  const signed = (d: Decision) => {
    const s = state(d);
    return s === 'signed' || s === 'confirming';
  };
  const answered = (d: Decision) =>
    state(d) !== 'none' || sending(d.signature) || rejecting(d.signature);
  return {
    open,
    waiting: open.filter((d) => !answered(d)),
    signed: open.filter((d) => signed(d) || sending(d.signature)).length,
    unusual: data.unusual.length,
  };
}

function onItsWay(writes: Record<string, { status: string }>, keys: string[]): boolean {
  return keys.some((key) => {
    const w = writes[key];
    return Boolean(w && (w.status === 'sending' || w.status === 'confirming'));
  });
}

/** True while a signature from this device is on its way (optimistic). */
export function useSendingSignature(): (signature: string) => boolean {
  const writes = useAtomValue(pendingWritesAtom);
  return (signature) => onItsWay(writes, [writeKeys.sign(signature)]);
}

/** True while a rejection from this device (Reject, or Withdraw my signature) is on its way. */
export function useSendingRejection(): (signature: string) => boolean {
  const writes = useAtomValue(pendingWritesAtom);
  return (signature) =>
    onItsWay(writes, [writeKeys.reject(signature), writeKeys.withdraw(signature)]);
}

/** True when `address` nominated, supported, or (as an admin) proposed this nomination. */
export function isInvolved(n: Nomination, address: string): boolean {
  if (n.nomination?.publisher.address === address) return true;
  if (n.supporters.some((s) => s.publisher.address === address)) return true;
  return n.source === 'chain' && n.decision?.creatorAddress === address;
}

/** The nominations `address` is part of: open ones first, newest first. */
export function myNominations(all: Nomination[], address: string): Nomination[] {
  return all
    .filter((n) => isInvolved(n, address))
    .sort((a, b) => {
      const open = Number(isOpenState(b.state)) - Number(isOpenState(a.state));
      return open !== 0 ? open : b.publishedAt - a.publishedAt;
    });
}

/** Signatures can no longer change the outcome (enough signatures or rejections already, or too late). */
const SETTLED_PHASES = new Set(['thresholdMet', 'rejectedMet', 'tooLate', 'expired']);

/**
 * Open nominations `address` could add their support to: not theirs, not
 * about them, and still able to use it (not already decided or too late).
 */
export function supportable(open: Nomination[], address: string): Nomination[] {
  return open.filter(
    (n) =>
      (n.state === 'waiting' || n.state === 'signing') &&
      !(n.decision && SETTLED_PHASES.has(n.decision.phase)) &&
      n.nominee !== address &&
      !isInvolved(n, address)
  );
}

/** How many of `list` are in each state, e.g. { waiting: 1, signing: 2 }. */
export function countStates(list: Nomination[]): Partial<Record<NominationState, number>> {
  const counts: Partial<Record<NominationState, number>> = {};
  for (const n of list) counts[n.state] = (counts[n.state] ?? 0) + 1;
  return counts;
}

/** The block the account's newest approved MINTER invite was approved in, if the history has it. */
export function approvedInviteHeight(history: TxRow[], address: string): number | null {
  let best: TxRow | null = null;
  for (const tx of history) {
    if (tx.type !== 'GROUP_INVITE' || tx.invitee !== address) continue;
    if (tx.approvalStatus !== 'APPROVED') continue;
    if (!best || tx.timestamp > best.timestamp) best = tx;
  }
  if (!best) return null;
  if (typeof best.approvalHeight === 'number') return best.approvalHeight;
  return typeof best.blockHeight === 'number' ? best.blockHeight : null;
}

/** How far (0–1) the account is through its current level, by blocks minted. */
export function levelFraction(level: number, blocks: number): number {
  if (level >= CUMULATIVE_BLOCKS_BY_LEVEL.length) return 1;
  const from = level <= 0 ? 0 : CUMULATIVE_BLOCKS_BY_LEVEL[level - 1];
  const to = CUMULATIVE_BLOCKS_BY_LEVEL[level];
  return Math.min(1, Math.max(0, (blocks - from) / Math.max(1, to - from)));
}
