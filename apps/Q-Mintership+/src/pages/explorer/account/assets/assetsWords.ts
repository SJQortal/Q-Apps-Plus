/** What the Assets tab and the Overview's Q-Assets say (Simon, 2026-10-21). */
import { formatCount, formatDate } from '../../../../utils/format';
import {
  amountWords,
  qortWords,
  shareWords,
  type AssetPrice,
  type AssetsTotals,
} from '../../../../rules/explorer/assets';

export const NO_ASSETS = 'Holds no Q-Assets.';
export const NEVER_TRADED = 'Never traded for QORT';
export const UNSPENDABLE_WORDS = 'Can’t be sent';
export const UNSPENDABLE_EXPLANATION =
  'One of Qortal’s own genesis assets: it can’t be sent or traded.';
/** Said only of an asset that can't be split (Simon, 2026-10-21: "just show it if asset is indivisible"). */
export const INDIVISIBLE_WORDS = 'Indivisible';
export const INDIVISIBLE_EXPLANATION = 'Whole units only: it can’t be split.';
export const OWNS_WORDS = 'Its own';
export const OWNS_EXPLANATION =
  'This account owns the asset: it issued it, or got it by an update.';

/** "Q-Assets (5)". */
export function assetsTitle(count: number): string {
  return `Q-Assets (${formatCount(count)})`;
}

/** "Assets it owns, holding none (2)". */
export function ownedTitle(count: number): string {
  return `Assets it owns, holding none (${formatCount(count)})`;
}

/** The summary's main line: "Worth about 1,234.5 QORT at their last trades". */
export function worthLine(totals: AssetsTotals): string | null {
  if (!totals.priced) return null;
  return `Worth about ${qortWords(totals.worth)} QORT at ${
    totals.priced === 1 ? 'its last trade' : 'their last trades'
  }`;
}

/** Under it: how many of them have a price. */
export function pricedLine(totals: AssetsTotals): string {
  if (!totals.held) return '';
  if (!totals.priced) return 'None of them has traded for QORT yet.';
  if (totals.priced === totals.held)
    return totals.held === 1 ? 'It has traded for QORT.' : 'Each has traded for QORT.';
  return `${formatCount(totals.priced)} of ${formatCount(totals.held)} have traded for QORT; the rest aren’t counted.`;
}

/** "20 QORT each", "0.00012 QORT each". */
export function priceWords(price: AssetPrice): string {
  return `${amountWords(price.perUnit)} QORT each`;
}

/** "Last traded at 20 QORT each, 18 May 2025". */
export function lastTradeLine(price: AssetPrice): string {
  return `Last traded at ${priceWords(price)}, ${formatDate(price.at)}`;
}

/** "≈ 120 QORT". */
export function worthWords(worth: bigint): string {
  return `≈ ${qortWords(worth)} QORT`;
}

/** "0.6 % of 1,000" (all there is, in words). */
export function shareLine(share: number, quantity: string): string {
  return `${shareWords(share)} of ${quantity}`;
}

/** Where the account stands among the holders read, or null when it isn't among them. */
export function rankLine(rank: number | null, read: number, truncated: boolean): string {
  if (rank === null)
    return truncated
      ? `Not among its ${formatCount(read)} biggest holders.`
      : 'Not among its holders.';
  return truncated
    ? `#${formatCount(rank)} of its ${formatCount(read)} biggest holders.`
    : `#${formatCount(rank)} of ${formatCount(read)} ${read === 1 ? 'holder' : 'holders'}.`;
}

/** "Show the next 24". */
export function showMoreWords(left: number, page: number): string {
  return `Show the next ${formatCount(Math.min(left, page))}`;
}
