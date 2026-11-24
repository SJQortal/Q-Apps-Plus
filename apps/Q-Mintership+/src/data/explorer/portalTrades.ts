/**
 * An account's Q-Trade trades (the Trade Portal's before it), for the
 * Explorer's Trades tab; rules/explorer/portalTrades.ts adds them up.
 *
 * - Its completed trades, every chain, as the seller and as the buyer:
 *   `/crosschain/trades?sellerPublicKey=<pk>` and `…?buyerPublicKey=<pk>`
 *   (`xportalall:<side>:<pk>`, shared with QORT purchased / sold), the
 *   trades it lists (`xportal:<a>`, 10 minutes). Core's answer doesn't name
 *   the coin, so one read per chain of TRADE_CHAINS names each trade's
 *   (`foreignBlockchain=<chain>`); a trade none names is "another coin", a
 *   chain Core added since (Hub's Explorer port, 2026-11-22: it was in the
 *   totals but not listed). Each is one read without a limit, as Core pages
 *   this list badly (qortBook.ts). The seller's take milliseconds; the
 *   buyer's search every contract's payouts (yopilax, 2026-10-26: 2.2 s for
 *   the six). Three at a time.
 * - An account without a public key (it never made a transaction) can't be
 *   asked by key: its purchases are what other accounts' trade contracts
 *   paid it (`xatpaid:<a>`), each a trade of another coin.
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
  type TradeCoin,
} from '../../rules/explorer/portalTrades';

const TTL_MS = 10 * 60_000;
const AT_ONCE = 3;
const PAGE = 1000;
const OFFER_PAGES = 5;
const PAYOUT_PAGES = 10;

export const portalKey = (address: string) => `xportal:${address}`;

/** A list Core answered with something else: a failed read, never "none" (Hub's Explorer port). */
function asList<T>(body: unknown, what: string): T[] {
  if (!Array.isArray(body)) throw new Error(`Unexpected answer for ${what}`);
  return body as T[];
}

/**
 * Every chain's completed trades on one side, as Core lists them
 * (`xportalall:<side>:<pk>`): what QORT purchased / sold adds up, and the
 * trades the Trades tab lists.
 */
export function getPortalRowsAll(
  publicKey: string,
  side: PortalSide,
  options: { force?: boolean } = {}
): Promise<TradeSummaryRow[]> {
  return fetchQuery(
    `xportalall:${side}:${publicKey}`,
    async () =>
      asList<TradeSummaryRow>(
        await getJson<unknown>(`/crosschain/trades?${query({ [SIDE_KEY[side]]: publicKey })}`),
        'its trades'
      ),
    { ttlMs: TTL_MS, force: options.force }
  );
}

/** One payment of another account's trade contract (an AT) to it. */
export interface ContractPayment {
  at: string;
  /** Atomic QORT. */
  qort: bigint;
  timestamp: number;
  signature: string;
}

/** Rows a page of its contract payments. */
const AT_PAGE = 100;
const AT_PAGES = 10;

/**
 * What other accounts' trade contracts paid an account (`xatpaid:<a>`): a
 * Q-Trade buyer's QORT comes from the seller's contract to its receiving
 * address. For an account without a public key, which Core's trade list
 * can't be asked about (Hub's Explorer port, 2026-11-22).
 */
export function getContractPayments(
  address: string,
  options: { force?: boolean } = {}
): Promise<ContractPayment[]> {
  return fetchQuery(
    `xatpaid:${address}`,
    async () => {
      const out: ContractPayment[] = [];
      const seen = new Set<string>();
      for (let page = 0; page < AT_PAGES; page++) {
        const rows = asList<Record<string, unknown>>(
          await getJson<unknown>(
            `/transactions/search?${query({
              txType: 'AT',
              address,
              confirmationStatus: 'CONFIRMED',
              limit: AT_PAGE,
              offset: page * AT_PAGE,
            })}`
          ),
          'its contract payments'
        );
        for (const tx of rows) {
          const signature = String(tx?.signature ?? '');
          if (!signature || seen.has(signature)) continue;
          seen.add(signature);
          const assetId = tx.assetId === undefined || tx.assetId === null ? 0 : Number(tx.assetId);
          if (tx.recipient !== address || assetId !== 0) continue;
          out.push({
            at: String(tx.atAddress ?? tx.creatorAddress ?? ''),
            qort: parseAtomic(tx.amount) ?? 0n,
            timestamp: Number(tx.timestamp) > 0 ? Number(tx.timestamp) : 0,
            signature,
          });
        }
        if (rows.length < AT_PAGE) break;
      }
      return out;
    },
    { ttlMs: TTL_MS, force: options.force }
  );
}

