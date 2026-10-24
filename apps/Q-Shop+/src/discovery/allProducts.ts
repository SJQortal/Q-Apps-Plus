/**
 * Every shop's products in one list, for the Products page (round 5, Simon:
 * "a new tab … called Products which will display all products from the
 * different sellers").
 *
 * The list comes from the shops' product indexes, the DOCUMENT
 * `<storeId>-datacontainer` each shop keeps (docs/apps/Q-Shop+.md → Data
 * contract): for every product its catalogue, `created`, QORT price,
 * category and status, about 120 bytes each. Titles and pictures live in the
 * catalogues, which are big (on Simon's node in October 2026, 131 catalogues
 * held 39 MB, the 113 indexes 52 kB), so a catalogue is read only for the
 * products on screen, or for a search, as a shop page does
 * (pages/Store/shopData.ts).
 *
 * - Which shops: the home page's shop index (listed, not deleted, not the
 *   original's hidden test shop) and its search of the product indexes
 *   (discovery/activity.ts), which gives each one's last update. Both are
 *   the home page's own searches, cached for the session.
 * - Trust (docs/QORTAL.md → pitfall 15): an index and its catalogues are
 *   read under the shop owner's name, never another name's copy.
 * - Newest first without reading every index: indexes are read most
 *   recently updated first, a batch at a time, only as far as the page
 *   needs. A product can't be newer than its index's last update, so one
 *   newer than every unread index's update is in its final place
 *   (`frontier`). Other sorts, a category or a search read every index
 *   (`readAll`): one small read per shop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Catalogue } from "../state/features/globalSlice";
import type { Product } from "../state/features/storeSlice";
import { dataContainerIdentifier } from "../qdn/identifiers";
import { QdnDeletedError, fetchQdnJson } from "../qdn/search";
import { fetchCatalogue } from "../utils/fetchCatalogues";
import { categoryKey, listedCategory } from "../constants/categories";
import { RetryCancelled, withPeerRetries } from "../pages/Store/peerRetry";
import {
  auctionTimesOf,
  compareRows,
  effectiveStatus,
  isInStock,
  inPriceRange,
  isOpenAuction,
  isListed,
  productOf,
  productRowsFromContainer,
  SEARCH_CATALOGUE_CAP,
  type CatalogueMap,
  type ProductRow,
  type ProductSort,
} from "../pages/Store/shopData";
import { loadActivity, type ActivityIndex } from "./activity";
import { loadShopIndex, type ShopEntry } from "./shopIndex";
import type { FavoriteCounts } from "../favorites/model";
import { variantGroupsOf, type VariantGroup } from "../variants/model";

/** Product indexes asked for at a time while paging newest first. */
export const INDEX_BATCH = 8;
/** Index reads in flight at once, across every caller. */
export const INDEX_CONCURRENCY = 4;

export interface ShopSource {
  /** shopKey(owner, storeId) */
  key: string;
  owner: string;
  storeId: string;
  title: string;
  /** When its product index was last published (Infinity when the index search didn't reach it). */
  updated: number;
}

export interface AllProductRow extends ProductRow {
  /** Owner, shop and product: unique across shops. */
  key: string;
  owner: string;
  storeId: string;
  /** The shop's title, from the shop index. */
  shopTitle: string;
  /** A variant's group as its shop's index holds it (variants/model.ts), for bundling. */
  variantGroup?: VariantGroup;
}

function byKey(a: { key: string }, b: { key: string }): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/**
 * The shops to read, the most recently updated product index first. A shop
 * without an index has no products. Past 500 indexes the search stops short:
 * the shops it didn't reach are read last, and could hold anything
 * (`updated` Infinity), so newest first then waits for them.
 */
export function shopSources(shops: ShopEntry[], activity: ActivityIndex): ShopSource[] {
  const known: ShopSource[] = [];
  const rest: ShopSource[] = [];
  for (const shop of shops) {
    const updated = activity.byShop.get(shop.key)?.updated;
    if (updated !== undefined) known.push({ key: shop.key, owner: shop.owner, storeId: shop.id, title: shop.title, updated });
    else if (!activity.complete) {
      rest.push({ key: shop.key, owner: shop.owner, storeId: shop.id, title: shop.title, updated: Number.POSITIVE_INFINITY });
    }
  }
  known.sort((a, b) => b.updated - a.updated || byKey(a, b));
  return [...known, ...rest];
}

