/**
 * Sorting and filtering the home page's shops. Pure: the indexes they read
 * (activity, ratings, each shop's details) are passed in.
 */
import { COINS, FOREIGN_TICKERS, shopCoins, type ForeignTicker } from "../money/coins";
import type { ActivityIndex } from "./activity";
import { weightedRating, type RatingsIndex } from "./ratings";
import type { ShopDetails } from "./shopDetails";
import type { ShopEntry } from "./shopIndex";
import type { FavoriteCounts } from "../favorites/model";

export type ShopSort = "newest" | "active" | "products" | "rated" | "favorites" | "az";

export const SHOP_SORTS: { value: ShopSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "active", label: "Recently active" },
  { value: "products", label: "Most products" },
  { value: "rated", label: "Top rated" },
  // How many buyers keep the shop as a favourite (favorites/counts.ts).
  { value: "favorites", label: "Most loved" },
  { value: "az", label: "A–Z" },
];

export function parseSort(value: string | null | undefined): ShopSort {
  return SHOP_SORTS.some((s) => s.value === value) ? (value as ShopSort) : "newest";
}

/** Sorts that need the shops' product indexes (one search). */
export function sortNeedsActivity(sort: ShopSort): boolean {
  return sort === "active" || sort === "products";
}

/** "" = any coin; a foreign ticker; or "assets" = takes at least one Qortal asset. */
export type PayFilter = "" | ForeignTicker | "assets";

export const PAY_FILTERS: { value: PayFilter; label: string; short: string }[] = [
  { value: "", label: "Any coin", short: "Any" },
  ...FOREIGN_TICKERS.map((ticker) => ({ value: ticker as PayFilter, label: COINS[ticker].label, short: ticker })),
  { value: "assets", label: "Qortal assets", short: "Assets" },
];

export function parsePay(value: string | null | undefined): PayFilter {
  return PAY_FILTERS.some((p) => p.value === value) ? (value as PayFilter) : "";
}

/** True when the filter can only be answered from each shop's JSON (ARRR has a metadata marker). */
export function payNeedsDetails(pay: PayFilter): boolean {
  return pay !== "" && pay !== "ARRR";
}

export function payLabel(pay: PayFilter): string {
  return PAY_FILTERS.find((p) => p.value === pay)?.label ?? "Any coin";
}

/**
 * Does the shop take this coin: yes, no, or unknown until its JSON is read.
 * A coin counts only with a payout address, as at checkout (money/coins
 * shopCoins); before the JSON is read, ARRR comes from the metadata marker.
 */
export function payMatch(shop: ShopEntry, pay: PayFilter, details: ShopDetails | undefined): "yes" | "no" | "unknown" {
  if (pay === "") return "yes";
  if (details?.status === "ready") {
    if (!details.valid) return "no";
    if (pay === "assets") return (details.shop.acceptedAssets ?? []).some((a) => Number.isSafeInteger(a?.id) && a.id > 0) ? "yes" : "no";
    return shopCoins(details.shop).includes(pay) ? "yes" : "no";
  }
  if (pay === "ARRR") return shop.acceptsArrr ? "yes" : "no";
  if (details?.status === "failed") return "no";
  return "unknown";
}

export interface ShopFilters {
  pay: PayFilter;
  /** Only these shops (the signed-in name's), by shopKey; null = everyone's. */
  mine: Set<string> | null;
}

export interface FilteredShops {
  shops: ShopEntry[];
  /** Shops the "Pays in" filter can't answer until their JSON is read. */
  unknown: ShopEntry[];
  /** Shops whose JSON couldn't be read for the "Pays in" check. */
  unreadable: number;
  /** Shops the "Pays in" filter looked at: the ones My shops (if on) kept, valid as far as known. */
  considered: number;
}

/**
 * Applies the filters, and drops shops whose JSON turned out not to be a
 * shop (the original only lists shops that pass its structure check), or
 * that their owner deleted. Such a shop comes back only when the index says
 * it changed since it was read: its card reads it again (say, a shop created
 * again under a deleted one's id).
 */
export function filterShops(
  shops: ShopEntry[],
  filters: ShopFilters,
  details: (key: string) => ShopDetails | undefined
): FilteredShops {
  const kept: ShopEntry[] = [];
  const unknown: ShopEntry[] = [];
  let unreadable = 0;
  let considered = 0;
  for (const shop of shops) {
    if (filters.mine && !filters.mine.has(shop.key)) continue;
    const state = details(shop.key);
    if (state?.status === "ready" && !state.valid && !(typeof state.updated === "number" && state.updated < shop.updated)) continue;
    considered += 1;
    const match = payMatch(shop, filters.pay, state);
    if (match === "yes") kept.push(shop);
    else if (match === "unknown") unknown.push(shop);
    else if (state?.status === "failed" && payNeedsDetails(filters.pay)) unreadable += 1;
  }
  return { shops: kept, unknown, unreadable, considered };
}

export interface SortContext {
  activity?: ActivityIndex | null;
  ratings?: RatingsIndex | null;
  favorites?: FavoriteCounts | null;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

const newestFirst = (a: ShopEntry, b: ShopEntry) =>
  b.created - a.created || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/** When the shop last changed: its products (product index) or the shop itself, whichever is later. */
export function lastActive(shop: ShopEntry, activity?: ActivityIndex | null): number {
  return Math.max(shop.updated, activity?.byShop.get(shop.key)?.updated ?? 0);
}

/**
 * A sorted copy. Sorts whose index hasn't loaded yet keep the newest-first
 * order; shops without a rating or a product index go last.
 */
export function sortShops(shops: ShopEntry[], sort: ShopSort, context: SortContext = {}): ShopEntry[] {
  const list = [...shops];
  switch (sort) {
    case "active":
      if (!context.activity) return list.sort(newestFirst);
      return list.sort(
        (a, b) => lastActive(b, context.activity) - lastActive(a, context.activity) || newestFirst(a, b)
      );
    case "products": {
      const activity = context.activity;
      if (!activity) return list.sort(newestFirst);
      const size = (s: ShopEntry) => activity.byShop.get(s.key)?.size ?? -1;
      return list.sort((a, b) => size(b) - size(a) || newestFirst(a, b));
    }
    case "rated": {
      const ratings = context.ratings;
      if (!ratings) return list.sort(newestFirst);
      const rating = (s: ShopEntry) => ratings.get(s.owner, s.shortStoreId);
      return list.sort((a, b) => {
        const ra = rating(a);
        const rb = rating(b);
        if (ra && !rb) return -1;
        if (!ra && rb) return 1;
        if (ra && rb) {
          const score = weightedRating(rb) - weightedRating(ra);
          return score || rb.count - ra.count || newestFirst(a, b);
        }
        return newestFirst(a, b);
      });
    }
    case "favorites": {
      const favorites = context.favorites;
      if (!favorites) return list.sort(newestFirst);
      const count = (s: ShopEntry) => favorites.shop(s.owner, s.shortStoreId);
      return list.sort((a, b) => count(b) - count(a) || newestFirst(a, b));
    }
    case "az":
      return list.sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.owner, b.owner));
    case "newest":
    default:
      return list.sort(newestFirst);
  }
}
