/**
 * A pending MINTER transaction as a "decision": what it does, who it is
 * about, its signatures and its clock. Pure; the data loader feeds it.
 */
import type { TxRow } from '../data/types';
import { MINTER_GROUP_ID } from '../data/constants';
import { tallyApprovals, type ApprovalRow, type Tally } from './tally';
import {
  decisionWindow,
  windowPhase,
  type DecisionWindow,
  type GroupDelays,
  type WindowPhase,
} from './timing';
import type { ApprovalThreshold } from './threshold';

export type DecisionKind =
  'invite' | 'cancelInvite' | 'kick' | 'ban' | 'cancelBan' | 'addAdmin' | 'removeAdmin' | 'other';

export const KIND_BY_TYPE: Record<string, DecisionKind> = {
  GROUP_INVITE: 'invite',
  CANCEL_GROUP_INVITE: 'cancelInvite',
  GROUP_KICK: 'kick',
  GROUP_BAN: 'ban',
  CANCEL_GROUP_BAN: 'cancelBan',
  ADD_GROUP_ADMIN: 'addAdmin',
  REMOVE_GROUP_ADMIN: 'removeAdmin',
};

/** Plain words for each kind, used in titles ("Invite to MINTER"). */
export const KIND_LABEL: Record<DecisionKind, string> = {
  invite: 'Add to MINTER',
  cancelInvite: 'Cancel an approved invite',
  kick: 'Remove from MINTER',
  ban: 'Ban from MINTER',
  cancelBan: 'Lift a ban',
  addAdmin: 'Make a Minter Admin',
  removeAdmin: 'Remove a Minter Admin',
  other: 'Group change',
};

export function decisionKind(tx: Pick<TxRow, 'type'>): DecisionKind {
  return KIND_BY_TYPE[tx.type] ?? 'other';
}

/** The account a transaction is about (null when Core's answer leaves it out). */
export function decisionSubject(tx: TxRow): string | null {
  switch (tx.type) {
    case 'GROUP_INVITE':
    case 'CANCEL_GROUP_INVITE':
      return tx.invitee ?? null;
    case 'GROUP_KICK':
    case 'ADD_GROUP_ADMIN':
    case 'CANCEL_GROUP_BAN':
      return tx.member ?? null;
    case 'GROUP_BAN':
      return tx.offender ?? null;
    case 'REMOVE_GROUP_ADMIN':
      return tx.admin ?? null;
    case 'JOIN_GROUP':
    case 'LEAVE_GROUP':
      return tx.creatorAddress ?? null;
    default:
      return null;
  }
}

/**
 * A MINTER group change: one of the seven group types above, for group 694.
 * Only these are MINTER decisions with a Sign button. CANCEL_GROUP_INVITE
 * rows need their groupId filled in from the raw bytes first (data/txs.ts).
 */
export function isMinterGroupChange(tx: Pick<TxRow, 'type' | 'groupId'>): boolean {
  return tx.type in KIND_BY_TYPE && tx.groupId === MINTER_GROUP_ID;
}

/** Plain words for a group transaction that isn't a MINTER group change. */
const OTHER_GROUP_LABEL: Record<DecisionKind, string> = {
  invite: 'Invite to a group',
  cancelInvite: 'Cancel a group invite',
  kick: 'Remove from a group',
  ban: 'Ban from a group',
  cancelBan: 'Lift a group ban',
  addAdmin: 'Make a group admin',
  removeAdmin: 'Remove a group admin',
  other: 'Transaction',
};

/** "Invite to a group", or Core's type in words ("Register name") for other types. */
export function otherTransactionLabel(tx: Pick<TxRow, 'type'>): string {
  const kind = decisionKind(tx);
  if (kind !== 'other') return OTHER_GROUP_LABEL[kind];
  const words = tx.type.toLowerCase().replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : OTHER_GROUP_LABEL.other;
}

/** A pending transaction waiting for Minter Admins that isn't a MINTER group change (read-only). */
export interface OtherPending {
  signature: string;
  type: string;
  label: string;
  /** The group it changes, when Core's answer says. */
  groupId: number | null;
  creatorAddress: string | null;
  createdAt: number;
  blockHeight: number | null;
}

