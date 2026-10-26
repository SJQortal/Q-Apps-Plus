/**
 * Q-Trade in figures, for the Explorer's Trades tab (Simon, 2026-10-26: "an
 * overview of Q-Trades and Q-Asset trades the user made, summary, and then
 * at the bottom very nice breakdown of the trades, so it is easely visible
 * how many QORT were sold for LTC and other coins, how many ATs were made"):
 * an account's completed cross-chain trades (data/explorer/portalTrades.ts
 * reads them) added up by coin, by side and over time, and the trade offers
 * it made, each an AT holding the QORT it offered, by how each ended.
 *
 * Amounts are atomic units: QORT, and each coin as Core writes it, with 8
 * decimals. Pure.
 */
import { formatAtomic } from './money';

/** The chains Core trades QORT with, in the order their colours go (coinAccent.ts). */
export const TRADE_CHAINS = [
  'LITECOIN',
  'BITCOIN',
  'DIGIBYTE',
  'DOGECOIN',
  'RAVENCOIN',
  'PIRATECHAIN',
] as const;
export type TradeChain = (typeof TRADE_CHAINS)[number];

export const COINS: Record<TradeChain, { code: string; name: string }> = {
  LITECOIN: { code: 'LTC', name: 'Litecoin' },
  BITCOIN: { code: 'BTC', name: 'Bitcoin' },
  DIGIBYTE: { code: 'DGB', name: 'DigiByte' },
  DOGECOIN: { code: 'DOGE', name: 'Dogecoin' },
  RAVENCOIN: { code: 'RVN', name: 'Ravencoin' },
  PIRATECHAIN: { code: 'ARRR', name: 'Pirate Chain' },
};

const CHAIN_OF_CODE = new Map<string, TradeChain>(
  TRADE_CHAINS.map((chain) => [COINS[chain].code, chain])
);

/** A trade offer's coin, from its DEPLOY_AT's tags ("ACCT QORT LTC") or name ("QORT/LTC ACCT"). */
export function chainOfOffer(tags: unknown, name?: unknown): TradeChain | null {
  const words = `${String(tags ?? '')} ${String(name ?? '')}`.toUpperCase().split(/[\s/]+/);
  for (const word of words) {
    const chain = CHAIN_OF_CODE.get(word);
    if (chain) return chain;
  }
  return null;
}

/** It sold QORT (its own offer was taken) or bought it (it took someone else's). */
export type PortalSide = 'sold' | 'bought';

export interface PortalTrade {
  chain: TradeChain;
  side: PortalSide;
  qort: bigint;
  /** The coin paid for the QORT. */
  coin: bigint;
  /** The trade's AT. */
  at: string;
  /** Who bought (where the QORT went) or who sold; '' when Core didn't say. */
  other: string;
  timestamp: number;
}

export interface SideTotals {
  count: number;
  qort: bigint;
  coin: bigint;
}

export interface CoinTotals {
  chain: TradeChain;
  sold: SideTotals;
  bought: SideTotals;
  first: number;
  last: number;
}

export interface Partner {
  address: string;
  /** Trades in which it sold to them, and bought from them. */
  sold: number;
  bought: number;
  qort: bigint;
}

export interface PortalSummary {
  /** The coins it traded, in TRADE_CHAINS order. */
  coins: CoinTotals[];
  sold: SideTotals;
  bought: SideTotals;
  /** Its first and latest trade; null with none. */
  first: number | null;
  last: number | null;
  /** By QORT; the earlier of two the same size. */
  biggestSale: PortalTrade | null;
  biggestBuy: PortalTrade | null;
  /** Everyone it traded with, most trades first, then most QORT. */
  partners: Partner[];
}

const noSide = (): SideTotals => ({ count: 0, qort: 0n, coin: 0n });

function addTo(totals: SideTotals, trade: PortalTrade): void {
  totals.count += 1;
  totals.qort += trade.qort;
  totals.coin += trade.coin;
}

const bigger = (a: PortalTrade | null, b: PortalTrade): PortalTrade =>
  !a || b.qort > a.qort || (b.qort === a.qort && b.timestamp < a.timestamp) ? b : a;

