/**
 * Q-Asset trades between accounts (Simon, 2026-10-21: "both connections and
 * transactions is missing Q-Assets sales and buys"). A trade isn't a
 * transaction between two accounts: each places its own order
 * (CREATE_ASSET_ORDER; the order's id is that transaction's signature) and
 * Core matches them, recording the trade against both orders. So who an
 * account traded with is read from its orders:
 *
 * - its orders that were filled at least partly:
 *   `/assets/orders/{address}?includeClosed=…&includeFulfilled=…`, newest
 *   first, 100 a page, up to 5 pages each. Core's two flags are exact
 *   filters (is_closed = X AND is_fulfilled = Y), so three reads: closed
 *   and fulfilled, closed but not fulfilled (cancelled after a part was
 *   filled), and still open (perhaps a part filled);
 * - each filled order's trades, `/assets/order/{id}/trades`, and the other
 *   order of each, `/assets/order/{id}`, for who placed it (`xfills:<id>`;
 *   a trade never changes, so kept for the session);
 * - the two order transactions, as the evidence behind a trade, and the
 *   block it happened in (the later order's).
 *
 * The newest 200 filled orders at most (`xassettrades:<a>`), 4 orders at a time.
 * Nothing here writes.
 */
import type { TxRow } from '../types';
import { getJson, query, seg } from '../core';
import { fetchQuery } from '../query';
import { getTransaction } from '../txs';
import { parseAtomic } from '../../rules/explorer/money';
import type { AssetTrade, TradeSide } from '../../rules/explorer/trades';

const ORDERS_PAGE = 100;
const ORDERS_PAGES = 5;
const TRADES_PAGE = 100;
const TRADES_PAGES = 10;
/** Filled orders read at most, newest first. */
export const FILLED_MAX = 200;
const AT_ONCE = 4;

/** An order, as `/assets/orders/{address}` and `/assets/order/{id}` answer. */
interface OrderRow {
  orderId: string;
  creator?: string;
  haveAssetId: number;
  wantAssetId: number;
  haveAssetName?: string;
  wantAssetName?: string;
  fulfilled: string;
  timestamp: number;
}

/** A trade, as `/assets/order/{id}/trades` answers. */
interface TradeRow {
  initiatingOrderId: string;
  targetOrderId: string;
  targetAmount: string;
  initiatorAmount: string;
  timestamp: number;
  targetAmountAssetId?: number;
  targetAmountAssetName?: string;
  initiatorAmountAssetId?: number;
  initiatorAmountAssetName?: string;
}

export interface AccountTrades {
  /** Every trade of its filled orders read, newest first. */
  trades: AssetTrade[];
  /** Filled orders read. */
  orders: number;
  /** More filled orders than were read. */
  truncated: boolean;
}

export const tradesKey = (address: string) => `xassettrades:${address}`;
export const fillsKey = (orderId: string) => `xfills:${orderId}`;

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

