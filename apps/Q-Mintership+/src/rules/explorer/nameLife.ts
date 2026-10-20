/**
 * One step back in a name's life (data/explorer/nameLife.ts walks them):
 * in an owner's name transactions, what it did with the name while it had
 * it, newest first, down to how it got it: registered it, bought it (the
 * seller had it before), or renamed an earlier name to it (the same
 * account had it under that name). Pure.
 */
import type { TxRow } from '../../data/types';

/** Where a transaction is on the chain: its block, then its time within it. */
export interface ChainPosition {
  height: number;
  timestamp: number;
}

/** After every transaction: where the walk starts, at the owner's latest. */
export const CHAIN_NOW: ChainPosition = { height: Infinity, timestamp: Infinity };

export function positionOf(tx: TxRow): ChainPosition {
  return { height: tx.blockHeight ?? Infinity, timestamp: tx.timestamp };
}

/** Whether `a` comes before `b` on the chain. */
export function isBefore(a: ChainPosition, b: ChainPosition): boolean {
  return a.height < b.height || (a.height === b.height && a.timestamp < b.timestamp);
}

export type HowGot =
  | { kind: 'registered'; tx: TxRow }
  | { kind: 'bought'; tx: TxRow; seller: string }
  | { kind: 'renamed'; tx: TxRow; from: string }
  /** Not in the rows given (they stop short), or they don't fit together. */
  | { kind: 'notFound' };

export interface OwnerSpan {
  /** What it did with the name, newest first, how it got it last. */
  steps: TxRow[];
  got: HowGot;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * What `account` did with the name `spelling` before `before` (the next
 * owner's purchase, or a rename to the name after it), newest first, down
 * to how it got it. Its own transactions only: a purchase of the name from
 * it, or the name renamed away, before that point means the rows don't fit
 * together (or another time it had the name), and the span stops there.
 */
export function ownerSpan(
  rows: readonly TxRow[],
  account: string,
  spelling: string,
  before: ChainPosition
): OwnerSpan {
  const steps: TxRow[] = [];
  const newestFirst = [...rows].sort((a, b) =>
    isBefore(positionOf(a), positionOf(b)) ? 1 : isBefore(positionOf(b), positionOf(a)) ? -1 : 0
  );
  for (const tx of newestFirst) {
    if (!isBefore(positionOf(tx), before)) continue;
    const name = str(tx.name);
    const newName = str(tx.newName);
    if (name !== spelling && newName !== spelling) continue;
    if (tx.creatorAddress !== account) return { steps, got: { kind: 'notFound' } };
    if (tx.type === 'UPDATE_NAME' && name === spelling && newName && newName !== spelling)
      return { steps, got: { kind: 'notFound' } };
    steps.push(tx);
    if (tx.type === 'REGISTER_NAME' && name === spelling)
      return { steps, got: { kind: 'registered', tx } };
    if (tx.type === 'BUY_NAME' && name === spelling) {
      const seller = str(tx.seller);
      if (seller) return { steps, got: { kind: 'bought', tx, seller } };
    }
    if (tx.type === 'UPDATE_NAME' && newName === spelling && name && name !== spelling)
      return { steps, got: { kind: 'renamed', tx, from: name } };
  }
  return { steps, got: { kind: 'notFound' } };
}
