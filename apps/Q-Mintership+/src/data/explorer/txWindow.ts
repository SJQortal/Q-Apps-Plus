/**
 * The time an account's Transactions filters pick, as a window over its
 * list. Core can limit a search to blocks, but with an address it then
 * reads every transaction in those blocks before picking the account's
 * (minutes on a busy account), so the Explorer never asks for blocks.
 * The account's own list is ordered by each transaction's time, so a
 * window is a stretch of it: data/explorer/accountTx.ts finds where it
 * starts and reads on until it ends.
 *
 * - Last 24 hours … 12 months: from now less that span (to the minute).
 * - Between dates: from the first day's local midnight to the end of the
 *   last day, by each transaction's own time.
 * - Between blocks: matched exactly on each row's block; the stretch is
 *   found from the blocks' times (`/blocks/byheight`, kept for the
 *   session), a day wider at the start (a transaction can wait that long
 *   for a block) and an hour at the end.
 */
import { getBlock, getTip } from '../chain';
import { fetchQuery } from '../query';
import { dayStart, WHEN_SPAN, type TxFilters } from '../../rules/explorer/accountTxFilters';

/** Rows in it: by time (ms, `toMs` excluded) and, for blocks, by block (both included). */
export interface TxWindow {
  fromMs?: number;
  toMs?: number;
  fromBlock?: number;
  toBlock?: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The window the filters pick: null for any time, 'empty' when nothing can be in it. */
export async function resolveWindow(
  filters: TxFilters,
  now = Date.now()
): Promise<TxWindow | 'empty' | null> {
  const { when, from, to } = filters;
  const span = WHEN_SPAN[when];
  if (span !== undefined) return { fromMs: Math.floor((now - span) / 60_000) * 60_000 };
  if (when === 'dates') {
    const window: TxWindow = {};
    if (from) window.fromMs = dayStart(from);
    if (to) {
      const next = new Date(dayStart(to));
      next.setDate(next.getDate() + 1);
      if (next.getTime() <= now) window.toMs = next.getTime();
    }
    if (window.fromMs !== undefined && window.toMs !== undefined && window.toMs <= window.fromMs)
      return 'empty';
    return window.fromMs === undefined && window.toMs === undefined ? null : window;
  }
  if (when === 'blocks') {
    const tip = (await getTip()).height;
    const fromBlock = from ? Number(from) : undefined;
    const toBlock = to ? Number(to) : undefined;
    if (fromBlock !== undefined && fromBlock > tip) return 'empty';
    if (fromBlock !== undefined && toBlock !== undefined && toBlock < fromBlock) return 'empty';
    const window: TxWindow = {};
    if (fromBlock !== undefined && fromBlock > 1) {
      window.fromBlock = fromBlock;
      window.fromMs = (await getBlock(fromBlock)).timestamp - DAY;
    }
    if (toBlock !== undefined && toBlock < tip) {
      window.toBlock = toBlock;
      window.toMs = (await getBlock(toBlock)).timestamp + HOUR;
    }
    return Object.keys(window).length ? window : null;
  }
  return null;
}

/** `xtxwin:<when>:<from>:<to>`: the store key of a time picked, as a window. */
export function txWindowKey(filters: TxFilters): string {
  return `xtxwin:${filters.when}:${filters.from ?? ''}:${filters.to ?? ''}`;
}

/** resolveWindow, kept a minute (a "last 7 days" moves on with the clock). */
export function getTxWindow(
  filters: TxFilters,
  options: { force?: boolean } = {}
): Promise<TxWindow | 'empty' | null> {
  return fetchQuery(txWindowKey(filters), () => resolveWindow(filters), {
    ttlMs: 60_000,
    force: options.force,
  });
}

/** Is the row in the window? */
export function inWindow(tx: { timestamp: number; blockHeight?: number }, w: TxWindow): boolean {
  if (w.fromBlock !== undefined || w.toBlock !== undefined) {
    const h = tx.blockHeight;
    if (typeof h !== 'number') return false;
    return (
      (w.fromBlock === undefined || h >= w.fromBlock) && (w.toBlock === undefined || h <= w.toBlock)
    );
  }
  return (
    (w.fromMs === undefined || tx.timestamp >= w.fromMs) &&
    (w.toMs === undefined || tx.timestamp < w.toMs)
  );
}

/** The key part of a window: `:t<from>-<to>` and `:b<from>-<to>`, each only when set. */
export function windowKeyPart(w: TxWindow | null | undefined): string {
  if (!w) return '';
  const time =
    w.fromMs !== undefined || w.toMs !== undefined ? `:t${w.fromMs ?? ''}-${w.toMs ?? ''}` : '';
  const blocks =
    w.fromBlock !== undefined || w.toBlock !== undefined
      ? `:b${w.fromBlock ?? ''}-${w.toBlock ?? ''}`
      : '';
  return `${time}${blocks}`;
}
