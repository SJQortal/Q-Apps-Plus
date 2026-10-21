/**
 * The Q-Assets an account holds (Simon, 2026-10-21: an Explorer tab "with
 * asset avatars and so on", and a quick list on the Overview): each holding
 * with what Core says of its asset (its owner, how much there is, whether it
 * divides), its last trade price in QORT and what the holding is worth at
 * it, and its share of all there is. Amounts are whole atomic units
 * (1 = 100,000,000), never floats. QORT itself is the account's balance, not
 * a Q-Asset, so it is left out.
 *
 * A trade's price: Core records what each order gave, the initiating
 * order's have-asset (`amount`) and the target order's (`otherAmount`).
 * With QORT on one side, that is so many QORT for so many units.
 *
 * The last trade can be one tiny sale: a single soak sold for 700 QORT made
 * crowetic's 70,000 "worth" 49 million QORT (Simon, 2026-10-21). So next to
 * it, what buyers would pay now (Simon: "also add realistic sale amount with
 * its own window next to it"): the holding sold into the open buy orders on
 * chain, the best price first, until it or the buyers run out; the
 * account's own buy orders don't count. That can never be more than QORT
 * buyers have actually put up.
 *
 * Avatars follow the Q-Assets app: an IMAGE published as
 * `asset<id>_<name>_aavatar` under a name of the asset's owner; anyone
 * else's image for it is never shown. Without one, a coin in a colour of
 * its own with the name's first letters (or its emoji).
 *
 * Pure: no reads.
 */
import { formatAtomic, parseAtomic } from './money';

const ATOMIC = 100_000_000n;
export const QORT_ASSET_ID = 0;

/** What Core says of an asset (`/assets`, without its data). */
export interface AssetMeta {
  assetId: number;
  name: string;
  /** The account that controls it (it issued it, or got it by an update). */
  owner: string;
  description: string;
  /** All there is, in atomic units. */
  quantity: bigint;
  isDivisible: boolean;
  /** Can't be sent or traded (Core's own genesis assets, such as Legacy-QORA). */
  isUnspendable: boolean;
}

/** One asset the account holds (`/assets/balances`). */
export interface Holding {
  assetId: number;
  name: string;
  balance: bigint;
}

/** A row of `/assets/trades/recent`: what the initiating and the target order gave. */
export interface RecentTrade {
  /** The initiating order's have-asset, and how much of it it gave. */
  assetId: number;
  amount: bigint;
  /** The target order's, and how much of it it gave. */
  otherAssetId: number;
  otherAmount: bigint;
  timestamp: number;
}

/** An asset's last trade with QORT. */
export interface AssetPrice {
  /** QORT for one whole unit, in atomic units. */
  perUnit: bigint;
  /** That trade: units of the asset for QORT, both atomic. */
  units: bigint;
  qort: bigint;
  at: number;
}

/** A holding, with what is known of its asset. */
export interface AssetView {
  assetId: number;
  name: string;
  balance: bigint;
  /** Core's record of the asset; absent while the list is read, or when it failed. */
  meta?: AssetMeta;
  price?: AssetPrice;
  /** The holding at the last trade price, in atomic QORT. */
  worth?: bigint;
  /** Its share of all there is (0–1); absent when that isn't known. */
  share?: number;
  /** What buyers would pay for the holding now; absent until the open buy orders are read. */
  sale?: SaleNow;
  /** The account owns (controls) this asset. */
  owned: boolean;
}

/** An open order to buy an asset with QORT (`/assets/openorders/0/<id>`). */
export interface BuyOrder {
  creator: string;
  /** QORT for one whole unit, atomic. */
  price: bigint;
  /** Units it still wants, atomic. */
  units: bigint;
}

/** The holding sold into the open buy orders now, the best price first. */
export interface SaleNow {
  /** What it would fetch, atomic QORT. */
  qort: bigint;
  /** Units the buyers would take, and the rest no buyer wants now. */
  sold: bigint;
  unsold: bigint;
  /** The best price a buyer offers (atomic QORT a unit), when one does. */
  bestBid?: bigint;
  /** More buy orders than were read, so it could fetch more: "at least". */
  atLeast: boolean;
}

/** A row of `/assets/openorders/0/<id>` as a buy order, or null (nothing left to fill). */
export function buyOrderOf(row: unknown): BuyOrder | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const amount = parseAtomic(r.amount);
  const fulfilled = parseAtomic(r.fulfilled) ?? 0n;
  const price = parseAtomic(r.price);
  if (amount === null || price === null || typeof r.creator !== 'string') return null;
  const units = amount - fulfilled;
  return units > 0n && price > 0n ? { creator: r.creator, price, units } : null;
}