export function toOtherPending(tx: TxRow): OtherPending {
  return {
    signature: tx.signature,
    type: tx.type,
    label: otherTransactionLabel(tx),
    groupId: typeof tx.groupId === 'number' ? tx.groupId : null,
    creatorAddress: tx.creatorAddress ?? null,
    createdAt: tx.timestamp,
    blockHeight: typeof tx.blockHeight === 'number' ? tx.blockHeight : null,
  };
}

/**
 * Unusual approval route (admins only): a MINTER transaction (groupId 694)
 * whose txGroupId is neither 694 nor 0. Core's own MINTER transactions use
 * txGroupId 694; transactions from before group approval used 0.
 */
export function isUnusualApprovalRoute(tx: Pick<TxRow, 'type' | 'groupId' | 'txGroupId'>): boolean {
  if (!(tx.type in KIND_BY_TYPE)) return false;
  if (tx.groupId !== MINTER_GROUP_ID) return false;
  return tx.txGroupId !== MINTER_GROUP_ID && tx.txGroupId !== 0;
}

export type DecisionPhase = WindowPhase | 'unconfirmed' | 'thresholdMet';

export interface Decision {
  signature: string;
  kind: DecisionKind;
  type: string;
  subject: string | null;
  creatorAddress: string | null;
  createdAt: number;
  /** Null while the transaction is still unconfirmed (no clock yet). */
  blockHeight: number | null;
  reason?: string;
  /** Ban length in seconds; 0 = permanent. */
  banSeconds?: number;
  window: DecisionWindow | null;
  phase: DecisionPhase;
  /** Null for an unusual approval route (see isUnusualApprovalRoute). */
  tally: Tally | null;
  unusualRoute: boolean;
  tx: TxRow;
}

export interface DecisionContext {
  threshold: ApprovalThreshold;
  totalAdmins: number;
  delays: GroupDelays;
  tipHeight: number;
  approvals: ApprovalRow[];
}

export function toApprovalRow(tx: TxRow): ApprovalRow | null {
  if (tx.type !== 'GROUP_APPROVAL' || !tx.pendingSignature || !tx.adminPublicKey) return null;
  return {
    signature: tx.signature,
    pendingSignature: tx.pendingSignature,
    adminPublicKey: tx.adminPublicKey,
    creatorAddress: tx.creatorAddress,
    approval: tx.approval === true,
    timestamp: tx.timestamp,
    blockHeight: typeof tx.blockHeight === 'number' ? tx.blockHeight : null,
  };
}

export function buildDecision(tx: TxRow, ctx: DecisionContext): Decision {
  const unusualRoute = isUnusualApprovalRoute(tx);
  const blockHeight = typeof tx.blockHeight === 'number' ? tx.blockHeight : null;
  const window = blockHeight === null ? null : decisionWindow(blockHeight, ctx.delays);
  const tally = unusualRoute
    ? null
    : tallyApprovals({
        pendingSignature: tx.signature,
        rows: ctx.approvals,
        threshold: ctx.threshold,
        totalAdmins: ctx.totalAdmins,
      });
  let phase: DecisionPhase = window ? windowPhase(window, ctx.tipHeight) : 'unconfirmed';
  if (tally?.met && (phase === 'open' || phase === 'early' || phase === 'tooLate'))
    phase = 'thresholdMet';
  return {
    signature: tx.signature,
    kind: decisionKind(tx),
    type: tx.type,
    subject: decisionSubject(tx),
    creatorAddress: tx.creatorAddress ?? null,
    createdAt: tx.timestamp,
    blockHeight,
    reason: typeof tx.reason === 'string' ? tx.reason : undefined,
    banSeconds: tx.type === 'GROUP_BAN' ? Number(tx.timeToLive ?? 0) : undefined,
    window,
    phase,
    tally,
    unusualRoute,
    tx,
  };
}

const PHASE_ORDER: Record<DecisionPhase, number> = {
  open: 0,
  early: 0,
  thresholdMet: 1,
  unconfirmed: 2,
  tooLate: 3,
  expired: 4,
};

/** Most urgent first: open decisions by expiry, then the rest. */
export function sortDecisions(decisions: Decision[]): Decision[] {
  return [...decisions].sort((a, b) => {
    const phase = PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase];
    if (phase !== 0) return phase;
    const ea = a.window?.expiresAtHeight ?? Number.MAX_SAFE_INTEGER;
    const eb = b.window?.expiresAtHeight ?? Number.MAX_SAFE_INTEGER;
    if (ea !== eb) return ea - eb;
    return a.createdAt - b.createdAt;
  });
}
