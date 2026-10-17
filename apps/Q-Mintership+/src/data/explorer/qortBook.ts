/**
 * The extra reads the QORT summaries need beyond the account's own
 * transactions (rules/explorer/qortBook.ts):
 * - each of its asset orders with QORT on one side: `/assets/order/{id}` and
 *   its trades (`xorderq:<id>`; a closed order never changes, so kept for
 *   the session);
 * - each of its own trade contracts' payouts: an address search of the AT
 *   (`xatpay:<at>`, a few rows; 10 minutes).
 * A few at a time, so a trader with many doesn't flood the node.
 */
import type { TxRow } from '../types';
import { getJson, getText, query, seg } from '../core';
import { fetchQuery } from '../query';
import { parseAtomic } from '../../rules/explorer/money';
import {
  orderQort,
  soldQort,
  type OrderState,
  type OrderTrade,
} from '../../rules/explorer/qortBook';

const PAGE = 100;
const MAX_PAGES = 10;
const AT_ONCE = 4;

/** Runs `work` on each item, `AT_ONCE` at a time; the answers in order. */
async function inTurn<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, lane));
  return out;
}

/** What one asset order moved in QORT for its maker. */
export function getOrderQort(id: string): Promise<bigint> {
  return fetchQuery(
    `xorderq:${id}`,
    async () => {
      const order = await getJson<OrderState>(`/assets/order/${seg(id)}`);
      const trades: OrderTrade[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const chunk = await getJson<OrderTrade[]>(
          `/assets/order/${seg(id)}/trades?${query({ limit: PAGE, offset: page * PAGE })}`
        );
        const list = Array.isArray(chunk) ? chunk : [];
        trades.push(...list);
        if (list.length < PAGE) break;
      }
      return orderQort(id, order, trades);
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** Its asset orders' QORT, added up (`xordersq:<a>:<count>`). */
export function getOrdersQort(address: string, ids: readonly string[]): Promise<bigint> {
  return fetchQuery(
    `xordersq:${address}:${ids.length}`,
    async () => (await inTurn(ids, getOrderQort)).reduce((sum, value) => sum + value, 0n),
    { ttlMs: 10 * 60_000 }
  );
}

/** One contract's AT transactions: what it paid out. */
export function getAtPayouts(atAddress: string): Promise<TxRow[]> {
  return fetchQuery(
    `xatpay:${atAddress}`,
    async () => {
      const rows: TxRow[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const chunk = await getJson<TxRow[]>(
          `/transactions/search?${query({
            address: atAddress,
            txType: 'AT',
            confirmationStatus: 'CONFIRMED',
            limit: PAGE,
            offset: page * PAGE,
          })}`
        );
        const list = Array.isArray(chunk) ? chunk : [];
        rows.push(...list);
        if (list.length < PAGE) break;
      }
      return rows;
    },
    { ttlMs: 10 * 60_000 }
  );
}

/** All its own contracts' payouts. */
export async function getOwnAtPayouts(ats: readonly string[]): Promise<TxRow[]> {
  return (await inTurn(ats, getAtPayouts)).flat();
}

/** QORT its own contracts paid to buyers (`xsold:<a>:<count>`). */
export function getSoldQort(address: string, ats: readonly string[]): Promise<bigint> {
  return fetchQuery(
    `xsold:${address}:${ats.length}`,
    async () => soldQort(await getOwnAtPayouts(ats), address),
    { ttlMs: 10 * 60_000 }
  );
}

/** Its QORT balance, exactly, in atomic units (`xbalance:<a>`, 30 s). */
export function getBalanceAtomic(
  address: string,
  options: { force?: boolean } = {}
): Promise<bigint> {
  return fetchQuery(
    `xbalance:${address}`,
    async () => {
      const text = (await getText(`/addresses/balance/${seg(address)}`)).trim();
      const value = parseAtomic(text);
      if (value === null) throw new Error(`Unexpected balance "${text}"`);
      return value;
    },
    { ttlMs: 30_000, force: options.force }
  );
}