/** A trade from Core's row, its coin as named; null without its AT. */
function toTrade(row: TradeSummaryRow, side: PortalSide, chain: TradeCoin): PortalTrade | null {
  const at = typeof row?.atAddress === 'string' ? row.atAddress : '';
  if (!at) return null;
  const other = side === 'sold' ? row.buyerReceivingAddress : row.sellerAddress;
  return {
    chain,
    side,
    qort: parseAtomic(row.qortAmount) ?? 0n,
    coin: parseAtomic(row.foreignAmount ?? row.btcAmount) ?? 0n,
    at,
    other: typeof other === 'string' ? other : '',
    // No time from Core: 0, never 1 January 1970 (Hub's Explorer port).
    timestamp: Number(row.tradeTimestamp) > 0 ? Number(row.tradeTimestamp) : 0,
  };
}
export const atRowsKey = (address: string) => `xatrows:${address}`;

/** A completed trade, as `/crosschain/trades` answers. */
export interface TradeSummaryRow {
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

/** Which of its trades on one side one chain has: their ATs. */
async function atsOn(publicKey: string, chain: TradeChain, side: PortalSide): Promise<string[]> {
  const rows = asList<TradeSummaryRow>(
    await getJson<unknown>(
      `/crosschain/trades?${query({ foreignBlockchain: chain, [SIDE_KEY[side]]: publicKey })}`
    ),
    'its trades'
  );
  return rows.flatMap((row) => (typeof row?.atAddress === 'string' ? [row.atAddress] : []));
}

/** Its completed trades on every chain, both sides, newest first (those with no time last). */
export function getPortalTrades(
  address: string,
  options: { force?: boolean } = {}
): Promise<PortalTrade[]> {
  return fetchQuery(
    portalKey(address),
    async () => {
      const force = options.force;
      // Its public key from its account (`account:<a>`, read for the page anyway).
      const publicKey = (await getAccount(address)).publicKey;
      const trades: PortalTrade[] = [];
      if (!publicKey) {
        // A buyer without a key: each payment of another account's contract, one trade.
        for (const paid of await getContractPayments(address, { force }))
          trades.push({
            chain: 'OTHER',
            side: 'bought',
            qort: paid.qort,
            coin: 0n,
            at: paid.at,
            other: '',
            timestamp: paid.timestamp,
          });
      } else {
        const [sold, bought] = await Promise.all([
          getPortalRowsAll(publicKey, 'sold', { force }),
          getPortalRowsAll(publicKey, 'bought', { force }),
        ]);
        // Each trade's coin: the chain whose read lists its AT on that side.
        const reads = TRADE_CHAINS.flatMap((chain) =>
          (['sold', 'bought'] as const).map((side) => ({ chain, side }))
        );
        const lists = await inTurn(reads, ({ chain, side }) => atsOn(publicKey, chain, side));
        const chainOf = new Map<string, TradeChain>();
        reads.forEach(({ chain, side }, i) => {
          for (const at of lists[i]) chainOf.set(`${side}:${at}`, chain);
        });
        for (const [side, rows] of [
          ['sold', sold],
          ['bought', bought],
        ] as const) {
          // Each AT once on a side (a buyer paid twice by one AT is listed twice).
          const seen = new Set<string>();
          for (const row of rows) {
            const at = typeof row?.atAddress === 'string' ? row.atAddress : '';
            if (!at || seen.has(at)) continue;
            seen.add(at);
            const trade = toTrade(row, side, chainOf.get(`${side}:${at}`) ?? 'OTHER');
            if (trade) trades.push(trade);
          }
        }
      }
      return trades.sort((a, b) => (b.timestamp || -1) - (a.timestamp || -1));
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
  /** The payouts read stopped short: the oldest one read (ms); null when all were read. */
  payoutsFrom?: number | null;
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
    const list = asList<TxRow>(chunk, 'its transactions');
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
      return {
        ...atRowsOf([...offers.rows, ...payouts.rows], address, offers.more || payouts.more),
        payoutsFrom:
          payouts.more && payouts.rows.length
            ? Math.min(...payouts.rows.map((row) => row.timestamp))
            : null,
      };
    },
    { ttlMs: TTL_MS, force: options.force }
  );
}