/** A shop's products, from its index (malformed entries are skipped). */
export function rowsOfShop(source: ShopSource, index: unknown): AllProductRow[] {
  const container = index && typeof index === "object" && !Array.isArray(index) ? (index as { products?: unknown }) : null;
  const groups = variantGroupsOf(container);
  return productRowsFromContainer(container).map((row) => ({
    ...row,
    key: `${source.owner}\u0000${source.storeId}\u0000${row.productId}`,
    owner: source.owner,
    storeId: source.storeId,
    shopTitle: source.title,
    ...(row.variant && groups[row.variant.group] && { variantGroup: groups[row.variant.group] }),
  }));
}

/**
 * Products newer than this are in their final place, newest first: the
 * latest update among the indexes not read yet (-Infinity once all are).
 */
export function newestFrontier(sources: ShopSource[], isSettled: (key: string) => boolean): number {
  let frontier = Number.NEGATIVE_INFINITY;
  for (const source of sources) {
    if (!isSettled(source.key) && source.updated > frontier) frontier = source.updated;
  }
  return frontier;
}

/** A catalogue across shops: the same id under two names is two catalogues. */
export function catalogueKey(owner: string, catalogueId: string): string {
  return `${owner}\u0000${catalogueId}`;
}

/** Catalogues by catalogueKey. */
export type AllCatalogues = Record<string, Catalogue | undefined>;

/** The shop page's helpers read catalogues by id: this hands them the row's owner's own. */
function ownCatalogue(row: AllProductRow, catalogues: AllCatalogues): CatalogueMap {
  return { [row.catalogueId]: catalogues[catalogueKey(row.owner, row.catalogueId)] };
}

export function productOfRow(row: AllProductRow, catalogues: AllCatalogues): Product | undefined {
  return productOf(row, ownCatalogue(row, catalogues));
}

export function statusOfRow(row: AllProductRow, catalogues: AllCatalogues): string | undefined {
  return effectiveStatus(row, ownCatalogue(row, catalogues));
}

/**
 * A category as the filter groups it, whatever its case and spaces ("Baby"
 * and " baby " are one): products saved before the list (constants/categories.ts)
 * have the seller's own words.
 */
export { categoryKey };

export interface AllProductsQuery {
  /** categoryKey()s; none = every category. */
  categories: string[];
  inStockOnly: boolean;
  /** Only auctions still open (pages/Store/shopData isOpenAuction). */
  auctionsOnly?: boolean;
  /** A price range in QORT (pages/Store/shopData inPriceRange). */
  minQort?: number | null;
  maxQort?: number | null;
  /** "favorites": how many buyers keep each product (favorites/counts.ts), the Products page's own sort. */
  sort: ProductSort | "favorites";
  favorites?: FavoriteCounts | null;
}

/** The products a shop page would list (pages/Store/shopData isListed), in stock when asked. */
export function listedRows(rows: AllProductRow[], inStockOnly: boolean, catalogues: AllCatalogues, now = Date.now()): AllProductRow[] {
  return rows.filter(
    (row) => isListed(row, ownCatalogue(row, catalogues)) && (!inStockOnly || isInStock(row, ownCatalogue(row, catalogues), now))
  );
}

/** When the row's auction runs (its catalogue's terms once loaded), for its card. */
export function auctionTimesOfRow(row: AllProductRow, catalogues: AllCatalogues) {
  return auctionTimesOf(row, ownCatalogue(row, catalogues));
}

/** Whether the row is an auction still open (its catalogue's terms once loaded). */
export function isOpenAuctionRow(row: AllProductRow, catalogues: AllCatalogues, now: number): boolean {
  return isOpenAuction(row, ownCatalogue(row, catalogues), now);
}