/**
 * Selling `balance` into the open buy orders, the best price first, never
 * to the account's own (`self`). `truncated`: Core had more orders than
 * were read, so with units left over it could fetch more.
 */
export function saleNow(
  balance: bigint,
  orders: readonly BuyOrder[],
  self: string,
  truncated = false
): SaleNow {
  const bids = orders
    .filter((order) => order.creator !== self)
    .sort((a, b) => (a.price === b.price ? 0 : a.price > b.price ? -1 : 1));
  let left = balance;
  let qort = 0n;
  for (const bid of bids) {
    if (left <= 0n) break;
    const take = left < bid.units ? left : bid.units;
    qort += (take * bid.price) / ATOMIC;
    left -= take;
  }
  return {
    qort,
    sold: balance - left,
    unsold: left,
    ...(bids.length ? { bestBid: bids[0].price } : {}),
    atLeast: truncated && left > 0n,
  };
}

/** A row of Core's asset list, or null when it isn't one. */
export function assetMetaOf(row: unknown): AssetMeta | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const assetId = Number(r.assetId);
  if (!Number.isInteger(assetId) || assetId < 0 || typeof r.name !== 'string') return null;
  return {
    assetId,
    name: r.name,
    owner: typeof r.owner === 'string' ? r.owner : '',
    description: typeof r.description === 'string' ? r.description : '',
    quantity: quantityOf(r.quantity),
    isDivisible: r.isDivisible !== false,
    isUnspendable: r.isUnspendable === true,
  };
}

/** Core writes the quantity as a whole number of atomic units (a JSON number, up to 10^18). */
function quantityOf(value: unknown): bigint {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
    return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  return 0n;
}

/** A row of `/assets/balances` as a holding; null for QORT, nothing held, or not a row. */
export function holdingOf(row: unknown): Holding | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const assetId = Number(r.assetId);
  const balance = parseAtomic(r.balance);
  if (!Number.isInteger(assetId) || assetId === QORT_ASSET_ID || !balance) return null;
  return {
    assetId,
    name: typeof r.assetName === 'string' && r.assetName ? r.assetName : `Asset #${assetId}`,
    balance,
  };
}

/** A row of `/assets/trades/recent`, or null. */
export function recentTradeOf(row: unknown): RecentTrade | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const amount = parseAtomic(r.amount);
  const otherAmount = parseAtomic(r.otherAmount);
  const assetId = Number(r.assetId);
  const otherAssetId = Number(r.otherAssetId);
  const timestamp = Number(r.timestamp);
  if (amount === null || otherAmount === null) return null;
  if (!Number.isInteger(assetId) || !Number.isInteger(otherAssetId)) return null;
  return { assetId, amount, otherAssetId, otherAmount, timestamp };
}

/** One trade of an asset for QORT, who bought it and who sold it (`/assets/trades/{a}/{b}`). */
export interface AssetDeal {
  at: number;
  buyer: string;
  seller: string;
  /** Units of the asset, and the QORT paid for them (atomic). */
  units: bigint;
  qort: bigint;
  /** The initiating order: the trade's own id. */
  orderId: string;
}

/**
 * A trade with its two orders, with QORT on one side, or null. The order
 * that gave QORT bought; its creator is the buyer.
 */
export function dealOf(row: unknown): AssetDeal | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, Record<string, unknown> | undefined>;
  const trade = r.trade;
  const initiating = r.initiatingOrder;
  const target = r.targetOrder;
  if (!trade || !initiating || !target) return null;
  const initiatorGave = parseAtomic(trade.initiatorAmount);
  const targetGave = parseAtomic(trade.targetAmount);
  const initiator = typeof initiating.creator === 'string' ? initiating.creator : null;
  const other = typeof target.creator === 'string' ? target.creator : null;
  if (initiatorGave === null || targetGave === null || !initiator || !other) return null;
  const have = Number(initiating.haveAssetId);
  const want = Number(initiating.wantAssetId);
  if (have !== QORT_ASSET_ID && want !== QORT_ASSET_ID) return null;
  const initiatorBought = have === QORT_ASSET_ID;
  return {
    at: Number(trade.timestamp),
    buyer: initiatorBought ? initiator : other,
    seller: initiatorBought ? other : initiator,
    units: initiatorBought ? targetGave : initiatorGave,
    qort: initiatorBought ? initiatorGave : targetGave,
    orderId: typeof trade.initiatingOrderId === 'string' ? trade.initiatingOrderId : '',
  };
}