export function summarisePortal(trades: readonly PortalTrade[]): PortalSummary {
  const byChain = new Map<TradeChain, CoinTotals>();
  const partners = new Map<string, Partner>();
  const sold = noSide();
  const bought = noSide();
  let first: number | null = null;
  let last: number | null = null;
  let biggestSale: PortalTrade | null = null;
  let biggestBuy: PortalTrade | null = null;
  for (const trade of trades) {
    let coin = byChain.get(trade.chain);
    if (!coin) {
      coin = {
        chain: trade.chain,
        sold: noSide(),
        bought: noSide(),
        first: trade.timestamp,
        last: trade.timestamp,
      };
      byChain.set(trade.chain, coin);
    }
    addTo(coin[trade.side], trade);
    addTo(trade.side === 'sold' ? sold : bought, trade);
    coin.first = Math.min(coin.first, trade.timestamp);
    coin.last = Math.max(coin.last, trade.timestamp);
    first = first === null ? trade.timestamp : Math.min(first, trade.timestamp);
    last = last === null ? trade.timestamp : Math.max(last, trade.timestamp);
    if (trade.side === 'sold') biggestSale = bigger(biggestSale, trade);
    else biggestBuy = bigger(biggestBuy, trade);
    if (trade.other) {
      const partner = partners.get(trade.other) ?? {
        address: trade.other,
        sold: 0,
        bought: 0,
        qort: 0n,
      };
      partner[trade.side] += 1;
      partner.qort += trade.qort;
      partners.set(trade.other, partner);
    }
  }
  return {
    coins: TRADE_CHAINS.flatMap((chain) => byChain.get(chain) ?? []),
    sold,
    bought,
    first,
    last,
    biggestSale,
    biggestBuy,
    partners: [...partners.values()].sort(
      (a, b) =>
        b.sold + b.bought - (a.sold + a.bought) ||
        (b.qort > a.qort ? 1 : b.qort < a.qort ? -1 : 0) ||
        a.address.localeCompare(b.address)
    ),
  };
}

/** Its sales' ATs: the offers of its that were taken. */
export function soldAts(trades: readonly PortalTrade[]): Set<string> {
  return new Set(trades.filter((trade) => trade.side === 'sold').map((trade) => trade.at));
}

const SIGNIFICANT = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 4,
  useGrouping: true,
});

/** The coin paid for one QORT, to 4 significant digits ("0.003512"); null when either is 0. */
export function coinPerQort(coin: bigint, qort: bigint): string | null {
  if (coin <= 0n || qort <= 0n) return null;
  return SIGNIFICANT.format(Number(coin) / Number(qort));
}

const ONE = 100_000_000n;

/** A coin amount: to 4 decimals from 1 up ("9,620.1235"), exact below ("0.00351234"). */
export function coinWords(atomic: bigint): string {
  if (atomic < ONE) return formatAtomic(atomic);
  return formatAtomic(((atomic + 5_000n) / 10_000n) * 10_000n);
}

/** A trade offer it made: one AT, holding the QORT it offered. */
export interface OfferDeployed {
  at: string;
  /** Null when its tags name no coin Core trades now. */
  chain: TradeChain | null;
  /** What it put in the AT: the QORT offered and a little for the AT's fees. */
  qort: bigint;
  timestamp: number;
}

/**
 * - completed: Core lists it as a sale;
 * - ended: it paid back without one (cancelled, or refunded when a buyer didn't finish);
 * - open: still offered, or a trade under way.
 */
export type OfferOutcome = 'completed' | 'ended' | 'open';

export interface OfferMade extends OfferDeployed {
  outcome: OfferOutcome;
}

/**
 * How each offer ended: `sold` are its sales' ATs, `paidBack` the ATs that
 * paid it (a finished AT pays what it holds back to its creator).
 */
export function offerOutcomes(
  deployed: readonly OfferDeployed[],
  sold: ReadonlySet<string>,
  paidBack: ReadonlySet<string>
): OfferMade[] {
  return deployed.map((offer) => ({
    ...offer,
    outcome: sold.has(offer.at) ? 'completed' : paidBack.has(offer.at) ? 'ended' : 'open',
  }));
}

export interface OfferTotals {
  made: number;
  completed: number;
  ended: number;
  open: number;
  /** The QORT the open ones hold. */
  openQort: bigint;
}

