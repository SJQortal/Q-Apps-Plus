/**
 * The extra reads the QORT summaries need beyond the account's own
 * transactions (rules/explorer/qortBook.ts):
 * - each of its asset orders with QORT on one side: `/assets/order/{id}` and
 *   its trades (`xorderq:<id>`, 30 s; a closed order never changes, so its
 *   answer is kept for the session, while an open one can still fill);
 * - what it bought and sold on the Trade Portal: its completed trades;
 * - whether a reward share ever involved it, for an account without blocks
 *   minted (did it ever mint?).
 * Orders a few at a time, so a trader with many doesn't flood the node.
 */
import { getAccount } from '../accounts';
import { getJson, getText, query, seg } from '../core';
import { fetchQuery } from '../query';
import { heavy } from './heavy';
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

/** Closed orders' QORT, kept for the session: a closed order never changes. */
const closedOrders = new Map<string, bigint>();

/** What one asset order moved in QORT for its maker. */
export function getOrderQort(id: string): Promise<bigint> {
  const closed = closedOrders.get(id);
  if (closed !== undefined) return Promise.resolve(closed);
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
      const value = orderQort(id, order, trades);
      if (order.isClosed || order.isFulfilled) closedOrders.set(id, value);
      return value;
    },
    { ttlMs: 30_000 }
  );
}

/** Its asset orders' QORT, added up (`xordersq:<a>:<count>`). */
export function getOrdersQort(address: string, ids: readonly string[]): Promise<bigint> {
  return fetchQuery(
    `xordersq:${address}:${ids.length}`,
    async () => (await inTurn(ids, getOrderQort)).reduce((sum, value) => sum + value, 0n),
    // As short as the balance's: an open order that filled since moved QORT.
    { ttlMs: 30_000 }
  );
}

/** QORT it bought and sold on the Trade Portal: its completed trades. */
export interface TradesQort {
  bought: bigint;
  sold: bigint;
  /**
   * It has no public key (it never made a transaction): what it bought is
   * what other accounts' trade contracts paid it, from its own history.
   */
  keyless?: true;
}

/** Rows a page of its trade contracts' payments to it. */
const AT_PAGE = 100;

/**
 * What other accounts' trade contracts (ATs) paid an account, in QORT: a
 * Q-Trade buyer's QORT comes from the seller's contract to the buyer's
 * receiving address. For an account without a public key, which Core's
 * trade list can't be asked about.
 */
async function paidByContracts(address: string): Promise<bigint> {
  let total = 0n;
  const seen = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await getJson<Array<Record<string, unknown>>>(
      `/transactions/search?${query({
        txType: 'AT',
        address,
        confirmationStatus: 'CONFIRMED',
        limit: AT_PAGE,
        offset: page * AT_PAGE,
      })}`
    );
    if (!Array.isArray(rows)) throw new Error('Unexpected answer for its contract payments');
    for (const tx of rows) {
      const signature = String(tx?.signature ?? '');
      if (!signature || seen.has(signature)) continue;
      seen.add(signature);
      const assetId = tx.assetId === undefined || tx.assetId === null ? 0 : Number(tx.assetId);
      if (tx.recipient === address && assetId === 0) total += parseAtomic(tx.amount) ?? 0n;
    }
    if (rows.length < AT_PAGE) break;
  }
  return total;
}

/**
 * QORT it bought and sold on the Trade Portal (`xtrades:<a>`): its
 * completed trades as the buyer and as the seller, every chain, from
 * `/crosschain/trades?buyerPublicKey=` and `?sellerPublicKey=`. Without a
 * public key (it never made a transaction) Core's list can't be asked: what
 * other accounts' trade contracts paid it is what it bought, and it sold
 * nothing (selling deploys a contract, a transaction of its own).
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
      if (!publicKey)
        return { bought: await paidByContracts(address), sold: 0n, keyless: true as const };
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

/**
 * Whether any reward share ever involved it (`xevershare:<a>`): one row is
 * enough. An account with no blocks minted may still have minted: moving
 * its minting level to another account (TRANSFER_PRIVS) sets its blocks
 * minted to 0, but its reward shares stay in its history.
 */
export function getEverRewardShare(
  address: string,
  options: { force?: boolean } = {}
): Promise<boolean> {
  return fetchQuery(
    `xevershare:${address}`,
    async () => {
      const rows = await getJson<unknown[]>(
        `/transactions/search?${query({
          txType: 'REWARD_SHARE',
          address,
          confirmationStatus: 'CONFIRMED',
          limit: 1,
        })}`
      );
      if (!Array.isArray(rows)) throw new Error('Unexpected answer for its reward shares');
      return rows.length > 0;
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** Its balance, and the newest of its confirmed transactions when it was read. */
export interface TiedBalance {
  /** Atomic QORT. */
  balance: bigint;
  /** That transaction's signature; null with none. */
  newest: string | null;
}

/** How often the balance is read again when a transaction came between. */
const TIE_TRIES = 3;

/** The signature of its newest confirmed transaction (null: none), a one-row heavy read. */
function newestSignature(address: string): Promise<string | null> {
  return heavy(address, async () => {
    const rows = await getJson<Array<{ signature?: unknown }>>(
      `/transactions/search?${query({
        address,
        confirmationStatus: 'CONFIRMED',
        limit: 1,
        reverse: true,
      })}`
    );
    if (!Array.isArray(rows)) throw new Error('Unexpected answer for its newest transaction');
    return rows[0]?.signature ? String(rows[0].signature) : null;
  });
}

/** Its QORT balance, exactly, in atomic units. */
async function balanceNow(address: string): Promise<bigint> {
  const text = (await getText(`/addresses/balance/${seg(address)}`)).trim();
  const value = parseAtomic(text);
  if (value === null) throw new Error(`Unexpected balance "${text}"`);
  return value;
}

/**
 * Its QORT balance, tied to its transactions (`xbalance:<a>`, 30 s): read
 * between two reads of its newest confirmed transaction, and kept only when
 * both are the same one, so QORT minted (its balance less what its
 * transactions moved) takes no transaction that came between the balance
 * and the list (Hub's Explorer port, 2026-11-22). The caller checks
 * `newest` against the list it adds up. Tried 3 times; a reward for a
 * block it minted changes the balance without a transaction, which is
 * what QORT minted counts anyway.
 */
export function getTiedBalance(
  address: string,
  options: { force?: boolean } = {}
): Promise<TiedBalance> {
  return fetchQuery(
    `xbalance:${address}`,
    async () => {
      for (let attempt = 0; attempt < TIE_TRIES; attempt++) {
        const before = await newestSignature(address);
        const balance = await balanceNow(address);
        const after = await newestSignature(address);
        if (before === after) return { balance, newest: after };
      }
      throw new Error('Its transactions kept changing while its balance was read.');
    },
    { ttlMs: 30_000, force: options.force }
  );
}
