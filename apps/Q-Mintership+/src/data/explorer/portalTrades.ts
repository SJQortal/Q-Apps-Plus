/**
 * An account's Q-Trade trades (the Trade Portal's before it), for the
 * Explorer's Trades tab; rules/explorer/portalTrades.ts adds them up.
 *
 * - Its completed trades, every chain, as the seller and as the buyer:
 *   `/crosschain/trades?foreignBlockchain=<chain>&sellerPublicKey=<pk>` and
 *   `…&buyerPublicKey=<pk>` (`xportal:<a>`, 10 minutes). Core's answer
 *   doesn't name the coin, so one read per chain does. Each is one read
 *   without a limit, as Core pages this list badly (qortBook.ts). The
 *   seller's take milliseconds; the buyer's search every contract's payouts
 *   (yopilax, 2026-10-26: 2.2 s for the six). Three at a time. None without
 *   a public key (it never made a transaction).
 * - The trade offers it made: its DEPLOY_AT transactions (each one AT; the
 *   tags name the coin, "ACCT QORT LTC") and the AT payouts it received (a
 *   finished AT pays what it holds back to its creator). From its whole
 *   history when that is read (fullHistory.ts), else two address searches
 *   by type, pages of 1,000 through the heavy-read limiter, up to 5,000
 *   offers and 10,000 payouts (`xatrows:<a>`); the payouts only when it
 *   made an offer. yopilax: 1,154 offers and 1,169 payouts, about 4 s.
 *
 * An offer Core lists as a sale completed; one that paid back otherwise
 * ended; the rest are still open. On yopilax's 1,154 Core's own states
 * agreed: 678 REDEEMED, 475 ended (a sample of 25, all CANCELLED), 1 TRADING.
 *
 * All GET, cached, none polled.
 */
import type { TxRow } from '../types';
import { getAccount } from '../accounts';
import { getJson, query } from '../core';
import { fetchQuery } from '../query';
import { heavyQuery } from './heavy';
import { fullHistory } from './fullHistory';
import { parseAtomic } from '../../rules/explorer/money';
import {
  chainOfOffer,
  TRADE_CHAINS,
  type OfferDeployed,
  type PortalSide,
  type PortalTrade,
  type TradeChain,
} from '../../rules/explorer/portalTrades';

const TTL_MS = 10 * 60_000;
const AT_ONCE = 3;
const PAGE = 1000;
const OFFER_PAGES = 5;
const PAYOUT_PAGES = 10;

export const portalKey = (address: string) => `xportal:${address}`;
export const atRowsKey = (address: string) => `xatrows:${address}`;

/** A completed trade, as `/crosschain/trades` answers. */
interface TradeSummaryRow {
  tradeTimestamp?: unknown;
  qortAmount?: unknown;
  foreignAmount?: unknown;
  btcAmount?: unknown;
  atAddress?: unknown;
  sellerAddress?: unknown;
  buyerReceivingAddress?: unknown;
}

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

const SIDE_KEY: Record<PortalSide, 'sellerPublicKey' | 'buyerPublicKey'> = {
  sold: 'sellerPublicKey',
  bought: 'buyerPublicKey',
};

/** One chain's trades on one side; each AT once (a buyer paid twice by one AT is listed twice). */
async function readSide(
  publicKey: string,
  chain: TradeChain,
  side: PortalSide
): Promise<PortalTrade[]> {
  const body = await getJson<unknown>(
    `/crosschain/trades?${query({ foreignBlockchain: chain, [SIDE_KEY[side]]: publicKey })}`
  );
  const seen = new Set<string>();
  const out: PortalTrade[] = [];
  for (const row of Array.isArray(body) ? (body as TradeSummaryRow[]) : []) {
    const at = typeof row?.atAddress === 'string' ? row.atAddress : '';
    if (!at || seen.has(at)) continue;
    seen.add(at);
    const other = side === 'sold' ? row.buyerReceivingAddress : row.sellerAddress;
    out.push({
      chain,
      side,
      qort: parseAtomic(row.qortAmount) ?? 0n,
      coin: parseAtomic(row.foreignAmount ?? row.btcAmount) ?? 0n,
      at,
      other: typeof other === 'string' ? other : '',
      timestamp: Number(row.tradeTimestamp ?? 0),
    });
  }
  return out;
}

