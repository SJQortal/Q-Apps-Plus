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
 * The Transactions tab's filters can ask for the oldest first
 * (`reverse=false`) and for a window of time or blocks (data/explorer/
 * txWindow.ts; never Core's startBlock/blockLimit, which with an address
 * reads every transaction in those blocks). Core orders the account's list
 * by each transaction's time, so a window is one stretch of it: the first
 * read finds where the stretch starts (pages of 100 at offsets that double,
 * then halving the gap: about a dozen reads for 10,000 rows), and the list
 * reads on from there, keeping the rows in the window, until a row is past
 * its end. Such a list has a key of its own
 * (`xtx:<address>:<types>:oldest:t<from>-<to>:b<from>-<to>`, each part only
 * when picked); a reload starts over.
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
import { inWindow, windowKeyPart, type TxWindow } from './txWindow';

/** Which part of the list, in which order: all of it, newest first, by default. */
export interface AccountTxView {
  order?: 'newest' | 'oldest';
  window?: TxWindow | null;
}

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

function isDefaultView(view: AccountTxView): boolean {
  return view.order !== 'oldest' && !view.window;
}

/**
 * `xtx:<address>:<types>`: the store key of one account's list; a view
 * other than the default adds `:oldest` and `:b<start>-<limit>`.
 */
export function accountTxKey(
  address: string,
  types: readonly string[],
  view: AccountTxView = {}
): string {
  const order = view.order === 'oldest' ? ':oldest' : '';
  return `xtx:${address}:${typesKey(types)}${order}${windowKeyPart(view.window)}`;
}

function searchPath(
  address: string,
  types: readonly string[],
  offset: number,
  view: AccountTxView
): string {
  return `/transactions/search?${query({
    address,
    txType: types.length ? types : undefined,
    confirmationStatus: 'CONFIRMED',
    limit: ACCOUNT_TX_PAGE,
    offset,
    reverse: view.order !== 'oldest',
  })}`;
}

async function readPage(
  address: string,
  types: readonly string[],
  offset: number,
  view: AccountTxView
): Promise<TxRow[]> {
  const body = await getJson<unknown>(searchPath(address, types, offset, view));
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

/** Where a row stands against a window, in the list's order: not reached yet, in it, or past it. */
type Place = 'before' | 'in' | 'after';

function placeOf(tx: TxRow, window: TxWindow, oldestFirst: boolean): Place {
  if (oldestFirst) {
    if (window.fromMs !== undefined && tx.timestamp < window.fromMs) return 'before';
    if (window.toMs !== undefined && tx.timestamp >= window.toMs) return 'after';
  } else {
    if (window.toMs !== undefined && tx.timestamp >= window.toMs) return 'before';
    if (window.fromMs !== undefined && tx.timestamp < window.fromMs) return 'after';
  }
  return 'in';
}

/**
 * The offset of the first row not before the window: pages of 100 at
 * offsets 0, 100, 300, 700, … until one reaches it, then halving the gap.
 */
async function findStart(
  read: (offset: number) => Promise<TxRow[]>,
  window: TxWindow,
  oldestFirst: boolean
): Promise<number> {
  const before = (tx: TxRow) => placeOf(tx, window, oldestFirst) === 'before';
  let lo = 0;
  let hi = 0;
  let step = ACCOUNT_TX_PAGE;
  // Doubling: find a page that isn't wholly before the window (or is past the list's end).
  for (;;) {
    const page = await read(lo);
    const i = page.findIndex((tx) => !before(tx));
    if (i > 0) return lo + i;
    if (i === 0 || !page.length) {
      // The start is after the last page read wholly before the window.
      if (lo === 0) return 0;
      hi = lo;
      lo = lo - step / 2 + ACCOUNT_TX_PAGE;
      break;
    }
    if (page.length < ACCOUNT_TX_PAGE) return lo + page.length;
    lo += step;
    step *= 2;
  }
  // Halving: the start is in [lo, hi].
  while (lo < hi) {
    const mid: number = lo + Math.floor((hi - lo) / 2);
    const page = await read(mid);
    const i = page.findIndex((tx) => !before(tx));
    if (i > 0) return mid + i;
    if (i === 0 || !page.length) hi = mid;
    else lo = mid + page.length;
  }
  return hi;
}

/** A page read on in a window: its rows in the window, and whether the window ended. */
function windowRows(
  page: TxRow[],
  window: TxWindow,
  oldestFirst: boolean
): { rows: TxRow[]; ended: boolean } {
  const rows: TxRow[] = [];
  for (const tx of page) {
    const place = placeOf(tx, window, oldestFirst);
    if (place === 'after') return { rows, ended: true };
    if (place === 'in' && inWindow(tx, window)) rows.push(tx);
  }
  return { rows, ended: page.length < ACCOUNT_TX_PAGE };
}

/** The first read of a window: where it starts, then its first page. */
async function firstWindowPage(
  read: (offset: number) => Promise<TxRow[]>,
  window: TxWindow,
  oldestFirst: boolean
): Promise<AccountTxList> {
  const reaches = (oldestFirst ? window.fromMs : window.toMs) !== undefined;
  const start = reaches ? await findStart(read, window, oldestFirst) : 0;
  const page = await read(start);
  const { rows, ended } = windowRows(page, window, oldestFirst);
  return {
    rows: unique(rows),
    nextOffset: start + page.length,
    done: ended,
    checkedAt: Date.now(),
  };
}

/** The next page of a window, appended. */
async function nextWindowPage(
  previous: AccountTxList,
  read: (offset: number) => Promise<TxRow[]>,
  window: TxWindow,
  oldestFirst: boolean
): Promise<AccountTxList> {
  const page = await read(previous.nextOffset);
  const { rows, ended } = windowRows(page, window, oldestFirst);
  return {
    rows: unique([...previous.rows, ...rows]),
    nextOffset: previous.nextOffset + page.length,
    done: ended,
    checkedAt: previous.checkedAt,
  };
}

/**
 * One account's list for `types` (none = all), newest first. The first call
 * reads the newest 100; later calls once the list is stale (or `force`, a
 * Refresh) read the newest page again and merge it; `older` reads the next
 * older page and appends it. With a `view` (oldest first, a range of
 * blocks), `older` reads the next page on, and a reload starts over.
 */
export function getAccountTx(
  address: string,
  types: readonly string[],
  options: { force?: boolean; older?: boolean; view?: AccountTxView } = {}
): Promise<AccountTxList> {
  const view = options.view ?? {};
  const key = accountTxKey(address, types, view);
  return heavyQuery(
    address,
    key,
    async () => {
      const previous = peekQuery<AccountTxList>(key);
      const window = view.window;
      if (window) {
        const oldestFirst = view.order === 'oldest';
        const read = (offset: number) => readPage(address, types, offset, view);
        if (options.older && previous)
          return previous.done ? previous : nextWindowPage(previous, read, window, oldestFirst);
        return firstWindowPage(read, window, oldestFirst);
      }
      if (options.older && previous) {
        if (previous.done) return previous;
        return mergeOlder(previous, await readPage(address, types, previous.nextOffset, view));
      }
      const page = await readPage(address, types, 0, view);
      return previous && isDefaultView(view) ? mergeNewest(previous, page) : fromFirstPage(page);
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
