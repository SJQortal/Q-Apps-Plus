/**
 * Publish the drafts: build the catalogues and the product index with the
 * original's builder (qdn/payloads.ts buildProductPublish, unchanged), hand
 * them to PublishProductsDialog, and once everything is on QDN update Redux as
 * the original did (clear the drafts, the new index, the products, the
 * catalogues) and drop the cached copies.
 *
 * The index is read fresh from the node first and the publish builds on it
 * (seller/productIndex.ts). If it names products or changes the page hasn't
 * seen (a publish from another tab or device), the page shows them and says
 * so, and nothing is published until the seller presses Publish again: the
 * original rebuilt the index from the copy loaded with the page and dropped
 * them. If the node answers but can't serve the index, nothing is published.
 * Only when the node can't be asked at all does it build on the page's copy,
 * as the original did.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ShortUniqueId from "short-unique-id";
import type { AppDispatch, RootState } from "../state/store";
import {
  clearAllProductsToSave,
  removeManyFromProductsToSave,
  setCatalogueHashMap,
  setDataContainer,
  setProducts,
  updateCatalogueHashMap,
  type Catalogue,
} from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { dataContainerIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import {
  buildProductPublish,
  type CatalogueDoc,
  type DataContainerDoc,
  type ProductDraft,
  type PublishResource,
} from "../qdn/payloads";
import { QdnFetchError, fetchQdnJson, invalidateQdnJson, invalidateQdnSearches, mapWithConcurrency } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";
import { draftsOfShop } from "./shopDrafts";
import {
  changedCatalogueIds,
  indexKey,
  isOwnPublishNotServedYet,
  isProductIndexDoc,
  mergeProductIndexes,
  notePublishedIndex,
} from "./productIndex";
import { CATALOGUE_CONCURRENCY, fetchCatalogue, isOwnCatalogue } from "./useCatalogueLoader";

const uid = new ShortUniqueId({ length: 10 });

class PrepareError extends Error {}

export const INDEX_UNREADABLE_TEXT =
  "Couldn't read your product list from your node, so nothing was published. It may still be on its way from peers: try again in a minute.";
export const INDEX_CHANGED_TEXT =
  "Your product list on QDN changed since this page loaded, perhaps from another device. It's updated here now: check your products, then publish again.";

/**
 * The product index as the node serves it now, or null when the node can't
 * be asked at all (no answer). Throws PrepareError when the node answers but
 * can't serve it (not on the node yet, or not an index).
 */
async function readFreshIndex(name: string, storeId: string): Promise<DataContainerDoc | null> {
  let body: unknown;
  try {
    body = await fetchQdnJson("DOCUMENT", name, dataContainerIdentifier(storeId), { fresh: true });
  } catch (error) {
    if (error instanceof QdnFetchError) throw new PrepareError(INDEX_UNREADABLE_TEXT);
    return null;
  }
  if (!isProductIndexDoc(body)) throw new PrepareError(INDEX_UNREADABLE_TEXT);
  return body;
}

export interface PublishJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  catalogues: CatalogueDoc[];
  dataContainer: DataContainerDoc;
  storeId: string;
  name: string;
  /** The drafts this publish sends. */
  draftIds: string[];
  /** What the index this publish built on named (productIndex.indexKey). */
  baseKey: string;
}

