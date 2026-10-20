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
 * `xnamehist:<address>`. On request (the Names tab's "Read its whole name
 * history"), up to 10 pages, 1,000 name transactions, one after another:
 * `xnamehist:<address>:10`.
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
/** Pages read when the whole history is asked for. */
export const NAME_HISTORY_PAGES_ALL = 10;

export interface NameHistory {
  /** Newest first, as Core answers them. */
  rows: TxRow[];
  /** Core had this page full: there may be older ones. */
  capped: boolean;
  /** How many name transactions were asked for: 100, or 1,000 for the whole history. */
  limit: number;
}

export function nameHistoryKey(address: string, pages = 1): string {
  return pages === 1 ? `xnamehist:${address}` : `xnamehist:${address}:${pages}`;
}

export function getNameHistory(
  address: string,
  options: Pick<FetchOptions, 'force'> & { pages?: number } = {}
): Promise<NameHistory> {
  const pages = options.pages ?? 1;
  return heavyQuery(
    address,
    nameHistoryKey(address, pages),
    async () => {
      const rows: TxRow[] = [];
      let capped = false;
      for (let page = 0; page < pages; page += 1) {
        const body = await getJson<unknown>(
          `/transactions/search?${query({
            address,
            txType: NAME_TX_TYPES,
            confirmationStatus: 'CONFIRMED',
            limit: NAME_HISTORY_LIMIT,
            offset: page ? page * NAME_HISTORY_LIMIT : undefined,
            reverse: true,
          })}`
        );
        const all = Array.isArray(body) ? (body as TxRow[]) : [];
        rows.push(
          ...all.filter(
            (row) =>
              Boolean(row) && typeof row.signature === 'string' && typeof row.type === 'string'
          )
        );
        capped = all.length >= NAME_HISTORY_LIMIT;
        if (!capped) break;
      }
      return { rows, capped, limit: pages * NAME_HISTORY_LIMIT };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