/** Listed products, the filters, then the sort; equal ones by key, so the order never shifts as shops arrive. */
export function filterAndSortAll(rows: AllProductRow[], query: AllProductsQuery, catalogues: AllCatalogues, now = Date.now()): AllProductRow[] {
  const categories = new Set(query.categories);
  const favorites = query.favorites;
  const byNewest = compareRows("newest");
  const compare =
    query.sort === "favorites"
      ? (a: AllProductRow, b: AllProductRow) => (favorites ? favorites.product(b.owner, b.productId) - favorites.product(a.owner, a.productId) : 0) || byNewest(a, b)
      : compareRows(query.sort, [], now, (row) => auctionTimesOfRow(row as AllProductRow, catalogues));
  return listedRows(rows, query.inStockOnly, catalogues, now)
    .filter((row) => categories.size === 0 || categories.has(categoryKey(row.category)))
    .filter((row) => !query.auctionsOnly || isOpenAuctionRow(row, catalogues, now))
    .filter((row) => inPriceRange(row, query.minQort, query.maxQort))
    .sort((a, b) => compare(a, b) || byKey(a, b));
}

export interface CategoryOption {
  key: string;
  /** The list's name, or (for a category of the seller's own) the spelling most of its products use. */
  label: string;
  count: number;
  /** One of the list every shop picks from (constants/categories.ts). */
  listed: boolean;
}

/**
 * The categories of these products: the list's first, then the sellers' own
 * words from before the list ("Other categories"), each the biggest first.
 * Products without one aren't counted.
 */
export function categoryOptions(rows: AllProductRow[]): CategoryOption[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const row of rows) {
    const label = (row.category ?? "").trim();
    if (!label) continue;
    const key = categoryKey(label);
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += 1;
    group.spellings.set(label, (group.spellings.get(label) ?? 0) + 1);
    groups.set(key, group);
  }
  const options: CategoryOption[] = [];
  for (const [key, group] of groups) {
    const listed = listedCategory(key);
    const [label] = listed
      ? [listed]
      : [...group.spellings].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0];
    options.push({ key, label, count: group.count, listed: !!listed });
  }
  return options.sort(
    (a, b) =>
      Number(b.listed) - Number(a.listed) ||
      b.count - a.count ||
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }) ||
      (a.key < b.key ? -1 : 1)
  );
}

/**
 * The catalogues a search reads, in list order: at most `cap` (10 products
 * each), so a search never reads every catalogue. `capped` says some
 * products weren't searched.
 */
export function searchCatalogueKeys(rows: AllProductRow[], cap = SEARCH_CATALOGUE_CAP): { keys: string[]; capped: boolean } {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = catalogueKey(row.owner, row.catalogueId);
    if (seen.has(key)) continue;
    seen.add(key);
    if (keys.length < cap) keys.push(key);
  }
  return { keys, capped: seen.size > keys.length };
}