/** One order (`xorder:<id>`): who placed it never changes. */
function getOrder(orderId: string): Promise<OrderRow | null> {
  return fetchQuery(
    `xorder:${orderId}`,
    async () => {
      try {
        return await getJson<OrderRow>(`/assets/order/${seg(orderId)}`);
      } catch {
        return null;
      }
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** "QORT", or the asset's name, or "asset #6". */
function assetName(id: number | undefined, name: string | undefined): string {
  if (id === 0) return 'QORT';
  return name?.trim() || `asset #${id ?? '?'}`;
}

function side(id: number | undefined, name: string | undefined, amount: string): TradeSide {
  return { assetId: id ?? -1, asset: assetName(id, name), amount };
}

/**
 * One order's trades, each with the other account and the two order
 * transactions (`xfills:<id>`, for the session). `self` is who placed it.
 */
export function getOrderFills(orderId: string, self: string): Promise<AssetTrade[]> {
  return fetchQuery(
    fillsKey(orderId),
    async () => {
      const rows: TradeRow[] = [];
      for (let page = 0; page < TRADES_PAGES; page++) {
        const chunk = await getJson<TradeRow[]>(
          `/assets/order/${seg(orderId)}/trades?${query({ limit: TRADES_PAGE, offset: page * TRADES_PAGE })}`
        );
        const list = Array.isArray(chunk) ? chunk : [];
        rows.push(...list);
        if (list.length < TRADES_PAGE) break;
      }
      const mine = await getTransaction(orderId).catch(() => null);
      const out: AssetTrade[] = [];
      for (const trade of rows) {
        const initiated = trade.initiatingOrderId === orderId;
        const otherOrderId = initiated ? trade.targetOrderId : trade.initiatingOrderId;
        const [other, theirs] = await Promise.all([
          getOrder(otherOrderId),
          getTransaction(otherOrderId).catch(() => null),
        ]);
        const initiator = side(
          trade.initiatorAmountAssetId,
          trade.initiatorAmountAssetName,
          trade.initiatorAmount
        );
        const target = side(
          trade.targetAmountAssetId,
          trade.targetAmountAssetName,
          trade.targetAmount
        );
        // The trade happened when the later order came in: the initiating one.
        const initiating = initiated ? mine : theirs;
        out.push({
          orderId,
          otherOrderId,
          self,
          other: other?.creator ?? null,
          timestamp: trade.timestamp,
          height: initiating?.blockHeight ?? 0,
          initiated,
          // The initiator gave its amount and got the target's.
          gave: initiated ? initiator : target,
          got: initiated ? target : initiator,
          txs: [mine, theirs].filter((tx): tx is TxRow => tx !== null),
        });
      }
      return out;
    },
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

/** Core's exact filters: every order is in one of these (a fulfilled one is closed). */
const ORDER_STATES = [
  { includeClosed: true, includeFulfilled: true },
  { includeClosed: true, includeFulfilled: false },
  { includeClosed: false, includeFulfilled: false },
] as const;

/** Its orders in one state, newest first, up to 500; and whether Core may have more. */
async function readOrdersIn(
  address: string,
  state: (typeof ORDER_STATES)[number]
): Promise<{ orders: OrderRow[]; more: boolean }> {
  const orders: OrderRow[] = [];
  for (let page = 0; page < ORDERS_PAGES; page++) {
    const chunk = await getJson<OrderRow[]>(
      `/assets/orders/${seg(address)}?${query({
        ...state,
        limit: ORDERS_PAGE,
        offset: page * ORDERS_PAGE,
        reverse: true,
      })}`
    );
    const list = Array.isArray(chunk) ? chunk : [];
    orders.push(...list);
    if (list.length < ORDERS_PAGE) return { orders, more: false };
  }
  return { orders, more: true };
}

/** Its orders in every state; and whether Core may have more of one. */
async function readOrders(address: string): Promise<{ orders: OrderRow[]; more: boolean }> {
  const reads = await Promise.all(ORDER_STATES.map((state) => readOrdersIn(address, state)));
  return {
    orders: reads.flatMap((read) => read.orders),
    more: reads.some((read) => read.more),
  };
}

/** Every trade of an account's filled orders (`xassettrades:<a>`), newest first. */
export function getAccountTrades(
  address: string,
  options: { force?: boolean } = {}
): Promise<AccountTrades> {
  return fetchQuery(
    tradesKey(address),
    async () => {
      const { orders, more } = await readOrders(address);
      const filled = orders
        .filter((order) => (parseAtomic(order.fulfilled) ?? 0n) > 0n)
        .sort((a, b) => b.timestamp - a.timestamp);
      const read = filled.slice(0, FILLED_MAX);
      const fills = await inTurn(read, (order) => getOrderFills(order.orderId, address));
      const trades = fills.flat().sort((a, b) => b.timestamp - a.timestamp);
      return { trades, orders: read.length, truncated: more || filled.length > read.length };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
