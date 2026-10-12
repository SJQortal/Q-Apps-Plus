/**
 * Nominations: who may nominate, who may be nominated, and where a
 * nomination stands. Pure; data/nominations.ts feeds it.
 *
 * Process (docs/apps/Q-Mintership+.md → The new process):
 * 1. A MINTER member at level 5+, or any Minter Admin, publishes a
 *    nomination record. Further eligible members add support.
 * 2. The nominee accepts by sending JOIN_GROUP (a join request), so approval
 *    makes them a member at once.
 * 3. The first Minter Admin who signs creates the GROUP_INVITE (txGroupId
 *    694) and approves it; the clock starts.
 * 4. Other admins sign, or let it expire.
 * 5. Core approves it at the threshold, or it expires; it can be nominated
 *    again.
 *
 * Before the first admin signature a nomination waits on the open list for
 * at most one approval window (10,080 blocks), then moves to History.
 */
import { NOMINATOR_MIN_LEVEL } from '../data/constants';
import type { TxRow } from '../data/types';

export interface NominatorFacts {
  isMember: boolean;
  isAdmin: boolean;
  level: number;
}

/** A MINTER member at level 5+, or a Minter Admin at any level. */
export function isEligibleNominator(facts: NominatorFacts): boolean {
  return facts.isAdmin || (facts.isMember && facts.level >= NOMINATOR_MIN_LEVEL);
}

/** Why someone can't nominate, in plain words, or null when they can. */
export function nominatorBlock(facts: NominatorFacts & { hasName: boolean }): string | null {
  if (!facts.isAdmin && !facts.isMember)
    return 'Only MINTER members at level 5 or above, and Minter Admins, can nominate.';
  if (!isEligibleNominator(facts)) {
    return `Members can nominate from level ${NOMINATOR_MIN_LEVEL}. You're level ${facts.level}.`;
  }
  if (!facts.hasName) return 'Publishing a nomination needs a registered name on your account.';
  return null;
}

export interface NomineeFacts {
  self: boolean;
  isMember: boolean;
  activeBan: boolean;
  /** An open nomination for them already exists (support it instead). */
  openNomination: boolean;
  /** A GROUP_INVITE for them is waiting for signatures. */
  pendingInvite: boolean;
  /** An approved invite is stored and unused: they only need to join. */
  storedInvite: boolean;
}

export type NomineeBlock = 'self' | 'member' | 'banned' | 'open' | 'pending' | 'stored';

/** Why this person can't be nominated now, or null. `open` means: offer "Add your support". */
export function nomineeBlock(facts: NomineeFacts): NomineeBlock | null {
  if (facts.self) return 'self';
  if (facts.isMember) return 'member';
  if (facts.activeBan) return 'banned';
  if (facts.pendingInvite) return 'pending';
  if (facts.storedInvite) return 'stored';
  if (facts.openNomination) return 'open';
  return null;
}

export const NOMINEE_BLOCK_TEXT: Record<NomineeBlock, string> = {
  self: "You can't nominate yourself. Ask a level 5+ minter to nominate you.",
  member: 'Already in MINTER.',
  banned: 'Banned from MINTER: Minter Admins must lift the ban before a nomination can go ahead.',
  pending: 'Minter Admins are already signing a nomination for this person.',
  stored: 'Already approved: they only need to press Join now.',
  open: 'Already nominated. You can add your support to that nomination instead.',
};

export type NominationState =
  /** Published; no Minter Admin has signed yet. */
  | 'waiting'
  /** A GROUP_INVITE is collecting signatures. */
  | 'signing'
  /** Approved, but the nominee hasn't joined yet (they need to press Join now). */
  | 'approved'
  /** The nominee is in MINTER. */
  | 'joined'
  /** The invite ran out of time. */
  | 'expired'
  /** Admin rejections reached the threshold. */
  | 'rejected'
  /** Waited a full window without an admin signature. */
  | 'lapsed'
  /** The nominee is banned; admins must lift the ban first. */
  | 'blocked';

