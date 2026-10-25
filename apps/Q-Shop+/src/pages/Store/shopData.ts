/**
 * The shop page's product list, worked out from the shop's product index
 * (the DOCUMENT `<storeId>-datacontainer`). The index already holds
 * `created`, `priceQort`, `category`, `catalogueId` and `status` for every
 * product, so filtering and sorting run over the whole list without
 * fetching a single catalogue; catalogues (10 products each, with titles and
 * images) are fetched only for the products on screen, or for a text search.
 *
 * The original sorted with comparators that returned an array (NaN) and
 * sorted prices by `price[0]`, which isn't always the QORT price; these sort
 * by the index's QORT price and fall back to newest first.
 */
import { rowSaleOf } from "../../sale/compareAt";
import type { Catalogue } from "../../state/features/globalSlice";
import type { Product } from "../../state/features/storeSlice";
import { AVAILABLE, OUT_OF_STOCK, RETIRED } from "../../constants/product-status";
import { auctionRowOf, type AuctionRow } from "../../auctions/catalog";
import { auctionTermsOf } from "../../auctions/rules";
import { variantRowOf, type VariantRow } from "../../variants/model";
import { stockOf, type ProductStock } from "../../stock/model";

/** Products per page on the shop page; catalogues are fetched for these only. */
export const PRODUCTS_PAGE = 20;
/** A text search reads at most this many catalogues (10 products each). */
export const SEARCH_CATALOGUE_CAP = 30;

export type ProductSort = "newest" | "oldest" | "price-asc" | "price-desc" | "ending";
/** A shop page's sorts: the general ones, and the seller's own order (qdn/productOrder.ts, a collection's order). */
export type ShopSort = ProductSort | "featured";

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** Auctions still open by when they end, then everything else newest first: offered when a list has open auctions. */
export const AUCTION_SORT: { value: ProductSort; label: string } = { value: "ending", label: "Ending soonest" };

/** The seller's order, offered first on a shop page that has one. */
export const FEATURED_SORT: { value: ShopSort; label: string } = { value: "featured", label: "Featured" };

/**
 * The sort a shop page shows: the buyer's pick, else the seller's order when
 * there is one (`hasOrder`), else newest first. "Featured" without an order
 * is newest first.
 */
export function effectiveSort(picked: ShopSort | null, hasOrder: boolean): ShopSort {
  if (picked && (picked !== "featured" || hasOrder)) return picked;
  return hasOrder ? "featured" : "newest";
}

/** One product as the shop's index lists it. */
export interface ProductRow {
  productId: string;
  catalogueId: string;
  created: number;
  priceQort?: number;
  category?: string;
  /** The index's status; the catalogue's, once loaded, wins (as in the original). */
  status?: string;
  /** When it runs, when it sells by auction (auctions/catalog.ts); the catalogue's terms, once loaded, win. */
  auction?: AuctionRow;
  /** Its group and option values, when it is a variant (variants/model.ts). */
  variant?: VariantRow;
  /** Its stock count, when the seller counts it (stock/model.ts). */
  stock?: ProductStock;
  /** Units left by the orders' notes, once read (withStockLeft). */
  stockLeft?: number;
  /** Counted, and none left: it shows (and filters) as out of stock, labelled Sold out. */
  soldOut?: boolean;
  /** Percent off, when it's on sale (sale/compareAt.ts). */
  sale?: number;
}

export interface ProductQuery {
  categories: string[];
  inStockOnly: boolean;
  /** Only auctions still open (running, or yet to start). */
  auctionsOnly?: boolean;
  /** A price range in QORT (the index's price; an auction's starting bid); null or absent: no bound. */
  minQort?: number | null;
  maxQort?: number | null;
  sort: ShopSort;
}

export const DEFAULT_PRODUCT_QUERY: ProductQuery = { categories: [], inStockOnly: false, sort: "newest" };

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

function auctionField(entry: unknown): { auction?: AuctionRow } {
  const auction = auctionRowOf(entry);
  return auction ? { auction } : {};
}

function variantField(entry: unknown): { variant?: VariantRow } {
  const variant = variantRowOf(entry);
  return variant ? { variant } : {};
}

function stockField(entry: unknown): { stock?: ProductStock } {
  const stock = stockOf(entry);
  return stock ? { stock } : {};
}

/** The counted rows with what's left of them (`left`: units by product id, stock/notes.ts); others as they are. */
export function withStockLeft<T extends ProductRow>(rows: T[], left: ReadonlyMap<string, number>): T[] {
  if (left.size === 0) return rows;
  return rows.map((row) => {
    const units = row.stock ? left.get(row.productId) : undefined;
    return units === undefined ? row : { ...row, stockLeft: units, soldOut: units <= 0 };
  });
}

