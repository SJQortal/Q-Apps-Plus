/**
 * Before a publish or a delete rebuilds the product index, the index on QDN
 * is read fresh (seller/productIndex.ts explains why). If it names products
 * or changes the page hasn't seen (a publish from another tab or device), the
 * page shows them and says so, and nothing goes out until the seller asks
 * again: building on the page's copy would drop them. If the node answers
 * but can't serve the index, nothing goes out. Only when the node can't be
 * asked at all does the page's copy stand, as the original did.
 */
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setCatalogueHashMap, setDataContainer, setProducts } from "../state/features/globalSlice";
import { dataContainerIdentifier } from "../qdn/identifiers";
import type { DataContainerDoc } from "../qdn/payloads";
import { QdnFetchError, fetchQdnJson, mapWithConcurrency } from "../qdn/search";
import {
  changedCatalogueIds,
  indexKey,
  isOwnPublishNotServedYet,
  isProductIndexDoc,
  mergeProductIndexes,
} from "./productIndex";
import { CATALOGUE_CONCURRENCY, fetchCatalogue, isOwnCatalogue } from "./useCatalogueLoader";

/** Stops a publish or a delete before anything is sent, with the message to show. */
export class PrepareError extends Error {}

export const INDEX_UNREADABLE_TEXT =
  "Couldn't read your product list from your node, so nothing was published. It may still be on its way from peers: try again in a minute.";
export const INDEX_CHANGED_TEXT =
  "Your product list on QDN changed since this page loaded, perhaps from another device. It's updated here now: check your products, then publish again.";
export const DELETE_INDEX_UNREADABLE_TEXT =
  "Couldn't read your product list from your node, so nothing was deleted. It may still be on its way from peers: try again in a minute.";
export const DELETE_INDEX_CHANGED_TEXT =
  "Your product list on QDN changed since this page loaded, perhaps from another device. It's updated here now: check your products, then delete again.";

/**
 * The product index as the node serves it now, or null when the node can't
 * be asked at all (no answer). Throws PrepareError(`unreadable`) when the
 * node answers but can't serve it (not on the node yet, or not an index).
 */
export async function readFreshIndex(name: string, storeId: string, unreadable = INDEX_UNREADABLE_TEXT): Promise<DataContainerDoc | null> {
  let body: unknown;
  try {
    body = await fetchQdnJson("DOCUMENT", name, dataContainerIdentifier(storeId), { fresh: true });
  } catch (error) {
    if (error instanceof QdnFetchError) throw new PrepareError(unreadable);
    return null;
  }
  if (!isProductIndexDoc(body)) throw new PrepareError(unreadable);
  return body;
}

/**
 * The index on QDN against the page's copy:
 * - same: the node serves what the page holds;
 * - newer: it names products or changes the page hasn't seen (`merged`, which
 *   the page must show first);
 * - behind: it names nothing the page hasn't seen, but lags behind it (this
 *   tab's own last publish isn't served yet);
 * - unknown: the node can't be asked at all.
 */
export type IndexOnQdn = { kind: "same" } | { kind: "newer"; merged: DataContainerDoc } | { kind: "behind" } | { kind: "unknown" };

export async function indexOnQdn(
  name: string,
  storeId: string,
  seen: DataContainerDoc,
  unreadable = INDEX_UNREADABLE_TEXT
): Promise<IndexOnQdn> {
  const seenKey = indexKey(seen);
  const fresh = await readFreshIndex(name, storeId, unreadable);
  if (!fresh) return { kind: "unknown" };
  const freshKey = indexKey(fresh);
  if (freshKey === seenKey) return { kind: "same" };
  if (isOwnPublishNotServedYet(storeId, seenKey, freshKey)) return { kind: "behind" };
  const merged = mergeProductIndexes(seen, fresh);
  return indexKey(merged) !== seenKey ? { kind: "newer", merged } : { kind: "behind" };
}

/**
 * The index the page must show first, or null when its own copy can be
 * built on: it holds everything the index on QDN names, or the node lags
 * behind it, or can't be asked (a product publish then goes on, as the
 * original did).
 */
export async function newerIndexOnQdn(
  name: string,
  storeId: string,
  seen: DataContainerDoc,
  unreadable = INDEX_UNREADABLE_TEXT
): Promise<DataContainerDoc | null> {
  const state = await indexOnQdn(name, storeId, seen, unreadable);
  return state.kind === "newer" ? state.merged : null;
}

/**
 * Shows an index newer than the page's (newerIndexOnQdn): it replaces the
 * page's copy, and the catalogues the page holds of what changed are read
 * again.
 */
export function useShowNewerIndex() {
  const dispatch = useDispatch<AppDispatch>();
  const catalogueHashMap = useSelector((state: RootState) => state.global.catalogueHashMap);
  return useCallback(
    async (seen: DataContainerDoc, merged: DataContainerDoc, storeId: string, name: string) => {
      const containerId = dataContainerIdentifier(storeId);
      dispatch(setDataContainer({ ...merged, id: containerId }));
      dispatch(setProducts(Object.keys(merged.products).map((key) => ({ ...merged.products[key], id: key }))));
      const held = changedCatalogueIds(seen, merged).filter((id) => isOwnCatalogue(catalogueHashMap[id], name));
      await mapWithConcurrency(held, CATALOGUE_CONCURRENCY, async (id) => {
        const catalogue = await fetchCatalogue(name, id).catch(() => null);
        if (catalogue) dispatch(setCatalogueHashMap(catalogue));
      });
    },
    [catalogueHashMap, dispatch]
  );
}
