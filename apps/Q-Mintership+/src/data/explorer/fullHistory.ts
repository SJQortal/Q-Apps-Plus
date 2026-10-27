/**
 * An account's whole history, once it is read: the All list of
 * accountTx.ts (`xtx:<address>:all`) read to its end, by Overview's "Read
 * all of it", the QORT summaries, or at once for an account with fewer
 * than 100 transactions. Simon, 2026-10-21: "since I fetched all the
 * accounts transactions in overview, it should show all history in
 * connections and so on".
 *
 * While it is there, the Connections reads (payments each way, asset
 * transfers, the links search) come from it, complete, instead of their
 * own bounded searches; Compare, the sponsee sets and the Quiz read the
 * same keys. When the list reaches its end (or grows after that), those
 * keys are marked stale, so what is on screen is read again from it.
 *
 * Nothing here reads the network.
 */
import type { TxRow } from '../types';
import { invalidate, peekQuery } from '../query';

/** The All list's key (accountTx.ts accountTxKey(address, []), checked by a test). */
export const allListKey = (address: string) => `xtx:${address}:all`;

/** The keys that come from the whole history when it is read. */
export const DERIVED_PREFIXES = (address: string) => [
  `xpay:${address}:`,
  `xassets:${address}`,
  `xlinks:${address}`,
  // The trade offers it made (portalTrades.ts).
  `xatrows:${address}`,
];

interface ListShape {
  rows: TxRow[];
  done: boolean;
}

/** Its whole history, newest first, when read to the end; null otherwise. */
export function fullHistory(address: string): TxRow[] | null {
  const list = peekQuery<ListShape>(allListKey(address));
  return list?.done ? list.rows : null;
}

/** How many rows the whole history had when the derived keys were last refreshed. */
const seen = new Map<string, number>();

/**
 * The All list was read: when it has reached its end and holds rows the
 * derived keys haven't seen, mark them stale (views read them again, from
 * the whole history now).
 */
export function noteAllList(address: string, list: ListShape): void {
  if (!list.done || seen.get(address) === list.rows.length) return;
  seen.set(address, list.rows.length);
  for (const prefix of DERIVED_PREFIXES(address)) invalidate(prefix);
}

/** Tests start with nothing seen. */
export function resetFullHistory(): void {
  seen.clear();
}

/** Its QORT payments, newest first: those it sent (`sent`) or received (`recv`). */
export function paymentsFrom(
  rows: readonly TxRow[],
  address: string,
  direction: 'sent' | 'recv'
): { rows: TxRow[]; nextOffset: number; done: true } {
  const list = rows.filter(
    (row) =>
      row.type === 'PAYMENT' &&
      (direction === 'sent' ? row.creatorAddress === address : row.recipient === address)
  );
  return { rows: list, nextOffset: list.length, done: true };
}

/** Its asset transfers and multi-payments, newest first. */
export function assetTransfersFrom(rows: readonly TxRow[]): TxRow[] {
  return rows.filter((row) => row.type === 'TRANSFER_ASSET' || row.type === 'MULTI_PAYMENT');
}

/** Its rows of `types`, newest first. */
export function rowsOfTypes(rows: readonly TxRow[], types: readonly string[]): TxRow[] {
  const wanted = new Set(types);
  return rows.filter((row) => wanted.has(String(row.type)));
}
