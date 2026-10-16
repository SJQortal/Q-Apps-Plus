/**
 * An account's name transactions: the names it registered, renamed or
 * changed, listed for sale, took off sale, bought, and the ones it sold
 * (Core's search by address finds a BUY_NAME's seller too). Core has no
 * history by name, so this is the account's side only.
 *
 * One page, newest first: `/transactions/search?address=<a>&txType=…`
 * (repeated txType; a comma list is refused) with `limit=100`. A search by
 * address is one of Core's heavy reads, so it goes through the Explorer's
 * limiter with the account as its scope. Kept 10 minutes under
 * `xnamehist:<address>`.
 */
import { getJson, query } from '../core';
import { type FetchOptions } from '../query';
import type { TxRow } from '../types';
import { heavyQuery } from './heavy';

export const NAME_TX_TYPES = [
  'REGISTER_NAME',
  'UPDATE_NAME',
  'SELL_NAME',
  'CANCEL_SELL_NAME',
  'BUY_NAME',
] as const;

/** One read's rows: the newest this many. */
export const NAME_HISTORY_LIMIT = 100;

export interface NameHistory {
  /** Newest first, as Core answers them. */
  rows: TxRow[];
  /** Core had this page full: there may be older ones. */
  capped: boolean;
}

export function nameHistoryKey(address: string): string {
  return `xnamehist:${address}`;
}

export function getNameHistory(
  address: string,
  options: Pick<FetchOptions, 'force'> = {}
): Promise<NameHistory> {
  return heavyQuery(
    address,
    nameHistoryKey(address),
    async () => {
      const body = await getJson<unknown>(
        `/transactions/search?${query({
          address,
          txType: NAME_TX_TYPES,
          confirmationStatus: 'CONFIRMED',
          limit: NAME_HISTORY_LIMIT,
          reverse: true,
        })}`
      );
      const all = Array.isArray(body) ? (body as TxRow[]) : [];
      const rows = all.filter(
        (row) => Boolean(row) && typeof row.signature === 'string' && typeof row.type === 'string'
      );
      return { rows, capped: all.length >= NAME_HISTORY_LIMIT };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
