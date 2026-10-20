/**
 * The extra reads the QORT summaries need beyond the account's own
 * transactions (rules/explorer/qortBook.ts):
 * - each of its asset orders with QORT on one side: `/assets/order/{id}` and
 *   its trades (`xorderq:<id>`; a closed order never changes, so kept for
 *   the session);
 * - what it bought and sold on the Trade Portal: its completed trades.
 * Orders a few at a time, so a trader with many doesn't flood the node.
 */
import { getAccount } from '../accounts';
import { getJson, getText, query, seg } from '../core';
import { fetchQuery } from '../query';
import { parseAtomic } from '../../rules/explorer/money';
import { orderQort, type OrderState, type OrderTrade } from '../../rules/explorer/qortBook';

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

/** QORT it bought and sold on the Trade Portal: its completed trades. */
export interface TradesQort {
  bought: bigint;
  sold: bigint;
}

/**
 * QORT it bought and sold on the Trade Portal (`xtrades:<a>`): its
 * completed trades as the buyer and as the seller, every chain, from
 * `/crosschain/trades?buyerPublicKey=` and `?sellerPublicKey=`. None
 * without a public key (it never made a transaction).
 *
 * Each is one read without a limit, on purpose: Core pages this list badly
 * (limit and offset apply to each contract version, at most 100, and its
 * pages repeat and skip rows: for yopilax, pages of 100 gave 431 trades,
 * 100 of them twice, where the whole list has 678). Scoped to one account,
 * it is about 250 bytes a trade: half a second for yopilax's 678.
 */
export function getTradesQort(address: string): Promise<TradesQort> {
  return fetchQuery(
    `xtrades:${address}`,
    async () => {
      // Its public key from its account (`account:<a>`, read for the profile anyway).
      const publicKey = (await getAccount(address)).publicKey;
      if (!publicKey) return { bought: 0n, sold: 0n };
      const sum = async (side: 'buyerPublicKey' | 'sellerPublicKey') => {
        const list = await getJson<Array<{ qortAmount?: unknown; atAddress?: unknown }>>(
          `/crosschain/trades?${query({ [side]: publicKey })}`
        );
        let total = 0n;
        const seen = new Set<string>();
        for (const trade of Array.isArray(list) ? list : []) {
          const at = String(trade?.atAddress ?? '');
          if (at && seen.has(at)) continue;
          seen.add(at);
          total += parseAtomic(trade?.qortAmount) ?? 0n;
        }
        return total;
      };
      const [bought, sold] = await Promise.all([sum('buyerPublicKey'), sum('sellerPublicKey')]);
      return { bought, sold };
    },
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