export const OPEN_STATES: readonly NominationState[] = [
  'waiting',
  'signing',
  'approved',
  'blocked',
];

export function isOpenState(state: NominationState): boolean {
  return OPEN_STATES.includes(state);
}

export interface NominationStateInput {
  /** When the nomination was (re)published, ms (from the QDN row). */
  publishedAt: number;
  nowMs: number;
  msPerBlock: number;
  waitingWindowBlocks: number;
  isMember: boolean;
  activeBan: boolean;
  /** The PENDING GROUP_INVITE for the nominee, if any. */
  pendingInvite: TxRow | null;
  /** The newest decided GROUP_INVITE for the nominee, if any. */
  latestInvite: TxRow | null;
  storedInvite: boolean;
}

/** Allowance for clock differences between the QDN row and the invite. */
const SAME_ROUND_SLACK_MS = 10 * 60_000;

export function nominationState(input: NominationStateInput): NominationState {
  if (input.isMember) return 'joined';
  if (input.pendingInvite) return 'signing';
  const latest = input.latestInvite;
  const sameRound = latest && latest.timestamp >= input.publishedAt - SAME_ROUND_SLACK_MS;
  if (latest && sameRound) {
    if (latest.approvalStatus === 'APPROVED') return input.storedInvite ? 'approved' : 'joined';
    if (latest.approvalStatus === 'EXPIRED') return 'expired';
    if (latest.approvalStatus === 'REJECTED') return 'rejected';
  }
  if (input.storedInvite) return 'approved';
  if (input.activeBan) return 'blocked';
  const ageBlocks = (input.nowMs - input.publishedAt) / input.msPerBlock;
  return ageBlocks <= input.waitingWindowBlocks ? 'waiting' : 'lapsed';
}

/**
 * When a decided invite's round ended (ms): its decision block, estimated
 * from the invite's own block and Core's approvalHeight.
 */
export function decidedAt(
  invite: Pick<TxRow, 'timestamp' | 'blockHeight' | 'approvalHeight'>,
  msPerBlock: number,
  maximumBlockDelay: number
): number {
  const start = invite.blockHeight;
  if (typeof start !== 'number') return invite.timestamp;
  const end =
    typeof invite.approvalHeight === 'number'
      ? invite.approvalHeight
      : start + maximumBlockDelay + 1;
  return invite.timestamp + Math.max(0, end - start) * msPerBlock;
}

/**
 * Which records belong to the nominee's current round. Records published
 * after the last decided invite start a new round (a re-nomination); among
 * those, records that waited a full window without an admin signature have
 * lapsed and give way to newer ones. With no newer records, the round is the
 * one the last invite decided.
 */
export function pickRound<T extends { publishedAt: number }>(
  entries: T[],
  ctx: { decidedEnd: number | null; hasPendingInvite: boolean; nowMs: number; windowMs: number }
): { entries: T[]; fresh: boolean } {
  const sorted = [...entries].sort((a, b) => a.publishedAt - b.publishedAt);
  const end = ctx.decidedEnd ?? Number.NEGATIVE_INFINITY;
  const fresh = sorted.filter((e) => e.publishedAt > end);
  if (ctx.hasPendingInvite) return { entries: fresh.length ? fresh : sorted, fresh: true };
  if (fresh.length) {
    const active = fresh.filter((e) => ctx.nowMs - e.publishedAt <= ctx.windowMs);
    return { entries: active.length ? active : [fresh[fresh.length - 1]], fresh: true };
  }
  return { entries: sorted.filter((e) => e.publishedAt <= end), fresh: false };
}

/** When a waiting nomination drops off the open list (ms). */
export function waitingEndsAt(
  publishedAt: number,
  msPerBlock: number,
  waitingWindowBlocks: number
): number {
  return publishedAt + waitingWindowBlocks * msPerBlock;
}
