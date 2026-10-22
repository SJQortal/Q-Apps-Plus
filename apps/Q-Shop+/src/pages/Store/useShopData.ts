/**
 * Loading a shop, its products and its reviews for the shop and product
 * pages (docs/QORTAL.md → Efficiency rules, pitfall 14).
 *
 * The original sent two searches before reading a shop (one by identifier,
 * one with `limit: 0` only to learn whether the product index exists), then
 * read the shop and the index one after the other, and redirected home with
 * a red toast when anything was slow. Here:
 * - the shop JSON and the index are read in parallel, through the session
 *   cache (the home list and the shop's own loader share it);
 * - a search runs only when a read fails, to tell "doesn't exist" (limit 1)
 *   from "not on this node yet";
 * - not there yet → "Fetching from peers…", retried after 2, 4 and 8 s, then
 *   "Not available on your node right now" with Retry;
 * - your own current shop comes from the Redux copy the seller tools keep
 *   up to date, without a fetch.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import { setCatalogueHashMap, updateRecentlyVisitedStoreId, type Catalogue, type CurrentStore } from "../../state/features/globalSlice";
import {
  addToHashMapStores,
  setCurrentViewedStore,
  setStoreId,
  setStoreOwner,
  setViewedStoreDataContainer,
  type StoreReview,
} from "../../state/features/storeSlice";
import { dataContainerIdentifier, shortStoreIdOf } from "../../qdn/identifiers";
import { fetchQdnJson, mapWithConcurrency, resourceExists } from "../../qdn/search";
import { currentStoreFrom } from "../../hooks/useOwnShops";
import { checkStructureStore } from "../../utils/checkStructure";
import { CATALOGUE_CONCURRENCY, fetchCatalogue, type LoadedCatalogue } from "../../utils/fetchCatalogues";
import { normalizeShopJson } from "../../discovery/shopJson";
import { primeShopDetails } from "../../discovery/shopDetails";
import { RetryCancelled, withPeerRetries } from "./peerRetry";
import { fetchReviewRows, shopReviewsFrom, summarizeReviews, type ShopReview } from "./reviewsData";

/** loading → (fetching →) ready, or not there: missing (doesn't exist) / unavailable (exists, can't be read now). */
export type LoadStatus = "loading" | "fetching" | "ready" | "missing" | "unavailable";

export interface ShopIndex {
  products: Record<string, unknown>;
  [key: string]: unknown;
}

type ReadResult<T> = { kind: "ok"; value: T } | { kind: "missing" } | { kind: "unavailable" };

/**
 * Reads a resource's JSON. On the first failure one search (limit 1) asks
 * whether it exists at all; if it does, the read is retried while the node
 * fetches it from peers.
 */
async function readOrMissing<T>(
  service: string,
  name: string,
  identifier: string,
  options: { fresh: boolean; isAlive: () => boolean; onRetry: () => void; read?: () => Promise<T> }
): Promise<ReadResult<T>> {
  let missing = false;
  const read = options.read ?? (() => fetchQdnJson<T>(service, name, identifier, { fresh: options.fresh }));
  try {
    const value = await withPeerRetries(read, {
      isAlive: options.isAlive,
      onRetry: options.onRetry,
      shouldRetry: async (_error, attempt) => {
        if (attempt > 0) return true;
        const exists = await resourceExists(service, name, identifier, { fresh: true }).catch(() => true);
        missing = !exists;
        return exists;
      },
    });
    return { kind: "ok", value };
  } catch (error) {
    if (error instanceof RetryCancelled) throw error;
    return missing ? { kind: "missing" } : { kind: "unavailable" };
  }
}

interface ShopLoad {
  key: string;
  shopStatus: LoadStatus;
  shop: CurrentStore | null;
  productsStatus: LoadStatus;
  index: ShopIndex | null;
}

