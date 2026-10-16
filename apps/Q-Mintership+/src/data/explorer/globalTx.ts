/**
 * Transactions on Qortal: every confirmed transaction of some types in a
 * range of blocks, newest first, 20 a page. Core refuses a search without
 * an address and a type unless it asks for 20 rows or fewer, and refuses a
 * block range unless it asks for confirmed rows, so every search here is
 * confirmed, has a block range and asks for 20:
 *
 *   /transactions/search?txType=…&startBlock=<s>&blockLimit=<n>
 *     &confirmationStatus=CONFIRMED&limit=20&offset=<o>&reverse=true
 *
 * A range is the latest 1,000 or 10,000 blocks up to the tip the page
 * pinned when it opened, or 10,000 blocks from a block (never past that
 * tip), so its rows don't move while it is paged. Each page is one key,
 * `xglobal:<types>:<start>:<limit>:<offset>`; once a newer tip's page has
 * loaded, the pages of the older tips' ranges are dropped from the store
 * (the slot pattern of data/txs.ts), so they don't pile up.
 *
 * What waits for a block is read apart, from the mempool
 * (`/transactions/unconfirmed?txType=…&limit=20`, key `xglobal:waiting:<types>`).
 */
import type { TxRow } from '../types';
import { getJson, query } from '../core';
import { fetchQuery, removeQuery } from '../query';
import { typesKey } from './accountTx';

/** Rows per page: Core's most for a search without an address. */
export const GLOBAL_PAGE = 20;
/** The blocks a "from a block" range covers. */
export const FROM_SPAN = 10_000;

export type BlocksChoice =
  { kind: 'latest'; blocks: 1000 | 10000 } | { kind: 'from'; start: number };

/** Blocks [start, start + limit). */
export interface BlockRange {
  start: number;
  limit: number;
}

/** The range a choice covers, from the pinned tip. */
export function rangeFor(choice: BlocksChoice, tip: number): BlockRange {
  const top = Math.max(1, Math.floor(tip));
  if (choice.kind === 'latest') {
    const start = Math.max(1, top - choice.blocks + 1);
    return { start, limit: top - start + 1 };
  }
  const start = Math.min(Math.max(1, Math.floor(choice.start)), top);
  return { start, limit: Math.max(1, Math.min(FROM_SPAN, top - start + 1)) };
}

export interface GlobalTxPage {
  rows: TxRow[];
  offset: number;
  /** Core has no more rows in the range. */
  done: boolean;
}

/** `xglobal:<types>:<start>:<limit>:<offset>`. */
export function globalTxKey(types: readonly string[], range: BlockRange, offset: number): string {
  return `xglobal:${typesKey(types)}:${range.start}:${range.limit}:${offset}`;
}

/** Pages of ranges that end at a tip, by types and range size: the newest start last. */
const tipKeys = new Map<string, Array<{ start: number; key: string }>>();

/**
 * Once a tip range's page loads, forget the pages of older tips' ranges
 * (their start is lower: the tip only grows), unless a view still shows
 * them. A late answer for an older tip leaves the newer pages alone.
 */
function dropOlderTips(slot: string, start: number): void {
  const kept = (tipKeys.get(slot) ?? []).filter(
    (entry) => entry.start >= start || !removeQuery(entry.key)
  );
  tipKeys.set(slot, kept);
}

function rememberTipKey(slot: string, start: number, key: string): void {
  const entries = tipKeys.get(slot) ?? [];
  if (!entries.some((entry) => entry.key === key)) entries.push({ start, key });
  tipKeys.set(slot, entries);
}

/**
 * One page of confirmed transactions of `types` (none = every type) in
 * `range`. `endsAtTip`: the range is the latest blocks, so a later tip
 * makes a new range, and this one's pages can go once that has loaded.
 */
export function getGlobalTx(
  types: readonly string[],
  range: BlockRange,
  offset: number,
  options: { force?: boolean; endsAtTip?: boolean } = {}
): Promise<GlobalTxPage> {
  const key = globalTxKey(types, range, offset);
  const slot = `${typesKey(types)}:${range.limit}`;
  if (options.endsAtTip) rememberTipKey(slot, range.start, key);
  const result = fetchQuery(
    key,
    async () => {
      const body = await getJson<unknown>(
        `/transactions/search?${query({
          txType: types.length ? types : undefined,
          startBlock: range.start,
          blockLimit: range.limit,
          confirmationStatus: 'CONFIRMED',
          limit: GLOBAL_PAGE,
          offset,
          reverse: true,
        })}`
      );
      const rows = (Array.isArray(body) ? body : []).filter(
        (row): row is TxRow =>
          Boolean(row) && typeof row === 'object' && typeof (row as TxRow).signature === 'string'
      );
      return { rows, offset, done: rows.length < GLOBAL_PAGE };
    },
    // Confirmed rows in a closed range don't change.
    { ttlMs: 30 * 60_000, force: options.force }
  );
  if (options.endsAtTip)
    void result.then(
      () => dropOlderTips(slot, range.start),
      () => {}
    );
  return result;
}

/** `xglobal:waiting:<types>`. */
export function globalWaitingKey(types: readonly string[]): string {
  return `xglobal:waiting:${typesKey(types)}`;
}

/** Up to 20 transactions of `types` (none = every type) waiting for a block, newest first. */
export function getGlobalWaiting(
  types: readonly string[],
  options: { force?: boolean } = {}
): Promise<TxRow[]> {
  return fetchQuery(
    globalWaitingKey(types),
    async () => {
      const body = await getJson<unknown>(
        `/transactions/unconfirmed?${query({
          txType: types.length ? types : undefined,
          limit: GLOBAL_PAGE,
          reverse: true,
        })}`
      );
      return (Array.isArray(body) ? body : []).filter(
        (row): row is TxRow =>
          Boolean(row) && typeof row === 'object' && typeof (row as TxRow).signature === 'string'
      );
    },
    { ttlMs: 20_000, force: options.force }
  );
}

/** For tests: forget which pages belong to which tip. */
export function resetGlobalTxSlots(): void {
  tipKeys.clear();
}