/** Its completed trades on every chain, both sides, newest first. */
export function getPortalTrades(
  address: string,
  options: { force?: boolean } = {}
): Promise<PortalTrade[]> {
  return fetchQuery(
    portalKey(address),
    async () => {
      // Its public key from its account (`account:<a>`, read for the page anyway).
      const publicKey = (await getAccount(address)).publicKey;
      if (!publicKey) return [];
      const reads = TRADE_CHAINS.flatMap((chain) =>
        (['sold', 'bought'] as const).map((side) => ({ chain, side }))
      );
      const lists = await inTurn(reads, ({ chain, side }) => readSide(publicKey, chain, side));
      return lists.flat().sort((a, b) => b.timestamp - a.timestamp);
    },
    { ttlMs: TTL_MS, force: options.force }
  );
}

/** The offers it made and the ATs that paid it, as far as they were read. */
export interface AtRows {
  /** Newest first. */
  deployed: OfferDeployed[];
  paidBack: string[];
  /** It made more offers, or had more payouts, than were read. */
  truncated: boolean;
}

/** A trade offer: an ACCT contract (Core's cross-chain trade). */
const isTradeOffer = (row: TxRow) =>
  row.aTType === 'ACCT' || /\bACCT\b/.test(String(row.tags ?? ''));

/** The offers and payouts among `rows` (its own transactions). */
export function atRowsOf(rows: readonly TxRow[], address: string, truncated: boolean): AtRows {
  const deployed: OfferDeployed[] = [];
  const paidBack = new Set<string>();
  for (const row of rows) {
    if (
      row.type === 'DEPLOY_AT' &&
      row.creatorAddress === address &&
      typeof row.aTAddress === 'string' &&
      isTradeOffer(row)
    )
      deployed.push({
        at: row.aTAddress,
        chain: chainOfOffer(row.tags, row.name),
        qort: parseAtomic(row.amount) ?? 0n,
        timestamp: row.timestamp,
      });
    else if (row.type === 'AT' && row.recipient === address && typeof row.atAddress === 'string')
      paidBack.add(row.atAddress);
  }
  deployed.sort((a, b) => b.timestamp - a.timestamp);
  return { deployed, paidBack: [...paidBack], truncated };
}

/** Its transactions of one type, newest first, `pages` of 1,000 at most; and whether there are more. */
async function readType(
  address: string,
  txType: string,
  pages: number
): Promise<{ rows: TxRow[]; more: boolean }> {
  const rows: TxRow[] = [];
  for (let page = 0; page < pages; page++) {
    const chunk = await getJson<TxRow[]>(
      `/transactions/search?${query({
        address,
        txType,
        confirmationStatus: 'CONFIRMED',
        limit: PAGE,
        offset: page * PAGE,
        reverse: true,
      })}`
    );
    const list = Array.isArray(chunk) ? chunk : [];
    rows.push(...list);
    if (list.length < PAGE) return { rows, more: false };
  }
  return { rows, more: true };
}

/** The trade offers it made and the payouts it received (`xatrows:<a>`). */
export function getAtRows(address: string, options: { force?: boolean } = {}): Promise<AtRows> {
  return heavyQuery(
    address,
    atRowsKey(address),
    async () => {
      const all = fullHistory(address);
      if (all) return atRowsOf(all, address, false);
      const offers = await readType(address, 'DEPLOY_AT', OFFER_PAGES);
      if (!offers.rows.length) return { deployed: [], paidBack: [], truncated: false };
      const payouts = await readType(address, 'AT', PAYOUT_PAGES);
      return atRowsOf([...offers.rows, ...payouts.rows], address, offers.more || payouts.more);
    },
    { ttlMs: TTL_MS, force: options.force }
  );
}
