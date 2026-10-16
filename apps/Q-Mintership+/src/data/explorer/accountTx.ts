/**
 * One account's transactions, newest first, for the Explorer's Transactions
 * tab and Overview's "Latest transactions" (they share the All list's first
 * read).
 *
 * One store key per list: `xtx:<address>:<types>` (the family's types,
 * sorted and joined by commas, or `all`), holding every row read so far.
 * Each read is one page of 100 (Core's GROUP BY over the account's rows
 * costs the same for 5 rows or 100) through the heavy-read limiter, scoped
 * to the address:
 *
 *   /transactions/search?address=<a>[&txType=…]&confirmationStatus=CONFIRMED
 *     &limit=100&offset=<n>&reverse=true
 *
 * - The first read takes offset 0.
 * - "Load older" reads at `nextOffset` and appends, dropping rows already
 *   held (same signature).
 * - A reload (Refresh, or the list read again once stale) reads offset 0
 *   again, counts the signatures it hasn't seen (k), puts them on top and
 *   moves `nextOffset` on by k, so the next older page starts right after
 *   the last row held: no gap, no repeat. When the whole new page is new
 *   (more than 100 since the last read), the list starts over from it.
 *
 * Unconfirmed transactions aren't in an address search (Core records who
 * took part only at confirmation): the ones the account sent are read by
 * its public key (`xunconf:<publicKey>`, 20 s); ones sent to it can't be
 * found until they are in a block.
 */
import type { TxRow } from '../types';
import { getJson, query } from '../core';
import { peekQuery, fetchQuery } from '../query';
import { getUnconfirmedBy } from '../txs';
import { heavyQuery } from './heavy';

/** Rows per read. */
export const ACCOUNT_TX_PAGE = 100;

/** How long a list stays fresh: the account page's Refresh reads it sooner. */
const TTL_MS = 5 * 60_000;

export interface AccountTxList {
  /** Every row read so far, newest first, each signature once. */
  rows: TxRow[];
  /** Where the next older page starts in Core's list. */
  nextOffset: number;
  /** Core has no older rows. */
  done: boolean;
  /** When the newest page was last read (ms). */
  checkedAt: number;
}

/** The types part of a key: sorted and joined, or `all` for no type filter. */
export function typesKey(types: readonly string[]): string {
  return types.length ? [...types].sort().join(',') : 'all';
}

/** `xtx:<address>:<types>`: the store key of one account's list. */
export function accountTxKey(address: string, types: readonly string[]): string {
  return `xtx:${address}:${typesKey(types)}`;
}

function searchPath(address: string, types: readonly string[], offset: number): string {
  return `/transactions/search?${query({
    address,
    txType: types.length ? types : undefined,
    confirmationStatus: 'CONFIRMED',
    limit: ACCOUNT_TX_PAGE,
    offset,
    reverse: true,
  })}`;
}

async function readPage(
  address: string,
  types: readonly string[],
  offset: number
): Promise<TxRow[]> {
  const body = await getJson<unknown>(searchPath(address, types, offset));
  return (Array.isArray(body) ? body : []).filter(
    (row): row is TxRow =>
      Boolean(row) && typeof row === 'object' && typeof (row as TxRow).signature === 'string'
  );
}

/** `rows` without repeats (the first of each signature kept). */
function unique(rows: TxRow[]): TxRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.signature)) return false;
    seen.add(row.signature);
    return true;
  });
}

/** The first read of a list. */
function fromFirstPage(page: TxRow[]): AccountTxList {
  return {
    rows: unique(page),
    nextOffset: page.length,
    done: page.length < ACCOUNT_TX_PAGE,
    checkedAt: Date.now(),
  };
}

/**
 * The newest page read again on top of what is held. Exported for tests;
 * the loader below is what views use.
 */
export function mergeNewest(previous: AccountTxList, page: TxRow[]): AccountTxList {
  // Core had fewer than a page: that is the whole list.
  if (page.length < ACCOUNT_TX_PAGE) return fromFirstPage(page);
  const held = new Set(previous.rows.map((row) => row.signature));
  const fresh = page.filter((row) => !held.has(row.signature));
  // Nothing in common: more than a page arrived since, so what is held no
  // longer follows on. Start over from this page.
  if (fresh.length === page.length) return fromFirstPage(page);
  const inPage = new Set(page.map((row) => row.signature));
  return {
    rows: unique([...page, ...previous.rows.filter((row) => !inPage.has(row.signature))]),
    nextOffset: previous.nextOffset + fresh.length,
    done: previous.done,
    checkedAt: Date.now(),
  };
}

/** An older page appended to what is held. Exported for tests. */
export function mergeOlder(previous: AccountTxList, page: TxRow[]): AccountTxList {
  return {
    rows: unique([...previous.rows, ...page]),
    nextOffset: previous.nextOffset + page.length,
    done: page.length < ACCOUNT_TX_PAGE,
    checkedAt: previous.checkedAt,
  };
}

/**
 * One account's list for `types` (none = all), newest first. The first call
 * reads the newest 100; later calls once the list is stale (or `force`, a
 * Refresh) read the newest page again and merge it; `older` reads the next
 * older page and appends it.
 */
export function getAccountTx(
  address: string,
  types: readonly string[],
  options: { force?: boolean; older?: boolean } = {}
): Promise<AccountTxList> {
  const key = accountTxKey(address, types);
  return heavyQuery(
    address,
    key,
    async () => {
      const previous = peekQuery<AccountTxList>(key);
      if (options.older && previous) {
        if (previous.done) return previous;
        return mergeOlder(previous, await readPage(address, types, previous.nextOffset));
      }
      const page = await readPage(address, types, 0);
      return previous ? mergeNewest(previous, page) : fromFirstPage(page);
    },
    { ttlMs: TTL_MS, force: options.force || options.older }
  );
}

/** `xunconf:<publicKey>`: the store key of what an account sent that waits for a block. */
export function unconfirmedKey(publicKey: string): string {
  return `xunconf:${publicKey}`;
}

/**
 * What the account sent that isn't in a block yet (Core's mempool, by its
 * public key), newest first. Kept 20 s; never polled.
 */
export function getUnconfirmedOf(
  publicKey: string,
  options: { force?: boolean } = {}
): Promise<TxRow[]> {
  return fetchQuery(
    unconfirmedKey(publicKey),
    async () =>
      (await getUnconfirmedBy(publicKey)).sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    { ttlMs: 20_000, force: options.force }
  );
}
