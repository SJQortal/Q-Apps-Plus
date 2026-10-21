/**
 * Q-Asset trades in words (data/explorer/trades.ts reads them): what an
 * account gave and got in each, and with whom. From the account's side:
 *
 * - it gave QORT: "Bought 23 igorcoin from igorcoin for 529 QORT";
 * - it got QORT: "Sold 23 igorcoin to Simon James for 529 QORT";
 * - two assets: "Traded 5 GBC for 23 igorcoin with igorcoin".
 *
 * Several trades with one account add up, by what moved each way. Pure.
 */
import type { TxRow } from '../../data/types';
import { formatCount, formatDate, plural } from '../../utils/format';
import { formatAtomic, parseAtomic, type AssetSum } from './money';
import { formatAmount, type TxPart } from './txWords';

export interface TradeSide {
  /** 0 for QORT; -1 when Core didn't say. */
  assetId: number;
  asset: string;
  /** As Core writes it ("23.00000000"). */
  amount: string;
}

export interface AssetTrade {
  /** The account's own order (its CREATE_ASSET_ORDER transaction's signature). */
  orderId: string;
  /** The other account's order. */
  otherOrderId: string;
  /** The account whose order this is. */
  self: string;
  /** Who placed the other order; null when it couldn't be read. */
  other: string | null;
  timestamp: number;
  /** The block the trade happened in (the later order's), 0 when unknown. */
  height: number;
  /** The account's order came in and matched the waiting one. */
  initiated: boolean;
  /** What the account gave, and what it got. */
  gave: TradeSide;
  got: TradeSide;
  /** The two order transactions, as far as they were read. */
  txs: TxRow[];
}

const amount = (side: TradeSide): TxPart => ({
  kind: 'amount',
  amount: formatAmount(side.amount),
  asset: side.asset,
});

const QORT = 0;

/** One trade from the account's side, its other account named. */
export function tradeParts(trade: AssetTrade): TxPart[] {
  const who: TxPart[] = trade.other
    ? [{ kind: 'account', address: trade.other }]
    : [{ kind: 'text', text: 'an account that couldn’t be read' }];
  if (trade.gave.assetId === QORT)
    return [
      { kind: 'text', text: 'Bought ' },
      amount(trade.got),
      { kind: 'text', text: ' from ' },
      ...who,
      { kind: 'text', text: ' for ' },
      amount(trade.gave),
    ];
  if (trade.got.assetId === QORT)
    return [
      { kind: 'text', text: 'Sold ' },
      amount(trade.gave),
      { kind: 'text', text: ' to ' },
      ...who,
      { kind: 'text', text: ' for ' },
      amount(trade.got),
    ];
  return [
    { kind: 'text', text: 'Traded ' },
    amount(trade.gave),
    { kind: 'text', text: ' for ' },
    amount(trade.got),
    { kind: 'text', text: ' with ' },
    ...who,
  ];
}

/** One trade on its order's row in a list: "Bought 23 igorcoin from igorcoin for 529 QORT · 29 Jul 2026". */
export function fillParts(trade: AssetTrade): TxPart[] {
  return [...tradeParts(trade), { kind: 'text', text: ` · ${formatDate(trade.timestamp)}` }];
}

/** Trades by the other account, each list newest first, the busiest account first. */
export function tradesByAccount(trades: readonly AssetTrade[]): Array<[string, AssetTrade[]]> {
  const by = new Map<string, AssetTrade[]>();
  for (const trade of trades) {
    if (!trade.other || trade.other === trade.self) continue;
    by.set(trade.other, [...(by.get(trade.other) ?? []), trade]);
  }
  return [...by.entries()]
    .map(([other, list]): [string, AssetTrade[]] => [
      other,
      [...list].sort((a, b) => b.timestamp - a.timestamp),
    ])
    .sort((a, b) => b[1].length - a[1].length || b[1][0].timestamp - a[1][0].timestamp);
}

/** What moved one way over `trades`: QORT and each asset, atomic, assets in the order first seen. */
export function tradeSums(
  trades: readonly AssetTrade[],
  way: 'gave' | 'got'
): { qort: bigint; assets: AssetSum[] } {
  let qort = 0n;
  const assets: AssetSum[] = [];
  for (const trade of trades) {
    const side = trade[way];
    const atomic = parseAtomic(side.amount) ?? 0n;
    if (side.assetId === QORT) qort += atomic;
    else {
      const same = assets.find((sum) => sum.asset === side.asset);
      if (same) same.atomic += atomic;
      else assets.push({ asset: side.asset, atomic });
    }
  }
  return { qort, assets };
}

function sumParts(sums: { qort: bigint; assets: AssetSum[] }): TxPart[] {
  const parts: TxPart[] = [];
  const add = (amount: string, asset: string) => {
    if (parts.length) parts.push({ kind: 'text', text: ' and ' });
    parts.push({ kind: 'amount', amount, asset });
  };
  for (const sum of sums.assets) add(formatAtomic(sum.atomic), sum.asset);
  if (sums.qort > 0n) add(formatAtomic(sums.qort), 'QORT');
  return parts;
}

/**
 * The trades with one account, as a finding: one trade in full; several
 * added up, "3 asset trades with igorcoin: got 46 igorcoin, gave 1,058 QORT".
 */
export function tradesFindingParts(other: string, trades: readonly AssetTrade[]): TxPart[] {
  if (trades.length === 1) return tradeParts(trades[0]);
  const got = sumParts(tradeSums(trades, 'got'));
  const gave = sumParts(tradeSums(trades, 'gave'));
  return [
    { kind: 'text', text: `${formatCount(trades.length)} asset trades with ` },
    { kind: 'account', address: other },
    { kind: 'text', text: ': got ' },
    ...got,
    { kind: 'text', text: ', gave ' },
    ...gave,
  ];
}

/** "Asset trades: every filled order (7)", "its newest 200 filled orders". */
export function tradesCoverage(read: { orders: number; truncated: boolean }): string {
  return read.truncated
    ? `Asset trades: its newest ${formatCount(read.orders)} filled orders.`
    : `Asset trades: every filled order (${read.orders ? formatCount(read.orders) : 'none'}).`;
}

/** "1 trade", "3 trades". */
export const tradesWords = (n: number) => plural(n, 'trade');