export function usePublishProducts() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const allDrafts = useSelector((state: RootState) => state.global.productsToSave);
  const catalogueHashMap = useSelector((state: RootState) => state.global.catalogueHashMap);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<PublishJob | null>(null);

  /**
   * The index on QDN names products or changes the page hasn't seen: show
   * them (the merged index; page-held catalogues of what changed are read
   * again) and say so.
   */
  const showNewerIndex = useCallback(
    async (seen: DataContainerDoc, merged: DataContainerDoc, storeId: string, name: string) => {
      const containerId = dataContainerIdentifier(storeId);
      dispatch(setDataContainer({ ...merged, id: containerId }));
      dispatch(setProducts(Object.keys(merged.products).map((key) => ({ ...merged.products[key], id: key }))));
      const held = changedCatalogueIds(seen, merged).filter((id) => isOwnCatalogue(catalogueHashMap[id], name));
      await mapWithConcurrency(held, CATALOGUE_CONCURRENCY, async (id) => {
        const catalogue = await fetchCatalogue(name, id).catch(() => null);
        if (catalogue) dispatch(setCatalogueHashMap(catalogue));
      });
      setNotice(INDEX_CHANGED_TEXT);
    },
    [catalogueHashMap, dispatch]
  );

  const prepare = useCallback(async () => {
    setError(null);
    setNotice(null);
    const name = user?.name;
    if (!user?.address || !name) return setError("Sign in with your Qortal name to publish.");
    if (!currentStore?.id) return setError("Your shop isn't loaded yet.");
    // As the original checks: the product index must be this shop's.
    if (!dataContainer?.products || dataContainer.storeId !== currentStore.id) {
      return setError("Your shop's product list isn't loaded yet. Try again in a moment.");
    }
    const storeId = currentStore.id;
    // Only this shop's drafts: the list is shared by every shop of the seller.
    const productsToSave = draftsOfShop(allDrafts, storeId);
    if (Object.keys(productsToSave).length === 0) return;
    // A catalogue holding a product being edited must be read, or the edit
    // would be lost; the last catalogue, only topped up, may be skipped (new
    // products then open a new catalogue, as the original did).
    const edited = new Set(
      Object.values(productsToSave)
        .filter((p) => p?.isUpdate)
        .map((p) => p.catalogueId)
    );
    setPreparing(true);
    try {
      // The publish builds on the page's copy only once it holds everything the
      // index on QDN names now; otherwise the page shows what's new first.
      const seen = dataContainer as unknown as DataContainerDoc;
      const seenKey = indexKey(seen);
      const fresh = await readFreshIndex(name, storeId);
      if (fresh) {
        const freshKey = indexKey(fresh);
        if (freshKey !== seenKey && !isOwnPublishNotServedYet(storeId, seenKey, freshKey)) {
          const merged = mergeProductIndexes(seen, fresh);
          if (indexKey(merged) !== seenKey) {
            await showNewerIndex(seen, merged, storeId, name);
            return;
          }
          // Otherwise the node's copy names nothing the page hasn't seen: it lags behind.
        }
      }
      const base = seen;
      const built = await buildProductPublish({
        name,
        shortStoreId: shortStoreIdOf(storeId),
        dataContainer: base,
        productsToSave: productsToSave as unknown as Record<string, ProductDraft>,
        fetchCatalogue: async (catalogueId) => {
          let res: any = null;
          try {
            res = await qortalRequest({
              action: "FETCH_QDN_RESOURCE",
              name,
              service: "DOCUMENT",
              identifier: catalogueId,
            });
          } catch {
            res = null;
          }
          if (res && typeof res === "object" && !res.error && res.products) return res as CatalogueDoc;
          if (edited.has(catalogueId)) {
            throw new PrepareError(
              "Some products you edited couldn't be read from your node, so their changes can't be saved yet. Try again in a minute."
            );
          }
          return null;
        },
        newUid: () => uid(),
      });
      const labels: Record<string, string> = {};
      built.catalogues.forEach((cat, i) => {
        const n = Object.keys(cat.products ?? {}).length;
        labels[cat.id] = `Catalogue ${i + 1} · ${n === 1 ? "1 product" : `${n} products`}`;
      });
      labels[built.dataContainer.id] = "Product list";
      setJob({ ...built, labels, storeId, name, draftIds: Object.keys(productsToSave), baseKey: indexKey(base) });
    } catch (e) {
      setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
    } finally {
      setPreparing(false);
    }
  }, [user, currentStore, dataContainer, allDrafts, showNewerIndex]);

  /** Everything is on QDN: the original's Redux updates, then fresh reads. */
  const done = useCallback(() => {
    if (!job) return;
    const { dataContainer: dc, catalogues, storeId, name, resources, draftIds, baseKey } = job;
    notePublishedIndex(storeId, baseKey, indexKey(dc));
    // As the original: every draft goes. Drafts for the seller's other shops stay.
    if (draftIds.length === Object.keys(allDrafts).length) dispatch(clearAllProductsToSave());
    else dispatch(removeManyFromProductsToSave(draftIds));
    dispatch(setDataContainer({ ...dc, id: dataContainerIdentifier(storeId) }));
    dispatch(setProducts(Object.keys(dc.products).map((key) => ({ ...dc.products[key], id: key }))));
    const map: Record<string, Catalogue> = {};
    for (const cat of catalogues) map[cat.id] = cat as unknown as Catalogue;
    dispatch(updateCatalogueHashMap(map));
    for (const r of resources) invalidateQdnJson(r.service, name, r.identifier);
    invalidateQdnSearches((url) => url.includes("service=DOCUMENT"));
    dispatch(setNotification({ msg: "Products published", alertType: "success" }));
    setJob(null);
  }, [job, allDrafts, dispatch]);

  /** Closed before everything landed: the drafts stay, so publishing again finishes it. */
  const closed = useCallback(
    (published: string[]) => {
      if (published.length > 0) {
        dispatch(
          setNotification({
            msg: "Not everything was published. Your drafts are kept: publish again to finish.",
            alertType: "info",
          })
        );
      }
      setJob(null);
    },
    [dispatch]
  );

  return { prepare, preparing, error, notice, clearError: () => setError(null), job, done, closed };
}