/** One price level of an order book: so many units wanted (or offered) at a price, atomic. */
export interface OrderLevel {
  /** QORT for one whole unit. */
  price: bigint;
  units: bigint;
}

/** A row of `/assets/orderbook/<a>/<b>` (aggregated by price), or null. */
export function orderLevelOf(row: unknown): OrderLevel | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const price = parseAtomic(r.price);
  const units = parseAtomic(r.unfulfilled);
  return price && units ? { price, units } : null;
}

/** Buy orders by price level, the best (highest) first, at most `max`. */
export function bidLevels(orders: readonly BuyOrder[], max = 5): OrderLevel[] {
  const byPrice = new Map<bigint, bigint>();
  for (const order of orders)
    byPrice.set(order.price, (byPrice.get(order.price) ?? 0n) + order.units);
  return [...byPrice.entries()]
    .sort(([a], [b]) => (a === b ? 0 : a > b ? -1 : 1))
    .slice(0, max)
    .map(([price, units]) => ({ price, units }));
}

/** Each asset's newest trade with QORT, as its price; trades between two assets are left out. */
export function pricesFrom(trades: readonly RecentTrade[]): Map<number, AssetPrice> {
  const prices = new Map<number, AssetPrice>();
  for (const trade of trades) {
    let assetId: number;
    let units: bigint;
    let qort: bigint;
    if (trade.otherAssetId === QORT_ASSET_ID && trade.assetId !== QORT_ASSET_ID) {
      [assetId, units, qort] = [trade.assetId, trade.amount, trade.otherAmount];
    } else if (trade.assetId === QORT_ASSET_ID && trade.otherAssetId !== QORT_ASSET_ID) {
      [assetId, units, qort] = [trade.otherAssetId, trade.otherAmount, trade.amount];
    } else continue;
    if (units <= 0n) continue;
    const known = prices.get(assetId);
    if (known && known.at >= trade.timestamp) continue;
    prices.set(assetId, { perUnit: (qort * ATOMIC) / units, units, qort, at: trade.timestamp });
  }
  return prices;
}

/** A holding at a price, in atomic QORT (exact, then truncated to the atomic unit). */
export function worthOf(balance: bigint, price: AssetPrice): bigint {
  return (balance * price.qort) / price.units;
}

/**
 * Its share of all there is (0–1), or undefined when the quantity isn't
 * known. A ratio for showing, so a float: any holding above none stays
 * above 0 (0.1 of 1,000,000,000 is "under 0.01 %", never "0 %").
 */
export function shareOf(balance: bigint, quantity: bigint): number | undefined {
  if (quantity <= 0n) return undefined;
  return Math.min(1, Number(balance) / Number(quantity));
}

/** The holdings with their assets, prices and shares; QORT is never one. */
export function assetViews(
  holdings: readonly Holding[],
  address: string,
  catalogue?: ReadonlyMap<number, AssetMeta>,
  prices?: ReadonlyMap<number, AssetPrice>,
  sales?: ReadonlyMap<number, SaleNow>
): AssetView[] {
  return holdings
    .filter((h) => h.assetId !== QORT_ASSET_ID && h.balance > 0n)
    .map((h) => {
      const meta = catalogue?.get(h.assetId);
      const price = prices?.get(h.assetId);
      const sale = sales?.get(h.assetId);
      const share = meta ? shareOf(h.balance, meta.quantity) : undefined;
      return {
        assetId: h.assetId,
        name: meta?.name ?? h.name,
        balance: h.balance,
        ...(meta ? { meta } : {}),
        ...(price ? { price, worth: worthOf(h.balance, price) } : {}),
        ...(share !== undefined ? { share } : {}),
        ...(sale ? { sale } : {}),
        owned: meta?.owner === address,
      };
    });
}

/** Assets the account owns and holds none of (QORT never), oldest first. */
export function ownedNotHeld(
  catalogue: ReadonlyMap<number, AssetMeta>,
  holdings: readonly Holding[],
  address: string
): AssetMeta[] {
  const held = new Set(holdings.map((h) => h.assetId));
  return [...catalogue.values()]
    .filter((a) => a.owner === address && a.assetId !== QORT_ASSET_ID && !held.has(a.assetId))
    .sort((a, b) => a.assetId - b.assetId);
}

// ---- sorting and searching ---------------------------------------------------------

export type AssetSort = 'worth' | 'sale' | 'share' | 'name' | 'id';

