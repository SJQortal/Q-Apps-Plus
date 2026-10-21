/**
 * Runs of alike transactions in a list (Simon, 2026-10-17: rows repeating
 * the same thing, merged and expandable). Consecutive transactions are
 * alike when their row would say the very same thing: the same type and
 * the same sentence, told from the list's account (amounts, names and
 * accounts included), whatever their block. Six level moves from one
 * account to Jacob in block 1,585,006 are one run; so are 18 "Published an
 * encrypted resource as “crowetic”" in a row; two payments of different
 * amounts are not.
 *
 * A minting level move's recipient isn't in Core's JSON (the sentence
 * reads it later), so moves are only alike in the recipient's own list.
 * What waits for a block is never grouped. Pure.
 */
import type { TxRow } from '../../data/types';
import { describeTx, partsToPlain } from './txWords';

/** What alike transactions share; unique for one that can't be told alike. */
export function alikeKey(tx: TxRow, viewpoint: string | null = null): string {
  if (typeof tx.blockHeight !== 'number') return `waiting:${tx.signature}`;
  if (tx.type === 'TRANSFER_PRIVS' && (!viewpoint || viewpoint === tx.creatorAddress))
    return `privs:${tx.signature}`;
  return `${tx.type}|${partsToPlain(describeTx(tx, { viewpoint }).parts)}`;
}

/** The rows in runs: consecutive alike rows together, in their order. */
export function alikeRuns(rows: readonly TxRow[], viewpoint: string | null = null): TxRow[][] {
  const runs: TxRow[][] = [];
  let last: string | null = null;
  for (const tx of rows) {
    const key = alikeKey(tx, viewpoint);
    if (key === last) runs[runs.length - 1].push(tx);
    else runs.push([tx]);
    last = key;
  }
  return runs;
}

/** The first `count` runs of `rows`, as rows (a list showing that many lines). */
export function firstRuns(
  rows: readonly TxRow[],
  count: number,
  viewpoint: string | null = null
): TxRow[] {
  return alikeRuns(rows, viewpoint).slice(0, count).flat();
}
