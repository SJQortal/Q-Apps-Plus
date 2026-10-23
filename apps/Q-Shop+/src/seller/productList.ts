/**
 * The seller's product list: every product in the shop's product index (the
 * data container), filtered and sorted. Status, QORT price, category and
 * date come from the index itself, so they show at once; titles and
 * descriptions come from the catalogues as they load, so a search also
 * matches those that are loaded.
 */
import { auctionRowOf } from "../auctions/catalog";
import { arrangeProducts } from "../qdn/productOrder";

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

/**
 * featured: the shop's order, as buyers see it (Products → Arrange,
 * qdn/productOrder.ts): the products it names first, the rest newest first.
 * Each column of the list sorts both ways (Simon, 2026-10-23: "clicking on
 * product price status added sorts the list").
 */
export type SellerSort =
  | "featured"
  | "featured-desc"
  | "newest"
  | "oldest"
  | "price-asc"
  | "price-desc"
  | "title"
  | "title-desc"
  | "status"
  | "status-desc";
/** AUCTION: sold by auction (stored out of stock for the original app; auctions/catalog.ts). */
export type StatusFilter = "all" | "AVAILABLE" | "AUCTION" | "OUT_OF_STOCK" | "RETIRED";

export const SORT_LABEL: Record<SellerSort, string> = {
  featured: "Shop order (Featured)",
  "featured-desc": "Shop order, last first",
  newest: "Newest first",
  oldest: "Oldest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  title: "Title A–Z",
  "title-desc": "Title Z–A",
  status: "Status: available first",
  "status-desc": "Status: retired first",
};

/** The list's columns that sort it: the way a first click sorts, and the other way. */
export const SORT_COLUMNS = {
  order: { label: "Shop order", first: "featured", second: "featured-desc" },
  title: { label: "Product", first: "title", second: "title-desc" },
  price: { label: "Price", first: "price-asc", second: "price-desc" },
  status: { label: "Status", first: "status", second: "status-desc" },
  added: { label: "Added", first: "newest", second: "oldest" },
} as const satisfies Record<string, { label: string; first: SellerSort; second: SellerSort }>;
export type SortColumn = keyof typeof SORT_COLUMNS;

/** A click on a column: its first way, or the other way when it already sorts the list. */
export function sortForColumn(column: SortColumn, current: SellerSort): SellerSort {
  const c = SORT_COLUMNS[column];
  return current === c.first ? c.second : c.first;
}

/** The column sorting the list and which way ("first" is its first click's), or null. */
export function sortColumnOf(sort: SellerSort): { column: SortColumn; way: "first" | "second" } | null {
  for (const [column, c] of Object.entries(SORT_COLUMNS) as [SortColumn, (typeof SORT_COLUMNS)[SortColumn]][]) {
    if (c.first === sort) return { column, way: "first" };
    if (c.second === sort) return { column, way: "second" };
  }
  return null;
}

const STATUS_RANK: Record<Exclude<StatusFilter, "all">, number> = { AVAILABLE: 0, AUCTION: 1, OUT_OF_STOCK: 2, RETIRED: 3 };

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
  return filters.query.trim().length > 0 || filters.sort === "title" || filters.sort === "title-desc";
}

export function filterSellerProducts(rows: SellerRow[], filters: SellerFilters, detailsOf: DetailsOf, order: readonly string[] = []): SellerRow[] {
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
    case "featured":
    case "featured-desc": {
      const byId = new Map(list.map((row) => [row.productId, row]));
      const newest = [...list].sort(byCreated).map((row) => row.productId);
      const arranged = arrangeProducts([...order], newest).map((id) => byId.get(id) as SellerRow);
      return filters.sort === "featured" ? arranged : arranged.reverse();
    }
    case "status":
    case "status-desc": {
      const way = filters.sort === "status" ? 1 : -1;
      return list.sort((a, b) => way * (STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)]) || byCreated(a, b));
    }
    case "oldest":
      return list.sort((a, b) => -byCreated(a, b));
    case "price-asc":
      return list.sort((a, b) => (Number(a.priceQort) || 0) - (Number(b.priceQort) || 0) || byCreated(a, b));
    case "price-desc":
      return list.sort((a, b) => (Number(b.priceQort) || 0) - (Number(a.priceQort) || 0) || byCreated(a, b));
    case "title":
    case "title-desc": {
      const way = filters.sort === "title" ? 1 : -1;
      // Products whose catalogue hasn't loaded yet go last, newest first, either way.
      return list.sort((a, b) => {
        const ta = text(detailsOf(a)?.title);
        const tb = text(detailsOf(b)?.title);
        if (!ta || !tb) return ta ? -1 : tb ? 1 : byCreated(a, b);
        return way * ta.localeCompare(tb) || byCreated(a, b);
      });
    }
    default:
      return list.sort(byCreated);
  }
}

/**
 * Each listed product's place in the shop's order as buyers see it
 * (Featured: 1, 2, …), whatever the list's filters; retired ones have none.
 */
export function shopOrderPlaces(rows: SellerRow[], order: readonly string[]): Map<string, number> {
  const listed = rows.filter((row) => row.status !== "RETIRED").sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
  return new Map(arrangeProducts([...order], listed.map((row) => row.productId)).map((id, i) => [id, i + 1]));
}

/** True when any filter differs from the defaults (the sort doesn't count). */
export function isFiltered(filters: SellerFilters): boolean {
  return filters.query.trim() !== "" || filters.status !== "all" || filters.category !== "";
}