export const ASSET_SORTS: ReadonlyArray<{ value: AssetSort; label: string }> = [
  { value: 'worth', label: 'Worth most first' },
  { value: 'sale', label: 'Buyers pay most first' },
  { value: 'share', label: 'Biggest share of all first' },
  { value: 'name', label: 'Name, A to Z' },
  { value: 'id', label: 'Oldest asset first' },
];

export function isAssetSort(value: unknown): value is AssetSort {
  return ASSET_SORTS.some((sort) => sort.value === value);
}

const byName = (a: AssetView, b: AssetView) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) ||
  a.assetId - b.assetId;

/** In the order picked; what can't be ranked (no price, no share) goes last, by name. */
export function sortAssets(views: readonly AssetView[], sort: AssetSort): AssetView[] {
  const list = [...views];
  switch (sort) {
    case 'worth':
      return list.sort((a, b) => {
        if (a.worth !== undefined && b.worth !== undefined && a.worth !== b.worth)
          return a.worth > b.worth ? -1 : 1;
        if ((a.worth === undefined) !== (b.worth === undefined))
          return a.worth === undefined ? 1 : -1;
        return (b.share ?? -1) - (a.share ?? -1) || byName(a, b);
      });
    case 'sale':
      return list.sort((a, b) => {
        const x = a.sale?.qort ?? -1n;
        const y = b.sale?.qort ?? -1n;
        if (x !== y) return x > y ? -1 : 1;
        if (a.worth !== b.worth && a.worth !== undefined && b.worth !== undefined)
          return a.worth > b.worth ? -1 : 1;
        return byName(a, b);
      });
    case 'share':
      return list.sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || byName(a, b));
    case 'name':
      return list.sort(byName);
    case 'id':
      return list.sort((a, b) => a.assetId - b.assetId);
  }
}