const noOffers = (): OfferTotals => ({ made: 0, completed: 0, ended: 0, open: 0, openQort: 0n });

export function summariseOffers(offers: readonly OfferMade[]): {
  total: OfferTotals;
  /** By coin, in TRADE_CHAINS order; offers with no coin Core trades now last (chain null). */
  byCoin: Array<OfferTotals & { chain: TradeChain | null }>;
} {
  const total = noOffers();
  const byChain = new Map<TradeChain | null, OfferTotals>();
  for (const offer of offers) {
    const coin = byChain.get(offer.chain) ?? noOffers();
    byChain.set(offer.chain, coin);
    for (const totals of [total, coin]) {
      totals.made += 1;
      totals[offer.outcome] += 1;
      if (offer.outcome === 'open') totals.openQort += offer.qort;
    }
  }
  const order: Array<TradeChain | null> = [...TRADE_CHAINS, null];
  return {
    total,
    byCoin: order.flatMap((chain) => {
      const coin = byChain.get(chain);
      return coin ? [{ chain, ...coin }] : [];
    }),
  };
}

/** Months for up to two years of trading, quarters for up to eight, years past that. */
export type PeriodUnit = 'month' | 'quarter' | 'year';

export interface VolumePeriod {
  /** Its first moment (local time). */
  start: number;
  /** QORT sold and bought in it, by coin. */
  sold: Partial<Record<TradeChain, bigint>>;
  bought: Partial<Record<TradeChain, bigint>>;
  soldQort: bigint;
  boughtQort: bigint;
  soldCount: number;
  boughtCount: number;
}

const MONTHS_IN: Record<PeriodUnit, number> = { month: 1, quarter: 3, year: 12 };

/** Months between `from` and `to`'s calendar months, counting both. */
function monthSpan(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
}

export function periodUnit(first: number, last: number): PeriodUnit {
  const months = monthSpan(first, last);
  return months <= 24 ? 'month' : months <= 96 ? 'quarter' : 'year';
}

/** The start of the period `timestamp` falls in. */
export function periodStart(timestamp: number, unit: PeriodUnit): number {
  const date = new Date(timestamp);
  const month = date.getMonth() - (date.getMonth() % MONTHS_IN[unit]);
  return new Date(date.getFullYear(), month, 1).getTime();
}

const nextPeriod = (start: number, unit: PeriodUnit): number => {
  const date = new Date(start);
  return new Date(date.getFullYear(), date.getMonth() + MONTHS_IN[unit], 1).getTime();
};

/** Every period from its first trade's to its latest's, empty ones too, oldest first. */
export function volumeByPeriod(trades: readonly PortalTrade[]): {
  unit: PeriodUnit;
  periods: VolumePeriod[];
} {
  if (!trades.length) return { unit: 'month', periods: [] };
  const first = Math.min(...trades.map((trade) => trade.timestamp));
  const last = Math.max(...trades.map((trade) => trade.timestamp));
  const unit = periodUnit(first, last);
  const periods: VolumePeriod[] = [];
  const index = new Map<number, VolumePeriod>();
  for (let start = periodStart(first, unit); start <= last; start = nextPeriod(start, unit)) {
    const period: VolumePeriod = {
      start,
      sold: {},
      bought: {},
      soldQort: 0n,
      boughtQort: 0n,
      soldCount: 0,
      boughtCount: 0,
    };
    periods.push(period);
    index.set(start, period);
  }
  for (const trade of trades) {
    const period = index.get(periodStart(trade.timestamp, unit));
    if (!period) continue;
    const byCoin = period[trade.side];
    byCoin[trade.chain] = (byCoin[trade.chain] ?? 0n) + trade.qort;
    if (trade.side === 'sold') {
      period.soldQort += trade.qort;
      period.soldCount += 1;
    } else {
      period.boughtQort += trade.qort;
      period.boughtCount += 1;
    }
  }
  return { unit, periods };
}

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });

/** "Oct 2026", "Q4 2026", "2026". */
export function periodLabel(start: number, unit: PeriodUnit): string {
  const date = new Date(start);
  if (unit === 'year') return String(date.getFullYear());
  if (unit === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
  return MONTH.format(date);
}
