/**
 * The seller's product list: every product in the shop's product index (the
 * data container), filtered and sorted. Status, QORT price, category and
 * date come from the index itself, so they show at once; titles and
 * descriptions come from the catalogues as they load, so a search also
 * matches those that are loaded.
 */
import { auctionRowOf } from "../auctions/catalog";

export interface SellerRow {
  productId: string;
  created: number;
  priceQort: number;
  category: string;
  catalogueId: string;
  status: string;
  user?: string;
  /** When it runs, when it sells by auction (auctions/catalog.ts). */
  auction?: { start: number; end: number };
}

export type SellerSort = "newest" | "oldest" | "price-asc" | "price-desc" | "title";
/** AUCTION: sold by auction (stored out of stock for the original app; auctions/catalog.ts). */
export type StatusFilter = "all" | "AVAILABLE" | "AUCTION" | "OUT_OF_STOCK" | "RETIRED";

export const SORT_LABEL: Record<SellerSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  title: "Title A–Z",
};

export interface SellerFilters {
  query: string;
  status: StatusFilter;
  /** "" for every category. */
  category: string;
  sort: SellerSort;
}

export const DEFAULT_FILTERS: SellerFilters = { query: "", status: "all", category: "", sort: "newest" };

export type DetailsOf = (row: SellerRow) => { title?: unknown; description?: unknown } | undefined;

/** Status as the index stores it (an auction's row says so); anything else counts as available, as the shop page shows it. */
export function statusOf(row: { status?: string; auction?: unknown }): Exclude<StatusFilter, "all"> {
  if (row.status === "RETIRED") return "RETIRED";
  if (auctionRowOf(row)) return "AUCTION";
  return row.status === "OUT_OF_STOCK" ? row.status : "AVAILABLE";
}

export function statusCounts(rows: SellerRow[]): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = { all: rows.length, AVAILABLE: 0, AUCTION: 0, OUT_OF_STOCK: 0, RETIRED: 0 };
  for (const row of rows) counts[statusOf(row)] += 1;
  return counts;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** True when the search needs titles and descriptions, i.e. catalogues. */
export function needsDetails(filters: SellerFilters): boolean {
  return filters.query.trim().length > 0 || filters.sort === "title";
}

export function filterSellerProducts(rows: SellerRow[], filters: SellerFilters, detailsOf: DetailsOf): SellerRow[] {
  const query = filters.query.trim().toLowerCase();
  const list = rows.filter((row) => {
    if (filters.status !== "all" && statusOf(row) !== filters.status) return false;
    if (filters.category && row.category !== filters.category) return false;
    if (!query) return true;
    const details = detailsOf(row);
    return [text(details?.title), text(details?.description), row.category, row.productId].some((field) =>
      field.toLowerCase().includes(query)
    );
  });
  const byCreated = (a: SellerRow, b: SellerRow) => (b.created ?? 0) - (a.created ?? 0);
  switch (filters.sort) {
    case "oldest":
      return list.sort((a, b) => -byCreated(a, b));
    case "price-asc":
      return list.sort((a, b) => (Number(a.priceQort) || 0) - (Number(b.priceQort) || 0) || byCreated(a, b));
    case "price-desc":
      return list.sort((a, b) => (Number(b.priceQort) || 0) - (Number(a.priceQort) || 0) || byCreated(a, b));
    case "title":
      // Products whose catalogue hasn't loaded yet go last, newest first.
      return list.sort((a, b) => {
        const ta = text(detailsOf(a)?.title);
        const tb = text(detailsOf(b)?.title);
        if (!ta || !tb) return ta ? -1 : tb ? 1 : byCreated(a, b);
        return ta.localeCompare(tb) || byCreated(a, b);
      });
    default:
      return list.sort(byCreated);
  }
}

/** True when any filter differs from the defaults (the sort doesn't count). */
export function isFiltered(filters: SellerFilters): boolean {
  return filters.query.trim() !== "" || filters.status !== "all" || filters.category !== "";
}
