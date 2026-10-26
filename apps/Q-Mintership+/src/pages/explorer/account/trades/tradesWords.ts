/** The Trades tab's words. Pure. */
import { qortWords } from '../../../../rules/explorer/assets';
import {
  COINS,
  coinWords,
  type OfferOutcome,
  type OfferTotals,
  type PeriodUnit,
  type PortalSide,
  type TradeChain,
} from '../../../../rules/explorer/portalTrades';
import { formatCount, plural } from '../../../../utils/format';

/** "1,234.57 QORT", rounded to the hundredth. */
export const qortText = (atomic: bigint) => `${qortWords(atomic)} QORT`;

/** "43.2109 LTC". */
export const coinText = (atomic: bigint, chain: TradeChain) =>
  `${coinWords(atomic)} ${COINS[chain].code}`;

/** "Litecoin (LTC)". */
export const coinName = (chain: TradeChain) => `${COINS[chain].name} (${COINS[chain].code})`;

export const SIDE_LABEL: Record<PortalSide, string> = { sold: 'Sold', bought: 'Bought' };

/** "1 trade", "678 trades". */
export const tradeCount = (n: number) => plural(n, 'trade');

export const OUTCOME_LABEL: Record<OfferOutcome, string> = {
  completed: 'Completed',
  ended: 'Ended without a trade',
  open: 'Open',
};

/** "678 completed · 475 ended without a trade · 1 open", leaving out the ones at 0. */
export function offersLine(totals: OfferTotals): string {
  const parts: string[] = [];
  if (totals.completed) parts.push(`${formatCount(totals.completed)} completed`);
  if (totals.ended) parts.push(`${formatCount(totals.ended)} ended without a trade`);
  if (totals.open) parts.push(`${formatCount(totals.open)} open`);
  return parts.join(' · ') || 'none yet';
}

/** What one bar of the chart covers. */
export const UNIT_WORDS: Record<PeriodUnit, string> = {
  month: 'month',
  quarter: 'quarter',
  year: 'year',
};

/** "98 %", "1.8 %", "99.8 %" (never 100 % for less than all), "under 0.1 %". */
export function shareText(part: bigint, whole: bigint): string {
  if (whole <= 0n || part <= 0n) return '0 %';
  if (part >= whole) return '100 %';
  const share = Number((part * 10_000n) / whole) / 100;
  if (share >= 99.9) return 'over 99.9 %';
  if (share >= 99.5) return `${share.toFixed(1)} %`;
  if (share >= 10) return `${Math.round(share)} %`;
  if (share >= 0.1) return `${share.toFixed(1)} %`;
  return 'under 0.1 %';
}