/** Every word is in the product's title, description or category, or its shop's title or owner. */
export function matchesAllSearch(row: AllProductRow, product: Product | undefined, terms: string[]): boolean {
  if (!product) return false;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const haystack = [text(product.title), text(product.description), text(product.category), row.shopTitle, row.owner]
    .join("\n")
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

/** The rows a search shows: in the searched catalogues, loaded, and matching every word. */
export function searchAll(rows: AllProductRow[], terms: string[], searchedKeys: string[], catalogues: AllCatalogues): AllProductRow[] {
  const searched = new Set(searchedKeys);
  return rows.filter(
    (row) => searched.has(catalogueKey(row.owner, row.catalogueId)) && matchesAllSearch(row, productOfRow(row, catalogues), terms)
  );
}

/* ------------------------------------------------------------------ */
/* Loading                                                              */
/* ------------------------------------------------------------------ */

let activeReads = 0;
const waitingReads: (() => void)[] = [];

/** One product index under its owner's name, INDEX_CONCURRENCY at a time. */
async function readIndex(source: ShopSource, fresh: boolean): Promise<unknown> {
  if (activeReads >= INDEX_CONCURRENCY) await new Promise<void>((resolve) => waitingReads.push(resolve));
  activeReads++;
  try {
    return await fetchQdnJson("DOCUMENT", source.owner, dataContainerIdentifier(source.storeId), { fresh });
  } finally {
    activeReads--;
    waitingReads.shift()?.();
  }
}

/** The shops to read (shopSources), from the home page's two cached searches. */
async function fetchSources(fresh: boolean): Promise<ShopSource[]> {
  const [index, activity] = await Promise.all([loadShopIndex({ fresh }), loadActivity({ fresh })]);
  return shopSources(index.shops, activity);
}

type SourceResult = { kind: "ok"; rows: AllProductRow[] } | { kind: "failed" };

interface LoaderState {
  generation: number;
  phase: "loading" | "ready" | "error";
  sources: ShopSource[];
  results: Record<string, SourceResult>;
  /** The first `requested` sources are asked for. */
  requested: number;
  /** Read past the session cache (pull to refresh, Retry). */
  fresh: boolean;
}

export interface AllProducts {
  /** The shop list: loading, read, or unreadable. */
  phase: "loading" | "ready" | "error";
  /** The products of every index read so far. */
  rows: AllProductRow[];
  /** newestFrontier: products newer than this are in their final place. */
  frontier: number;
  /** Every index is read (or given up on). */
  complete: boolean;
  /** Indexes read or given up on, and the shops with an index. */
  read: number;
  total: number;
  /** Indexes the node couldn't give. */
  failed: number;
  /** Index reads in flight. */
  busy: boolean;
  /** Asks for the next batch of indexes (ignored while one is in flight). */
  readMore: () => void;
  /** Asks for every index. */
  readAll: () => void;
  retryFailed: () => void;
  /** Reads the shop list and the indexes again, past the session cache. */
  refresh: () => Promise<void>;
}

const INITIAL: LoaderState = { generation: 0, phase: "loading", sources: [], results: {}, requested: 0, fresh: false };

function settledCount(state: LoaderState): number {
  let n = 0;
  for (const source of state.sources.slice(0, state.requested)) if (state.results[source.key]) n++;
  return n;
}

export function useAllProducts(): AllProducts {
  const [state, setState] = useState<LoaderState>(INITIAL);
  const started = useRef(new Set<string>());
  const alive = useRef(true);
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
  }, [state]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** The shop list read: the first batch of indexes is asked for at once. */
  const sourcesRead = useCallback((generation: number, fresh: boolean, sources: ShopSource[] | null) => {
    if (!alive.current) return;
    setState((prev) => {
      if (prev.generation !== generation) return prev;
      if (!sources) return { ...prev, phase: "error" };
      return { generation, phase: "ready", sources, results: {}, requested: Math.min(INDEX_BATCH, sources.length), fresh };
    });
  }, []);

  useEffect(() => {
    fetchSources(false).then(
      (sources) => sourcesRead(0, false, sources),
      () => sourcesRead(0, false, null)
    );
  }, [sourcesRead]);

  // Reads the requested indexes nobody has started yet.
  const { generation, phase, sources, results, requested, fresh } = state;
  useEffect(() => {
    if (phase !== "ready") return;
    for (const source of sources.slice(0, requested)) {
      const id = `${generation}\u0000${source.key}`;
      if (results[source.key] || started.current.has(id)) continue;
      started.current.add(id);
      void readIndex(source, fresh).then(
        (index): SourceResult => ({ kind: "ok", rows: rowsOfShop(source, index) }),
        // A deleted product list holds nothing; one the node can't give now is counted, with Retry.
        (error): SourceResult => (error instanceof QdnDeletedError ? { kind: "ok", rows: [] } : { kind: "failed" })
      ).then((result) => {
        if (!alive.current) return;
        setState((prev) =>
          prev.generation !== generation ? prev : { ...prev, results: { ...prev.results, [source.key]: result } }
        );
      });
    }
  }, [phase, sources, results, requested, generation, fresh]);

  const readMore = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== "ready" || prev.requested >= prev.sources.length) return prev;
      if (settledCount(prev) < prev.requested) return prev;
      return { ...prev, requested: Math.min(prev.sources.length, prev.requested + INDEX_BATCH) };
    });
  }, []);

  const readAll = useCallback(() => {
    setState((prev) => (prev.phase !== "ready" || prev.requested >= prev.sources.length ? prev : { ...prev, requested: prev.sources.length }));
  }, []);

  const retryFailed = useCallback(() => {
    const current = latest.current;
    const failedKeys = Object.keys(current.results).filter((key) => current.results[key].kind === "failed");
    if (failedKeys.length === 0) return;
    for (const key of failedKeys) started.current.delete(`${current.generation}\u0000${key}`);
    setState((prev) => {
      if (prev.generation !== current.generation) return prev;
      const next = { ...prev.results };
      for (const key of failedKeys) delete next[key];
      return { ...prev, results: next, fresh: true };
    });
  }, []);

  const refresh = useCallback(async () => {
    const generation = latest.current.generation + 1;
    started.current.clear();
    // The old list stays on screen until the new shop list is in.
    setState((prev) => ({ ...prev, generation }));
    try {
      sourcesRead(generation, true, await fetchSources(true));
    } catch {
      sourcesRead(generation, true, null);
    }
  }, [sourcesRead]);

  return useMemo(() => {
    const isSettled = (key: string) => !!results[key];
    const asked = sources.slice(0, requested);
    const rows: AllProductRow[] = [];
    let failed = 0;
    let read = 0;
    for (const source of sources) {
      const result = results[source.key];
      if (!result) continue;
      read++;
      if (result.kind === "ok") rows.push(...result.rows);
      else failed++;
    }
    return {
      phase,
      rows,
      frontier: phase === "ready" ? newestFrontier(sources, isSettled) : Number.POSITIVE_INFINITY,
      complete: phase === "ready" && read === sources.length,
      read,
      total: sources.length,
      failed,
      busy: asked.some((source) => !results[source.key]),
      readMore,
      readAll,
      retryFailed,
      refresh,
    };
  }, [phase, sources, results, requested, readMore, readAll, retryFailed, refresh]);
}

