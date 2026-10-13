/**
 * Doubles: a waiting admin change that changes nothing if it passes, so
 * there is no need to sign it. Only admin changes, and only these cases:
 *
 * - alreadyInEffect: making someone a Minter Admin who already is one, or
 *   removing someone who isn't one (any more). For an addition, it points to
 *   the approved addition that made them one when the caller already has it
 *   (`approvedAdds`); the rule never asks for more than it is given.
 * - duplicate: the same change about the same person is waiting more than
 *   once. The newer one (by block, then time) is the double of the oldest
 *   one that can still pass.
 *
 * Invites, kicks, bans, their cancellations and lifts are never doubles,
 * nor is anything on an unusual approval route, nor a decision that has
 * expired (or was decided). "Today's admins" are the admin rows the
 * Decisions data already has (the null owner included). Pure; the
 * Decisions loader feeds it.
 *
 * Doubles stay in the queue (after the others), and don't count as waiting
 * for anyone's signature.
 */
import { MINTER_GROUP_ID } from '../data/constants';
import type { TxRow } from '../data/types';
import type { Decision, DecisionPhase } from './decision';

export type DoubleReason = 'alreadyInEffect' | 'duplicate';

export interface DecisionDouble {
  reason: DoubleReason;
  /**
   * alreadyInEffect (an addition): the approved addition that made them a
   * Minter Admin, when it is known. duplicate: the earlier one still waiting.
   */
  otherSignature?: string;
}

/** What the rule reads of a decision (`tx` only for its approval status). */
export type DoubleCandidate = Pick<
  Decision,
  'signature' | 'kind' | 'subject' | 'blockHeight' | 'createdAt' | 'phase' | 'unusualRoute'
> & { tx?: Pick<TxRow, 'approvalStatus'> };

/** Still waiting: not expired, and not decided (Core's status, when the row says). */
function isWaiting(d: DoubleCandidate): boolean {
  if (d.phase === 'expired') return false;
  const status = d.tx?.approvalStatus;
  return !status || status === 'PENDING';
}

export interface DoubleContext {
  /** Every waiting decision in the queue. */
  decisions: readonly DoubleCandidate[];
  /** Today's admin rows (addresses), the null owner included. */
  admins: ReadonlySet<string> | readonly string[];
  /** subject → the approved ADD_GROUP_ADMIN that made them a Minter Admin, when already known. */
  approvedAdds?: ReadonlyMap<string, string>;
}

/** An earlier copy in one of these phases can still pass, so a later one is its double. */
const CAN_PASS: ReadonlySet<DecisionPhase> = new Set([
  'open',
  'early',
  'unconfirmed',
  'thresholdMet',
]);

function adminSet(admins: DoubleContext['admins']): ReadonlySet<string> {
  return admins instanceof Set
    ? (admins as ReadonlySet<string>)
    : new Set(admins as readonly string[]);
}

/** `a` came before `b`: by block (unconfirmed last), then time, then signature. */
function isOlder(a: DoubleCandidate, b: DoubleCandidate): boolean {
  const ha = a.blockHeight ?? Number.POSITIVE_INFINITY;
  const hb = b.blockHeight ?? Number.POSITIVE_INFINITY;
  if (ha !== hb) return ha < hb;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt;
  return a.signature < b.signature;
}

/** Why `d` is a double, or null when it would change something (or isn't an admin change). */
export function doubleOf(d: DoubleCandidate, ctx: DoubleContext): DecisionDouble | null {
  if (d.kind !== 'addAdmin' && d.kind !== 'removeAdmin') return null;
  if (!d.subject || d.unusualRoute || !isWaiting(d)) return null;
  const isAdmin = adminSet(ctx.admins).has(d.subject);
  if (d.kind === 'addAdmin' && isAdmin) {
    const approved = ctx.approvedAdds?.get(d.subject);
    return approved && approved !== d.signature
      ? { reason: 'alreadyInEffect', otherSignature: approved }
      : { reason: 'alreadyInEffect' };
  }
  if (d.kind === 'removeAdmin' && !isAdmin) return { reason: 'alreadyInEffect' };
  let earliest: DoubleCandidate | null = null;
  for (const other of ctx.decisions) {
    if (other.signature === d.signature) continue;
    if (other.kind !== d.kind || other.subject !== d.subject) continue;
    if (other.unusualRoute || !isWaiting(other) || !CAN_PASS.has(other.phase)) continue;
    if (!isOlder(other, d)) continue;
    if (!earliest || isOlder(other, earliest)) earliest = other;
  }
  return earliest ? { reason: 'duplicate', otherSignature: earliest.signature } : null;
}

/** The decisions with `double` set on each double (the others are returned as they are). */
export function markDoubles<T extends DoubleCandidate & { double?: DecisionDouble | null }>(
  decisions: readonly T[],
  ctx: Omit<DoubleContext, 'decisions'>
): T[] {
  const full: DoubleContext = { ...ctx, admins: adminSet(ctx.admins), decisions };
  return decisions.map((d) => {
    const double = doubleOf(d, full);
    if (double) return { ...d, double };
    return d.double ? { ...d, double: null } : d;
  });
}

/** True for a decision marked as a double. */
export function isDouble(d: { double?: DecisionDouble | null }): boolean {
  return Boolean(d.double);
}

/**
 * The newest approved MINTER ADD_GROUP_ADMIN about `subject` among rows the
 * app already has (an account's history), or null.
 */
export function approvedAddFor(rows: readonly TxRow[], subject: string): string | null {
  let best: { signature: string; height: number } | null = null;
  for (const tx of rows) {
    if (tx.type !== 'ADD_GROUP_ADMIN' || tx.member !== subject) continue;
    if (tx.approvalStatus !== 'APPROVED') continue;
    const group = typeof tx.groupId === 'number' ? tx.groupId : tx.txGroupId;
    if (group !== MINTER_GROUP_ID) continue;
    const height =
      typeof tx.approvalHeight === 'number'
        ? tx.approvalHeight
        : typeof tx.blockHeight === 'number'
          ? tx.blockHeight
          : 0;
    if (!best || height > best.height) best = { signature: tx.signature, height };
  }
  return best?.signature ?? null;
}