function isIndex(value: unknown): value is ShopIndex {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export interface ViewedShop {
  shop: CurrentStore | null;
  shopStatus: LoadStatus;
  /** The product index (data container); null until read, or when there is none. */
  index: ShopIndex | null;
  productsStatus: LoadStatus;
  /** The signed-in name owns this shop. */
  isOwner: boolean;
  /** Read everything again, bypassing the session cache. */
  retry: () => void;
}

/**
 * A shop by owner and id, and (unless `products: false`) its product index.
 * Also tells the rest of the app which shop is being viewed (the cart and
 * the edit dialog read `store.storeId`, `store.storeOwner` and
 * `store.currentViewedStore`, as in the original).
 */
export function useViewedShop(owner: string, storeId: string, options: { products?: boolean } = {}): ViewedShop {
  const withProducts = options.products ?? true;
  const dispatch = useDispatch();
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const ownIndex = useSelector((state: RootState) => state.global.dataContainer);
  const viewed = useSelector((state: RootState) => state.store.currentViewedStore);
  const viewedIndex = useSelector((state: RootState) => state.store.viewedStoreDataContainer);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<ShopLoad | null>(null);

  const isOwner = !!userName && userName === owner;
  const containerId = dataContainerIdentifier(storeId);
  const ownShop = isOwner && currentStore?.id === storeId ? currentStore : null;
  const ownShopIndex =
    ownShop && ownIndex && ((ownIndex as { id?: string }).id === containerId || ownIndex.storeId === storeId) ? (ownIndex as unknown as ShopIndex) : null;
  const servedFromRedux = !!ownShop && (!withProducts || !!ownShopIndex);
  const shopKey = `${owner}\n${storeId}\n`;
  const key = `${shopKey}${attempt}\n${withProducts}`;

  useEffect(() => {
    if (!owner || !storeId) return;
    dispatch(setStoreId(storeId));
    dispatch(setStoreOwner(owner));
    dispatch(updateRecentlyVisitedStoreId(storeId));
  }, [dispatch, owner, storeId]);

  useEffect(() => {
    if (!owner || !storeId || servedFromRedux) return;
    let alive = true;
    const isAlive = () => alive;
    const fresh = attempt > 0;
    const patch = (next: Partial<ShopLoad>) =>
      setLoad((prev) => {
        let base: ShopLoad;
        if (prev?.key === key) base = prev;
        // Retrying the same shop: keep what was already shown.
        else if (prev && prev.key.startsWith(shopKey) && prev.shop) base = { ...prev, key, productsStatus: withProducts ? "loading" : "ready" };
        else base = { key, shopStatus: "loading", shop: null, productsStatus: withProducts ? "loading" : "ready", index: null };
        return { ...base, ...next };
      });

    const readShop = async () => {
      const result = await readOrMissing<any>("STORE", owner, storeId, {
        fresh,
        isAlive,
        onRetry: () => patch({ shopStatus: "fetching" }),
      });
      if (!alive) return;
      // Fields of the wrong type are dropped before anything renders them (discovery/shopJson.ts).
      const json = result.kind === "ok" ? normalizeShopJson(result.value) : null;
      if (!json) {
        patch({ shopStatus: result.kind === "missing" ? "missing" : "unavailable" });
        return;
      }
      const shop = currentStoreFrom(storeId, owner, json);
      patch({ shopStatus: "ready", shop });
      if (!isOwner) dispatch(setCurrentViewedStore(shop));
      if (checkStructureStore(json)) {
        dispatch(addToHashMapStores({ ...json, owner, id: storeId, isValid: true }));
        // The home card shows this copy too (logo, coins), without reading it again.
        primeShopDetails(owner, storeId, json);
      }
    };

    const readIndex = async () => {
      if (!withProducts) return;
      const result = await readOrMissing<unknown>("DOCUMENT", owner, containerId, {
        fresh,
        isAlive,
        onRetry: () => patch({ productsStatus: "fetching" }),
      });
      if (!alive) return;
      if (result.kind !== "ok") {
        patch({ productsStatus: result.kind });
        return;
      }
      const index: ShopIndex = isIndex(result.value)
        ? { ...result.value, products: isIndex(result.value.products) ? (result.value.products as Record<string, unknown>) : {} }
        : { products: {} };
      patch({ productsStatus: "ready", index });
      if (!isOwner) dispatch(setViewedStoreDataContainer({ ...index, id: containerId }));
    };

    Promise.all([readShop(), readIndex()]).catch((error) => {
      if (!(error instanceof RetryCancelled)) console.error(error);
    });
    return () => {
      alive = false;
    };
  }, [attempt, containerId, dispatch, isOwner, key, owner, servedFromRedux, shopKey, storeId, withProducts]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // The seller's own copy stays as it is for their edits; the page shows a checked one.
  const ownShopView = useMemo(() => (ownShop ? (normalizeShopJson(ownShop) as unknown as CurrentStore) : null), [ownShop]);
  // After an edit (the seller tools update this copy), the home card shows the new logo and coins at once.
  useEffect(() => {
    if (ownShopView) primeShopDetails(owner, storeId, ownShopView);
  }, [owner, ownShopView, storeId]);

  if (servedFromRedux) {
    return { shop: ownShopView, shopStatus: "ready", index: ownShopIndex, productsStatus: "ready", isOwner, retry };
  }
  if (load?.key === key) {
    return { shop: load.shop, shopStatus: load.shopStatus, index: load.index, productsStatus: load.productsStatus, isOwner, retry };
  }
  if (load?.shop && load.key.startsWith(shopKey)) {
    // A retry has started: the shop stays while its products load again.
    return { shop: load.shop, shopStatus: "ready", index: null, productsStatus: withProducts ? "loading" : "ready", isOwner, retry };
  }
  // Coming back to the shop viewed last: show it at once while the cache answers.
  const cachedShop = attempt === 0 && viewed?.id === storeId && viewed.owner === owner ? viewed : null;
  const cachedIndex =
    cachedShop && viewedIndex && (viewedIndex as { id?: string }).id === containerId ? (viewedIndex as unknown as ShopIndex) : null;
  return {
    shop: cachedShop,
    shopStatus: cachedShop ? "ready" : "loading",
    index: cachedIndex,
    productsStatus: !withProducts || cachedIndex ? "ready" : "loading",
    isOwner,
    retry,
  };
}

export type CatalogueStatus = "fetching" | "failed";

/**
 * Whether a catalogue in the shared map is `owner`'s. The map keeps
 * catalogues by identifier only, and another name can publish under the same
 * identifier (docs/QORTAL.md → pitfall 15): a shop that lists someone else's
 * catalogue ids puts its own copies there, with its own titles, prices and
 * descriptions. An entry counts when it was read under the owner's name
 * (`user`), or, without a `user` (the signed-in seller's own publish stores
 * none), when the signed-in name is the owner.
 */
export function isOwnersCatalogue(entry: Catalogue | undefined, owner: string, signedIn: string | undefined): entry is Catalogue {
  if (!entry || !entry.products || typeof entry.products !== "object") return false;
  return entry.user ? entry.user === owner : !!signedIn && signedIn === owner;
}

/**
 * Loads catalogues on demand, at most 5 at a time, each once (kept in
 * `global.catalogueHashMap`, which the cart and the orders screens share).
 * Catalogues the node hasn't got yet are retried after 2, 4 and 8 s.
 *
 * `catalogues` holds the owner's catalogues only: an entry of another name
 * in the shared map counts as not loaded and is read again under the owner's
 * name. What this hook read is also kept here, so another screen putting a
 * different name's copy in the shared map later doesn't change this page.
 */
export function useCatalogueLoader(owner: string) {
  const dispatch = useDispatch();
  const shared = useSelector((state: RootState) => state.global.catalogueHashMap);
  const signedIn = useSelector((state: RootState) => state.auth.user?.name);
  const [fetched, setFetched] = useState<{ owner: string; catalogues: Record<string, Catalogue> }>({ owner, catalogues: {} });
  const [statuses, setStatuses] = useState<Record<string, CatalogueStatus>>({});
  const started = useRef(new Set<string>());
  const alive = useRef(true);

  const catalogues = useMemo(() => {
    const view: Record<string, Catalogue> = {};
    for (const [id, entry] of Object.entries(shared)) {
      if (isOwnersCatalogue(entry, owner, signedIn)) view[id] = entry;
    }
    if (fetched.owner === owner) {
      for (const [id, entry] of Object.entries(fetched.catalogues)) {
        if (!view[id]) view[id] = entry;
      }
    }
    return view;
  }, [fetched, owner, shared, signedIn]);
  const known = useRef(catalogues);

  useEffect(() => {
    known.current = catalogues;
  }, [catalogues]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setStatus = useCallback((id: string, status: CatalogueStatus | null) => {
    setStatuses((prev) => {
      if (status === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev[id] === status ? prev : { ...prev, [id]: status };
    });
  }, []);

  /** Starts loading the catalogues among `ids` that aren't loaded or loading. */
  const load = useCallback(
    (ids: string[]) => {
      if (!owner) return;
      const todo = ids.filter((id) => !known.current[id] && !started.current.has(`${owner}\n${id}`));
      if (todo.length === 0) return;
      todo.forEach((id) => started.current.add(`${owner}\n${id}`));
      void mapWithConcurrency(todo, CATALOGUE_CONCURRENCY, async (id) => {
        try {
          // By the owner's name and the identifier, never the body's (fetchCatalogue).
          const catalogue = await withPeerRetries(() => fetchCatalogue(owner, id), {
            isAlive: () => alive.current,
            onRetry: () => setStatus(id, "fetching"),
          });
          if (!alive.current) return;
          setFetched((prev) =>
            prev.owner === owner
              ? { owner, catalogues: { ...prev.catalogues, [id]: catalogue } }
              : { owner, catalogues: { [id]: catalogue } }
          );
          dispatch(setCatalogueHashMap(catalogue));
          setStatus(id, null);
        } catch (error) {
          if (error instanceof RetryCancelled || !alive.current) return;
          setStatus(id, "failed");
        }
      });
    },
    [dispatch, owner, setStatus]
  );

  /** Tries the failed catalogues again. */
  const retryFailed = useCallback(() => {
    const failed = Object.keys(statuses).filter((id) => statuses[id] === "failed");
    failed.forEach((id) => {
      started.current.delete(`${owner}\n${id}`);
      setStatus(id, null);
    });
    load(failed);
  }, [load, owner, setStatus, statuses]);

  return { catalogues, statuses, load, retryFailed };
}

/**
 * One catalogue, for the product page: from the shared map when a list
 * already read it under the owner's name (isOwnersCatalogue), else fetched
 * by the owner's name (as the original did), with the peer retries;
 * `missing` when it doesn't exist at all.
 */
export function useCatalogue(owner: string, catalogueId: string): { catalogue: Catalogue | undefined; status: LoadStatus; retry: () => void } {
  const dispatch = useDispatch();
  const shared = useSelector((state: RootState) => state.global.catalogueHashMap[catalogueId]);
  const signedIn = useSelector((state: RootState) => state.auth.user?.name);
  const [fetched, setFetched] = useState<{ owner: string; catalogue: Catalogue } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; status: LoadStatus } | null>(null);
  const key = `${owner}\n${catalogueId}\n${attempt}`;
  const catalogue = isOwnersCatalogue(shared, owner, signedIn)
    ? shared
    : fetched && fetched.owner === owner && fetched.catalogue.id === catalogueId
      ? fetched.catalogue
      : undefined;
  const have = !!catalogue;

  useEffect(() => {
    if (have || !owner || !catalogueId) return;
    let alive = true;
    readOrMissing<LoadedCatalogue>("DOCUMENT", owner, catalogueId, {
      fresh: attempt > 0,
      isAlive: () => alive,
      onRetry: () => setResult({ key, status: "fetching" }),
      read: () => fetchCatalogue(owner, catalogueId, { fresh: attempt > 0 }),
    }).then(
      (read) => {
        if (!alive) return;
        if (read.kind === "ok") {
          setFetched({ owner, catalogue: read.value });
          dispatch(setCatalogueHashMap(read.value));
        }
        setResult({ key, status: read.kind === "ok" ? "ready" : read.kind });
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [attempt, catalogueId, dispatch, have, key, owner]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const status: LoadStatus = have ? "ready" : result?.key === key ? result.status : "loading";
  return { catalogue, status, retry };
}

export interface ShopReviews {
  status: "loading" | "ready" | "error";
  /** The reviews that count, newest first (see reviewsData.ts). */
  reviews: ShopReview[];
  summary: ReturnType<typeof summarizeReviews>;
  /** More than 300 review rows: only the latest were read. */
  capped: boolean;
  reload: () => void;
}

/**
 * A shop's reviews and their summary. The shop header and the reviews panel
 * both call this; they share one cached search. Reviews published from here
 * (`store.storeReviews`) show at once, before the node lists them.
 */
export function useShopReviews(storeId: string, owner: string | null | undefined): ShopReviews {
  const shortStoreId = shortStoreIdOf(storeId);
  const published = useSelector((state: RootState) => state.store.storeReviews) as StoreReview[];
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<{ key: string; status: "ready" | "error"; rows: any[]; complete: boolean } | null>(null);
  const key = `${shortStoreId}\n${nonce}`;

  useEffect(() => {
    if (!shortStoreId) return;
    let alive = true;
    fetchReviewRows(shortStoreId, { fresh: nonce > 0 }).then(
      ({ rows, complete }) => {
        if (alive) setResult({ key, status: "ready", rows, complete });
      },
      () => {
        if (alive) setResult({ key, status: "error", rows: [], complete: true });
      }
    );
    return () => {
      alive = false;
    };
  }, [key, nonce, shortStoreId]);

  const current = result?.key === key ? result : null;
  const reviews = useMemo(
    () => shopReviewsFrom(current?.rows ?? [], shortStoreId, owner, published as ShopReview[]),
    [current, owner, published, shortStoreId]
  );
  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return {
    status: !shortStoreId ? "ready" : current ? current.status : "loading",
    reviews,
    summary,
    capped: current ? !current.complete : false,
    reload,
  };
}
