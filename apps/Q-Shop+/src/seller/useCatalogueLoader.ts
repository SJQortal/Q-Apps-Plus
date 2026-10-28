/**
 * Loads the seller's own catalogues (the DOCUMENTs holding up to 10 products
 * each, with their images) only for the products on screen, five at a time
 * (docs/QORTAL.md → Efficiency rules), and keeps them in
 * `global.catalogueHashMap` as the original did (FETCH_QDN_RESOURCE, stored
 * with `user`, `id` and `isValid`).
 *
 * A catalogue the node doesn't have yet is "Fetching from peers…" and is
 * asked for again after 2, 4 and 8 seconds; after that it is "failed" until
 * the seller presses Retry. An entry another name published under the same
 * identifier (pitfall 15) doesn't count as the seller's.
 *
 * A loaded catalogue that lacks a product its index names can be read again,
 * fresh, once (`refresh`): the copy held may predate a publish from another
 * device. While that read is out the catalogue is "loading" again.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setCatalogueHashMap, type Catalogue } from "../state/features/globalSlice";
import { isDeletedBody, mapWithConcurrency } from "../qdn/search";

export type CatalogueLoad = "idle" | "loading" | "peers" | "failed" | "ready";

/** Waits before each new try, in ms. Tests shorten them. */
export const catalogueRetryDelays = { ms: [2_000, 4_000, 8_000] };
export const CATALOGUE_CONCURRENCY = 5;

/** A catalogue entry belongs to `owner` (entries the seller's own publish stored carry no user). */
export function isOwnCatalogue(entry: Catalogue | undefined, owner: string | undefined): boolean {
  return !!entry && !!entry.products && (!entry.user || entry.user === owner);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One FETCH_QDN_RESOURCE, as the original's fetchAndEvaluateCatalogues asks
 * it. A deleted catalogue (the "D" marker, or a tombstone) holds nothing, so
 * the products the list still names there show as missing from it.
 */
export async function fetchCatalogue(owner: string, catalogueId: string): Promise<Catalogue | null> {
  const res = await qortalRequest({
    action: "FETCH_QDN_RESOURCE",
    name: owner,
    service: "DOCUMENT",
    identifier: catalogueId,
  });
  if (isDeletedBody(res)) return { id: catalogueId, products: {}, user: owner, isValid: true } as unknown as Catalogue;
  if (res && typeof res === "object" && !(res as { error?: unknown }).error && (res as { products?: unknown }).products) {
    return { ...(res as object), user: owner, id: catalogueId, isValid: true } as unknown as Catalogue;
  }
  return null;
}

export function useCatalogueLoader(owner: string | undefined) {
  const dispatch = useDispatch<AppDispatch>();
  const hashMap = useSelector((state: RootState) => state.global.catalogueHashMap);
  const [loads, setLoads] = useState<Record<string, CatalogueLoad>>({});
  const hashMapRef = useRef(hashMap);
  const queued = useRef(new Set<string>());
  const refreshed = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const running = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    hashMapRef.current = hashMap;
  }, [hashMap]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setLoad = useCallback((id: string, load: CatalogueLoad) => {
    if (alive.current) setLoads((prev) => (prev[id] === load ? prev : { ...prev, [id]: load }));
  }, []);

  const loadOne = useCallback(
    async (id: string) => {
      if (!owner) return;
      setLoad(id, "loading");
      const delays = [0, ...catalogueRetryDelays.ms];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (!alive.current) return;
        if (delays[attempt] > 0) {
          setLoad(id, "peers");
          await wait(delays[attempt]);
          if (!alive.current) return;
        }
        try {
          const catalogue = await fetchCatalogue(owner, id);
          if (catalogue) {
            dispatch(setCatalogueHashMap(catalogue));
            setLoad(id, "ready");
            return;
          }
        } catch {
          // Not on the node yet, or the node hiccuped: try again below.
        }
      }
      setLoad(id, "failed");
    },
    [owner, dispatch, setLoad]
  );

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      while (queue.current.length > 0 && alive.current) {
        const batch = queue.current.splice(0);
        await mapWithConcurrency(batch, CATALOGUE_CONCURRENCY, (id) => loadOne(id));
      }
    } finally {
      running.current = false;
    }
  }, [loadOne]);

  /** Asks for these catalogues unless they are loaded, loading or failed. */
  const request = useCallback(
    (ids: string[]) => {
      if (!owner) return;
      let added = false;
      for (const id of ids) {
        if (!id || queued.current.has(id) || isOwnCatalogue(hashMapRef.current[id], owner)) continue;
        queued.current.add(id);
        queue.current.push(id);
        added = true;
      }
      if (added) void pump();
    },
    [owner, pump]
  );

  /** Tries a failed catalogue again. */
  const retry = useCallback(
    (id: string) => {
      queued.current.delete(id);
      setLoads((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      request([id]);
    },
    [request]
  );

  /**
   * Reads a loaded catalogue again, fresh, once while mounted. Returns false
   * when it was read again already (or there is no owner), so the caller can
   * go on with the copy held.
   */
  const refresh = useCallback(
    (id: string): boolean => {
      if (!owner || !id || refreshed.current.has(id)) return false;
      refreshed.current.add(id);
      setLoad(id, "loading");
      void (async () => {
        try {
          const catalogue = await fetchCatalogue(owner, id);
          if (catalogue && alive.current) dispatch(setCatalogueHashMap(catalogue));
        } catch {
          // The copy held stays.
        }
        // Whatever the answer, the catalogue is loaded: the copy held, or the new one.
        setLoad(id, "ready");
      })();
      return true;
    },
    [owner, dispatch, setLoad]
  );

  const statusOf = useCallback(
    (id: string): CatalogueLoad => {
      if (!isOwnCatalogue(hashMap[id], owner)) return loads[id] ?? "idle";
      // Being read again (refresh): loading, though a copy is held.
      return loads[id] === "loading" ? "loading" : "ready";
    },
    [hashMap, loads, owner]
  );

  /** A product's catalogue entry, when its catalogue is the seller's and loaded. */
  const productOf = useCallback(
    (catalogueId: string, productId: string): Record<string, any> | undefined => {
      const entry = hashMap[catalogueId];
      return isOwnCatalogue(entry, owner) ? (entry.products[productId] as Record<string, any> | undefined) : undefined;
    },
    [hashMap, owner]
  );

  return { request, retry, refresh, statusOf, productOf };
}
