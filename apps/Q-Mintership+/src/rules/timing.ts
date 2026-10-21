/**
 * When a pending group transaction is decided, as Qortal Core does it
 * (Block.processGroupApprovalTransactions and the HSQLDB approval queries).
 *
 * For a PENDING transaction confirmed in block h, in a group with delays
 * `min` and `max`, while Core processes block H:
 *
 * 1. Expiry runs first: the transaction EXPIRES when h < H − max, so the
 *    first block in which it can expire is H = h + max + 1.
 * 2. Then decisions: approvals are checked when h < H − min, so the earliest
 *    decision is in block h + min + 1. If the threshold is met it is APPROVED
 *    and applied in that same block; nobody has to act again.
 * 3. Only confirmed approvals count, and the decision step runs before the
 *    block's own transactions are linked, so an approval in block B counts
 *    from block B + 1. The last block that can decide is h + max, so the last
 *    approval that can count is in block h + max − 1.
 *
 * MINTER (min 5, max 10080): earliest decision h+6, last useful signature
 * h+10079, last decision h+10080, expired at h+10081.
 *
 * A transaction that is still unconfirmed has no clock yet.
 */

export interface GroupDelays {
  minimumBlockDelay: number;
  maximumBlockDelay: number;
}

export interface DecisionWindow {
  /** The block the pending transaction was confirmed in. */
  confirmedHeight: number;
  /** The first block in which it can be approved. */
  earliestDecisionHeight: number;
  /** The last block whose approvals can still count. */
  lastUsefulSignatureHeight: number;
  /** The last block in which it can be approved. */
  lastDecisionHeight: number;
  /** The block in which it expires if it was not approved before. */
  expiresAtHeight: number;
}

export function decisionWindow(confirmedHeight: number, delays: GroupDelays): DecisionWindow {
  const h = confirmedHeight;
  return {
    confirmedHeight: h,
    earliestDecisionHeight: h + delays.minimumBlockDelay + 1,
    lastUsefulSignatureHeight: h + delays.maximumBlockDelay - 1,
    lastDecisionHeight: h + delays.maximumBlockDelay,
    expiresAtHeight: h + delays.maximumBlockDelay + 1,
  };
}

export type WindowPhase =
  /** Too early for a decision (the minimum delay has not passed); signatures still count. */
  | 'early'
  /** Can be decided in the next block; signatures still count. */
  | 'open'
  /** The last useful block has been made: a new signature would land too late to count. */
  | 'tooLate'
  /** Past the last decision block: Core has expired it (or is about to, in the next block). */
  | 'expired';

/**
 * Where the window stands when the chain tip is `tipHeight`. A signature sent
 * now lands in block tipHeight + 1 at the earliest.
 */
export function windowPhase(window: DecisionWindow, tipHeight: number): WindowPhase {
  const next = tipHeight + 1;
  if (next >= window.expiresAtHeight) return 'expired';
  if (next > window.lastUsefulSignatureHeight) return 'tooLate';
  if (next < window.earliestDecisionHeight) return 'early';
  return 'open';
}

/**
 * Blocks left in which a new signature can still land and count: blocks
 * tipHeight + 1 … lastUsefulSignatureHeight. Zero when it is too late.
 */
export function signatureBlocksLeft(window: DecisionWindow, tipHeight: number): number {
  return Math.max(0, window.lastUsefulSignatureHeight - tipHeight);
}

/** Blocks until the expiry block (0 once it has been reached). */
export function blocksUntilExpiry(window: DecisionWindow, tipHeight: number): number {
  return Math.max(0, window.expiresAtHeight - tipHeight);
}

/**
 * A nomination that no Minter Admin has signed yet waits on the open list for
 * at most this many blocks: an app rule, the same length as MINTER's own
 * approval window. After that it moves to History; nothing is lost.
 */
export function waitingWindowBlocks(delays: GroupDelays): number {
  return delays.maximumBlockDelay;
}