/** The index's products as rows, newest first. Malformed entries are skipped. */
export function productRowsFromContainer(container: { products?: unknown } | null | undefined): ProductRow[] {
  const products = container?.products;
  if (!products || typeof products !== "object") return [];
  const rows: ProductRow[] = [];
  for (const [productId, entry] of Object.entries(products as Record<string, any>)) {
    if (!productId || !entry || typeof entry !== "object" || typeof entry.catalogueId !== "string" || !entry.catalogueId) {
      continue;
    }
    rows.push({
      productId,
      catalogueId: entry.catalogueId,
      created: finiteNumber(entry.created) ?? 0,
      priceQort: finiteNumber(entry.priceQort),
      category: typeof entry.category === "string" && entry.category ? entry.category : undefined,
      status: typeof entry.status === "string" && entry.status ? entry.status : undefined,
      ...auctionField(entry),
      ...variantField(entry),
      ...stockField(entry),
      ...(rowSaleOf(entry) && { sale: rowSaleOf(entry) }),
    });
  }
  return rows.sort((a, b) => b.created - a.created);
}

/** The shop's categories, A to Z. */
export function categoriesOf(rows: ProductRow[]): string[] {
  return [...new Set(rows.map((row) => row.category).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

export type CatalogueMap = Record<string, Catalogue | undefined>;

/** The product's full record, once its catalogue is loaded. */
export function productOf(row: ProductRow, catalogues: CatalogueMap): Product | undefined {
  return catalogues[row.catalogueId]?.products?.[row.productId];
}

export function isCatalogueLoaded(row: ProductRow, catalogues: CatalogueMap): boolean {
  return !!catalogues[row.catalogueId];
}

/** The catalogue's status once loaded, else the index's. */
export function effectiveStatus(row: ProductRow, catalogues: CatalogueMap): string | undefined {
  const status = productOf(row, catalogues)?.status || row.status || undefined;
  // Counted and none left (stock/model.ts): out of stock, whatever the seller last published.
  return row.soldOut && status === AVAILABLE ? OUT_OF_STOCK : status;
}

/**
 * Whether the shop lists the product. The original shows AVAILABLE and
 * OUT_OF_STOCK products and hides the rest (RETIRED, and products whose
 * catalogue no longer has them). A product without a status in the index is
 * kept until its catalogue says.
 */
export function isListed(row: ProductRow, catalogues: CatalogueMap): boolean {
  const loaded = isCatalogueLoaded(row, catalogues);
  if (loaded && !productOf(row, catalogues)) return false;
  const status = effectiveStatus(row, catalogues);
  if (status === AVAILABLE || status === OUT_OF_STOCK) return true;
  if (!status) return !loaded;
  return false;
}

/** When the product's auction runs: its catalogue's terms once loaded, else the index's. */
export function auctionTimesOf(row: ProductRow, catalogues: CatalogueMap): AuctionRow | null {
  if (!isCatalogueLoaded(row, catalogues)) return row.auction ?? null;
  const terms = auctionTermsOf(productOf(row, catalogues));
  return terms ? { start: terms.start, end: terms.end } : null;
}

/** An auction still taking bids, or yet to start, by its times (a buy-now can end it sooner; its page knows). */
export function isOpenAuction(row: ProductRow, catalogues: CatalogueMap, now: number): boolean {
  const times = auctionTimesOf(row, catalogues);
  return !!times && now < times.end;
}

/** For sale: AVAILABLE, or an auction still open (stored out of stock, for the original). */
export function isInStock(row: ProductRow, catalogues: CatalogueMap, now = Date.now()): boolean {
  return effectiveStatus(row, catalogues) === AVAILABLE || isOpenAuction(row, catalogues, now);
}

export function isRetired(status: string | undefined): boolean {
  return status === RETIRED;
}

/**
 * The order a sort gives (newest first for equal values). "featured" follows
 * `order` (product ids): those it names first, in its order, then the rest
 * newest first.
 */
export function compareRows(
  sort: ShopSort,
  order: string[] = [],
  now = Date.now(),
  timesOf: (row: ProductRow) => AuctionRow | null = (row) => row.auction ?? null
): (a: ProductRow, b: ProductRow) => number {
  const newest = (a: ProductRow, b: ProductRow) => b.created - a.created;
  switch (sort) {
    case "ending": {
      const endOf = (row: ProductRow) => {
        const times = timesOf(row);
        return times && now < times.end ? times.end : Number.POSITIVE_INFINITY;
      };
      return (a, b) => {
        const x = endOf(a);
        const y = endOf(b);
        return x === y ? newest(a, b) : x < y ? -1 : 1;
      };
    }
    case "featured": {
      const at = new Map(order.map((id, i) => [id, i]));
      return (a, b) => {
        const x = at.get(a.productId);
        const y = at.get(b.productId);
        if (x !== undefined && y !== undefined) return x - y;
        if (x !== undefined) return -1;
        if (y !== undefined) return 1;
        return newest(a, b);
      };
    }
    case "oldest":
      return (a, b) => a.created - b.created;
    case "price-asc":
    case "price-desc": {
      const dir = sort === "price-asc" ? 1 : -1;
      return (a, b) => {
        // Products without a QORT price go last either way.
        if (a.priceQort === undefined && b.priceQort === undefined) return newest(a, b);
        if (a.priceQort === undefined) return 1;
        if (b.priceQort === undefined) return -1;
        return (a.priceQort - b.priceQort) * dir || newest(a, b);
      };
    }
    default:
      return newest;
  }
}

/** Category, stock and auction filters, then the sort (`order`: the seller's, for "featured"). Returns a new array. */
export function filterAndSortProducts(
  rows: ProductRow[],
  query: ProductQuery,
  catalogues: CatalogueMap,
  order: string[] = [],
  now = Date.now()
): ProductRow[] {
  const categories = new Set(query.categories);
  return rows
    .filter((row) => isListed(row, catalogues))
    .filter((row) => categories.size === 0 || (!!row.category && categories.has(row.category)))
    .filter((row) => !query.inStockOnly || isInStock(row, catalogues, now))
    .filter((row) => !query.auctionsOnly || isOpenAuction(row, catalogues, now))
    .filter((row) => inPriceRange(row, query.minQort, query.maxQort))
    // When an auction ends: its catalogue's terms once loaded, as the filters read them.
    .sort(compareRows(query.sort, order, now, (row) => auctionTimesOf(row, catalogues)));
}

/** Within the range, by the index's QORT price; a product without one is out once there's a bound. */
export function inPriceRange(row: Pick<ProductRow, "priceQort">, min?: number | null, max?: number | null): boolean {
  const hasMin = typeof min === "number" && Number.isFinite(min);
  const hasMax = typeof max === "number" && Number.isFinite(max);
  if (!hasMin && !hasMax) return true;
  if (row.priceQort === undefined) return false;
  return (!hasMin || row.priceQort >= min!) && (!hasMax || row.priceQort <= max!);
}

/** A typed price bound: a number of QORT, or null when empty or not a number. */
export function priceBound(text: string): number | null {
  const value = text.trim() ? Number(text.trim().replace(",", ".")) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** How many listed products are auctions still open (the Auctions toggle shows when there are any). */
export function openAuctionCount(rows: ProductRow[], catalogues: CatalogueMap, now: number): number {
  return rows.filter((row) => isListed(row, catalogues) && isOpenAuction(row, catalogues, now)).length;
}

/** The words of a search, lower case. */
export function searchTerms(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
}

/** Every word appears in the product's title, description or category. */
export function matchesSearch(product: Pick<Product, "title" | "description" | "category"> | undefined, terms: string[]): boolean {
  if (!product) return false;
  if (terms.length === 0) return true;
  const haystack = `${product.title ?? ""}\n${product.description ?? ""}\n${product.category ?? ""}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/**
 * The catalogues a text search reads, in list order: at most `cap`, so a
 * big shop never triggers hundreds of fetches. `capped` says some products
 * weren't searched.
 */
export function searchCatalogueIds(rows: ProductRow[], cap = SEARCH_CATALOGUE_CAP): { ids: string[]; capped: boolean } {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.catalogueId)) continue;
    seen.add(row.catalogueId);
    if (ids.length < cap) ids.push(row.catalogueId);
  }
  return { ids, capped: seen.size > ids.length };
}

/** The distinct catalogues of some rows, in order. */
export function catalogueIdsOf(rows: ProductRow[]): string[] {
  return [...new Set(rows.map((row) => row.catalogueId))];
}

/**
 * The rows a search shows: those in the searched catalogues whose catalogue
 * has loaded and whose product matches every word.
 */
export function searchProducts(rows: ProductRow[], terms: string[], searchedIds: string[], catalogues: CatalogueMap): ProductRow[] {
  const searched = new Set(searchedIds);
  return rows.filter((row) => searched.has(row.catalogueId) && matchesSearch(productOf(row, catalogues), terms));
}
