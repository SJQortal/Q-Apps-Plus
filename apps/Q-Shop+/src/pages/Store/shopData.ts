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
import type { Catalogue } from "../../state/features/globalSlice";
import type { Product } from "../../state/features/storeSlice";
import { AVAILABLE, OUT_OF_STOCK, RETIRED } from "../../constants/product-status";

/** Products per page on the shop page; catalogues are fetched for these only. */
export const PRODUCTS_PAGE = 20;
/** A text search reads at most this many catalogues (10 products each). */
export const SEARCH_CATALOGUE_CAP = 30;

export type ProductSort = "newest" | "oldest" | "price-asc" | "price-desc";

export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** One product as the shop's index lists it. */
export interface ProductRow {
  productId: string;
  catalogueId: string;
  created: number;
  priceQort?: number;
  category?: string;
  /** The index's status; the catalogue's, once loaded, wins (as in the original). */
  status?: string;
}

export interface ProductQuery {
  categories: string[];
  inStockOnly: boolean;
  sort: ProductSort;
}

export const DEFAULT_PRODUCT_QUERY: ProductQuery = { categories: [], inStockOnly: false, sort: "newest" };

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
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
  return productOf(row, catalogues)?.status || row.status || undefined;
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

export function isInStock(row: ProductRow, catalogues: CatalogueMap): boolean {
  return effectiveStatus(row, catalogues) === AVAILABLE;
}

export function isRetired(status: string | undefined): boolean {
  return status === RETIRED;
}

/** The order a sort gives (newest first for equal values). */
export function compareRows(sort: ProductSort): (a: ProductRow, b: ProductRow) => number {
  const newest = (a: ProductRow, b: ProductRow) => b.created - a.created;
  switch (sort) {
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

/** Category and stock filters, then the sort. Returns a new array. */
export function filterAndSortProducts(rows: ProductRow[], query: ProductQuery, catalogues: CatalogueMap): ProductRow[] {
  const categories = new Set(query.categories);
  return rows
    .filter((row) => isListed(row, catalogues))
    .filter((row) => categories.size === 0 || (!!row.category && categories.has(row.category)))
    .filter((row) => !query.inStockOnly || isInStock(row, catalogues))
    .sort(compareRows(query.sort));
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
