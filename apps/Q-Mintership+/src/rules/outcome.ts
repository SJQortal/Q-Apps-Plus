/**
 * How a MINTER decision ended, from Core's `approvalStatus` on the
 * transaction (GET /transactions/signature/{sig}), for its own page and a
 * nomination's rounds. Pure.
 *
 * - PENDING (or none yet, while unconfirmed): still collecting signatures.
 * - APPROVED: enough signatures; Core applied it in its decision block
 *   (`approvalHeight`).
 * - NOT_REQUIRED: from before MINTER needed signatures; applied at once.
 * - REJECTED: Minter Admins' rejections reached the threshold.
 * - EXPIRED: not enough signatures in time; Core expires it in block
 *   h + maximumBlockDelay + 1 (rules/timing.ts), and records that block.
 * - INVALID: approved, but no longer valid when Core came to apply it.
 */
import type { TxRow } from '../data/types';
import type { DecisionKind } from './decision';

export type DecisionOutcome =
  'pending' | 'approved' | 'applied' | 'rejected' | 'expired' | 'invalid';

export function decisionOutcome(tx: Pick<TxRow, 'approvalStatus'>): DecisionOutcome {
  switch (tx.approvalStatus) {
    case 'APPROVED':
      return 'approved';
    case 'NOT_REQUIRED':
      return 'applied';
    case 'REJECTED':
      return 'rejected';
    case 'EXPIRED':
      return 'expired';
    case 'INVALID':
      return 'invalid';
    default:
      return 'pending';
  }
}

/**
 * The block it was decided in: Core's `approvalHeight` when it has one; for
 * an expiry without it, h + maximumBlockDelay + 1; for a change applied at
 * once, its own block. Null while it waits.
 */
export function decidedHeight(
  tx: Pick<TxRow, 'approvalStatus' | 'approvalHeight' | 'blockHeight'>,
  maximumBlockDelay: number
): number | null {
  const outcome = decisionOutcome(tx);
  if (outcome === 'pending') return null;
  if (typeof tx.approvalHeight === 'number') return tx.approvalHeight;
  if (typeof tx.blockHeight !== 'number') return null;
  if (outcome === 'applied') return tx.blockHeight;
  if (outcome === 'expired') return tx.blockHeight + maximumBlockDelay + 1;
  return null;
}

/** A short label for each outcome (chips and titles). */
export const OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  pending: 'Collecting approvals',
  approved: 'Approved',
  applied: 'Applied',
  rejected: 'Rejected',
  expired: 'Expired',
  invalid: 'Not applied',
};

/** One plain sentence on how it ended. */
export function outcomeSentence(outcome: DecisionOutcome, kind: DecisionKind): string {
  switch (outcome) {
    case 'pending':
      return 'Still collecting approvals.';
    case 'approved':
      return 'Enough Minter Admins approved, and Core applied it.';
    case 'applied':
      return 'Applied at once: it is from before MINTER needed Minter Admins’ approvals.';
    case 'rejected':
      return 'Rejected by Minter Admins.';
    case 'expired':
      return kind === 'invite'
        ? 'Not enough approvals in time. They can be nominated again.'
        : 'Not enough approvals in time, so it didn’t happen.';
    case 'invalid':
      return 'Enough Minter Admins approved, but Core didn’t apply it: by then it was no longer valid.';
  }
}

/**
 * The blocks a decided transaction's signatures can be in: from a little
 * before its own block (signatures sent while it was unconfirmed) to the
 * block before its decision block, the last whose signatures Core counted.
 * At most maximumBlockDelay + 10 blocks; null when the chain doesn't say
 * enough.
 */
export function signatureRange(
  tx: Pick<TxRow, 'approvalStatus' | 'approvalHeight' | 'blockHeight'>,
  maximumBlockDelay: number,
  tipHeight: number
): { start: number; end: number } | null {
  if (typeof tx.blockHeight !== 'number') return null;
  const decided = decidedHeight(tx, maximumBlockDelay);
  // An approval counts from the block after it lands: the last that can count
  // is the block before the decision, and never later than h + maximumBlockDelay - 1.
  const last = Math.min(
    tipHeight,
    decided === null ? tipHeight : decided - 1,
    tx.blockHeight + maximumBlockDelay - 1
  );
  const start = Math.max(1, tx.blockHeight - 10);
  return last >= start ? { start, end: last } : null;
}
