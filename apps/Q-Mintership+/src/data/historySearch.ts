/**
 * History's search by type: one kind of MINTER decision across all of
 * MINTER's history, or from a block on. Decisions carry txGroupId 694, so
 * Core finds them by type alone, newest first, 100 a page (getDecisionsInRange,
 * cached). Joins and leaves carry txGroupId 0 and are only found by reading
 * every group's joins in a block window, so they stay in History's 30-day
 * windows (data/timeline.ts).
 *
 * A kick declined a join request or removed a member; which one is read
 * from the kicked person's own history (declineMarks), so kicks are marked
 * in batches, newest first, each batch kept for the session.
 */
import { fetchQuery } from './query';
import { getDecisionsInRange } from './txs';
import { declineMarks } from './timeline';
import type { GroupTxType, TxRow } from './types';
import type { PagedResult } from './core';

/** Kicks marked per batch: each kicked person's history is one read. */
export const KICK_BATCH = 20;

export function typedHistoryKey(
  types: readonly GroupTxType[],
  startHeight: number,
  endHeight: number
): string {
  return `historytype:${types.join(',')}:${startHeight}:${endHeight}`;
}

/**
 * Confirmed MINTER decisions of `types` from `startHeight` to `endHeight`
 * (1 for all of MINTER's history), newest first (key typedHistoryKey).
 */
export function loadTypedHistory(
  types: readonly GroupTxType[],
  startHeight: number,
  endHeight: number,
  options: { force?: boolean } = {}
): Promise<PagedResult<TxRow>> {
  return fetchQuery(
    typedHistoryKey(types, startHeight, endHeight),
    () => getDecisionsInRange(types, startHeight, endHeight, { force: options.force }),
    { ttlMs: 5 * 60_000, force: options.force }
  );
}

/** declineMarks for one batch of kicks, kept for the session (key `kickmarks:<first>:<last>`). */
function loadKickBatch(batch: readonly TxRow[]): Promise<Map<string, boolean>> {
  const first = batch[0]?.signature ?? '';
  const last = batch[batch.length - 1]?.signature ?? '';
  return fetchQuery(`kickmarks:${first}:${last}:${batch.length}`, () => declineMarks(batch), {
    ttlMs: 30 * 60_000,
  });
}

export function kickMarksKey(kicks: readonly TxRow[], batches: number): string {
  return `kickmarks-upto:${kicks[0]?.signature ?? ''}:${kicks.length}:${batches}`;
}

/**
 * Marks for the newest `batches` × KICK_BATCH kicks among `kicks` (newest
 * first): which declined a join request (key kickMarksKey). Batches already
 * marked come from the cache, so asking for one more reads only the new one.
 */
export function loadKickMarks(
  kicks: readonly TxRow[],
  batches: number
): Promise<Map<string, boolean>> {
  return fetchQuery(
    kickMarksKey(kicks, batches),
    async () => {
      const parts: Array<Promise<Map<string, boolean>>> = [];
      for (let i = 0; i < batches && i * KICK_BATCH < kicks.length; i++)
        parts.push(loadKickBatch(kicks.slice(i * KICK_BATCH, (i + 1) * KICK_BATCH)));
      const marks = new Map<string, boolean>();
      for (const part of await Promise.all(parts)) for (const [k, v] of part) marks.set(k, v);
      return marks;
    },
    { ttlMs: 30 * 60_000 }
  );
}