/**
 * Catalogues for the products on screen, across shops: each under the
 * owner's name (fetchCatalogue: one request per catalogue, cached for the
 * session, five at a time across the app), with the peer retries a shop page
 * uses. Kept here, not in the app's catalogue cache, which the cart reads.
 */
export function useAllCatalogues() {
  const [catalogues, setCatalogues] = useState<AllCatalogues>({});
  const [statuses, setStatuses] = useState<Record<string, "fetching" | "failed">>({});
  const started = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setStatus = useCallback((key: string, status: "fetching" | "failed" | null) => {
    setStatuses((prev) => {
      if (status === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev[key] === status ? prev : { ...prev, [key]: status };
    });
  }, []);

  /** Starts loading the catalogues of these rows that aren't loaded or loading. */
  const load = useCallback(
    (rows: Pick<AllProductRow, "owner" | "catalogueId">[]) => {
      for (const row of rows) {
        const key = catalogueKey(row.owner, row.catalogueId);
        if (started.current.has(key)) continue;
        started.current.add(key);
        void withPeerRetries(() => fetchCatalogue(row.owner, row.catalogueId), {
          isAlive: () => alive.current,
          onRetry: () => setStatus(key, "fetching"),
        }).then(
          (catalogue) => {
            if (!alive.current) return;
            setCatalogues((prev) => ({ ...prev, [key]: catalogue }));
            setStatus(key, null);
          },
          (error) => {
            if (error instanceof RetryCancelled || !alive.current) return;
            setStatus(key, "failed");
          }
        );
      }
    },
    [setStatus]
  );

  const statusesRef = useRef(statuses);
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  /** Tries the failed catalogues again. */
  const retryFailed = useCallback(() => {
    const failed = Object.keys(statusesRef.current).filter((key) => statusesRef.current[key] === "failed");
    for (const key of failed) {
      started.current.delete(key);
      setStatus(key, null);
    }
    load(
      failed.map((key) => {
        const [owner, catalogueId] = key.split("\u0000");
        return { owner, catalogueId };
      })
    );
  }, [load, setStatus]);

  return { catalogues, statuses, load, retryFailed };
}