/** Its name contains the words, or they are its number ("11", "#11"). */
export function matchesAsset(view: Pick<AssetView, 'assetId' | 'name'>, words: string): boolean {
  const q = words.trim().toLowerCase();
  if (!q) return true;
  const id = q.replace(/^#/, '');
  if (/^\d+$/.test(id) && Number(id) === view.assetId) return true;
  return view.name.toLowerCase().includes(q);
}

// ---- totals ------------------------------------------------------------------------

export interface AssetsTotals {
  held: number;
  /** Holdings that have a price, and what they are worth together (atomic QORT). */
  priced: number;
  worth: bigint;
  /** Holdings whose buy orders were read, and what buyers would pay for them together. */
  saleRead: number;
  sale: bigint;
  /** Of those: buyers for all of it, for part of it, for none of it. */
  saleAll: number;
  salePart: number;
  saleNone: number;
  /** Some book had more orders than were read: the sale could fetch more. */
  saleAtLeast: boolean;
}

export function assetsTotals(views: readonly AssetView[]): AssetsTotals {
  const totals: AssetsTotals = {
    held: views.length,
    priced: 0,
    worth: 0n,
    saleRead: 0,
    sale: 0n,
    saleAll: 0,
    salePart: 0,
    saleNone: 0,
    saleAtLeast: false,
  };
  for (const view of views) {
    if (view.worth !== undefined) {
      totals.worth += view.worth;
      totals.priced += 1;
    }
    const sale = view.sale;
    if (!sale) continue;
    totals.saleRead += 1;
    totals.sale += sale.qort;
    if (!sale.sold) totals.saleNone += 1;
    else if (sale.unsold) totals.salePart += 1;
    else totals.saleAll += 1;
    if (sale.atLeast) totals.saleAtLeast = true;
  }
  return totals;
}

/** One part of the allocation bar: an asset, or the rest together (assetId null). */
export interface AllocationPart {
  assetId: number | null;
  name: string;
  worth: bigint;
  /** Of the priced total (0–1). */
  fraction: number;
}

/** The priced holdings by worth: the biggest `max - 1` and the rest as one, when there is a rest. */
export function allocation(views: readonly AssetView[], max = 5): AllocationPart[] {
  const priced = views
    .filter((v): v is AssetView & { worth: bigint } => v.worth !== undefined && v.worth > 0n)
    .sort((a, b) => (a.worth === b.worth ? byName(a, b) : a.worth > b.worth ? -1 : 1));
  const total = priced.reduce((sum, v) => sum + v.worth, 0n);
  if (!total) return [];
  const fraction = (worth: bigint) => Number((worth * 1_000_000n) / total) / 1_000_000;
  const shown = priced.length > max ? priced.slice(0, max - 1) : priced;
  const parts: AllocationPart[] = shown.map((v) => ({
    assetId: v.assetId,
    name: v.name,
    worth: v.worth,
    fraction: fraction(v.worth),
  }));
  if (priced.length > max) {
    const rest = priced.slice(max - 1).reduce((sum, v) => sum + v.worth, 0n);
    parts.push({
      assetId: null,
      name: `${priced.length - (max - 1)} others`,
      worth: rest,
      fraction: fraction(rest),
    });
  }
  return parts;
}

// ---- words -------------------------------------------------------------------------

/** "0.5", "1,234.5": an amount of units or QORT, as Core writes it, trimmed. */
export function amountWords(atomic: bigint): string {
  return formatAtomic(atomic);
}

/** QORT for showing a total or a worth: at most 2 decimals, rounded ("420.68"); "under 0.01" above 0. */
export function qortWords(atomic: bigint): string {
  if (atomic > 0n && atomic < 1_000_000n) return 'under 0.01';
  const rounded = ((atomic + 500_000n) / 1_000_000n) * 1_000_000n;
  return formatAtomic(rounded);
}

/** All there is, in whole units for big ones ("10,000,000,000"), exact below a million. */
export function quantityWords(quantity: bigint): string {
  if (quantity >= 1_000_000n * ATOMIC) return formatAtomic((quantity / ATOMIC) * ATOMIC);
  return formatAtomic(quantity);
}

/** "71 %", "2.1 %", "0.24 %", "under 0.01 %", "100 %" (only when it holds all of it). */
export function shareWords(share: number): string {
  if (share >= 1) return '100 %';
  if (share <= 0) return '0 %';
  if (share < 0.0001) return 'under 0.01 %';
  const percent = share * 100;
  let text = percent.toFixed(percent >= 10 ? 0 : percent >= 1 ? 1 : 2);
  // Rounding up to 100 would say it holds all of it.
  if (Number(text) >= 100) text = (Math.floor(percent * 100) / 100).toFixed(2);
  if (text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '');
  return `${text} %`;
}

// ---- avatars -----------------------------------------------------------------------

/** The identifier the Q-Assets app publishes an asset's avatar under (IMAGE, by its owner). */
export function assetAvatarIdentifier(assetId: number, name: string): string {
  return `asset${assetId}_${name}_aavatar`;
}

/** An IMAGE resource that could be an asset's avatar. */
export interface AvatarResource {
  publisher: string;
  identifier: string;
}

/** The asset id an avatar identifier is for, or null when it isn't one. */
export function avatarAssetId(identifier: string): number | null {
  const match = identifier.match(/^asset(\d+)_.+_aavatar$/);
  return match ? Number(match[1]) : null;
}

/**
 * The publishers that put up an avatar for this asset, in the order to try:
 * its owner's primary name first. Whether another publisher is the owner's
 * is for the caller to check (a name's record): anyone can publish this
 * identifier.
 */
export function avatarPublishers(
  resources: readonly AvatarResource[],
  asset: { assetId: number; name: string },
  ownerName: string | null
): string[] {
  const identifier = assetAvatarIdentifier(asset.assetId, asset.name);
  const publishers = [
    ...new Set(resources.filter((r) => r.identifier === identifier).map((r) => r.publisher)),
  ];
  return ownerName && publishers.includes(ownerName)
    ? [ownerName, ...publishers.filter((p) => p !== ownerName)]
    : publishers;
}

const LETTER = /[\p{L}\p{N}]/u;

function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  return Segmenter
    ? [...new Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment)
    : [...text];
}

/**
 * What an asset's coin shows: an emoji or symbol name as itself; a short
 * all-capitals name as it is ("BHC"); a name that starts with a number, its
 * number ("10Coin" → "10"); two or more words as their first letters
 * ("Bean Token" → "BT", "Q-Asset" → "QA"); else its first letter
 * ("igorcoin" → "I").
 */
export function assetInitials(name: string): string {
  const trimmed = name.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const first = graphemes(trimmed)[0];
  if (!first) return '#';
  if (!LETTER.test(first)) return first;
  if (/^[\p{Lu}\p{N}]{2,4}$/u.test(trimmed)) return trimmed;
  const number = trimmed.match(/^\p{N}{1,3}/u);
  if (number) return number[0];
  const initials = trimmed
    .split(/[\s\-_./:]+/)
    .map((word) => graphemes(word).find((g) => LETTER.test(g)))
    .filter((g): g is string => Boolean(g));
  if (initials.length >= 2)
    return initials
      .slice(0, 2)
      .map((g) => g.toUpperCase())
      .join('');
  return first.toUpperCase();
}

/** A hue for the asset's coin: neighbours far apart (the golden angle). */
export function assetHue(assetId: number): number {
  return Math.round((assetId * 137.508) % 360);
}
