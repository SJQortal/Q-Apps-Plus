/**
 * Delete the current shop (DeleteShopDialog asks first, then
 * PublishProductsDialog sends it): the shop, its product list, its
 * collections and every catalogue of it become the delete marker
 * (qdn/payloads.ts buildDeleteShopPublish), the shop first.
 *
 * Its catalogues are the ones its product list names (read fresh, plus the
 * page's copy) and any other catalogue of this shop id the seller published
 * (one paged prefix search, exact ids only, ones already deleted left out),
 * so nothing of the shop stays readable in either app.
 *
 * Once the shop itself is gone it leaves the seller's shops and every list
 * at once (and is remembered for an hour: the node lists it until a block
 * confirms the delete), its drafts go, and another of the seller's shops
 * becomes current, or none.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import {
  clearDataCotainer,
  removeManyFromProductsToSave,
  resetListProducts,
  setCurrentStore,
  setOwnShopStatus,
  updateRecentlyVisitedStoreId,
} from "../state/features/globalSlice";
import { removeFromHashMapStores, setAllMyStores } from "../state/features/storeSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { CATALOGUE_BASE, collectionsIdentifier, dataContainerIdentifier, isCatalogueOfShop, shortStoreIdOf } from "../qdn/identifiers";
import { collectionsPointer } from "../qdn/collections";
import { buildDeleteShopPublish, type DataContainerDoc, type PublishResource } from "../qdn/payloads";
import { fetchQdnJson, invalidateQdnJson, invalidateQdnSearches, resourceExists, searchQdnAll } from "../qdn/search";
import { isDeletedRow, noteDeletedShop } from "../qdn/deleted";
import { errorMessage } from "../qdn/hubErrors";
import { markShopDeleted } from "../discovery/shopDetails";
import { loadOwnShop } from "../hooks/useOwnShops";
import { indexKey, isProductIndexDoc, notePublishedIndex } from "./productIndex";
import { isDraftOfShop } from "./shopDrafts";

/** Catalogue search pages (of 100) read at most: 10,000 products. */
export const CATALOGUE_SEARCH_PAGES = 10;

export const DELETE_SHOP_SEARCH_FAILED_TEXT =
  "Couldn't list your shop's catalogues on your node, so nothing was deleted. Try again in a minute.";

export interface DeleteShopJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  storeId: string;
  name: string;
}

/** Every catalogue id a product list names. */
function catalogueIdsOf(index: Pick<DataContainerDoc, "products" | "catalogues"> | null | undefined): string[] {
  const ids: string[] = [];
  for (const entry of Object.values(index?.products ?? {})) if (entry?.catalogueId) ids.push(entry.catalogueId);
  for (const cat of index?.catalogues ?? []) if (cat?.id) ids.push(cat.id);
  return ids;
}

export function useDeleteShop() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<DeleteShopJob | null>(null);

  /** Resolves true when the delete is ready to send (`job`); otherwise `error` says why not. */
  const prepare = useCallback(async (): Promise<boolean> => {
    setError(null);
    const name = user?.name;
    if (!name) {
      setError("Sign in with your Qortal name to delete your shop.");
      return false;
    }
    if (!currentStore?.id) {
      setError("Your shop isn't loaded yet. Try again in a moment.");
      return false;
    }
    const storeId = currentStore.id;
    const short = currentStore.shortStoreId || shortStoreIdOf(storeId);
    setPreparing(true);
    try {
      const ids = new Set<string>();
      let collectionsId: string | null = null;
      if (dataContainer && dataContainer.storeId === storeId) {
        for (const id of catalogueIdsOf(dataContainer as unknown as DataContainerDoc)) ids.add(id);
        collectionsId = collectionsPointer(dataContainer, storeId);
      }
      try {
        const fresh = await fetchQdnJson("DOCUMENT", name, dataContainerIdentifier(storeId), { fresh: true });
        if (isProductIndexDoc(fresh)) {
          for (const id of catalogueIdsOf(fresh)) ids.add(id);
          collectionsId ??= collectionsPointer(fresh, storeId);
        }
      } catch {
        // Deleted, missing or no answer: the page's copy and the search below cover it.
      }
      // Collections the list doesn't point at (say, after "Recreate shop data") are found by id.
      if (!collectionsId) {
        const id = collectionsIdentifier(short);
        if (await resourceExists("DOCUMENT", name, id, { fresh: true }).catch(() => false)) collectionsId = id;
      }
      let rows;
      try {
        ({ rows } = await searchQdnAll(
          {
            service: "DOCUMENT",
            name,
            identifier: `${CATALOGUE_BASE}-${short}-`,
            prefix: true,
            exactmatchnames: true,
            includemetadata: true,
          },
          { pageSize: 100, maxPages: CATALOGUE_SEARCH_PAGES, fresh: true }
        ));
      } catch {
        setError(DELETE_SHOP_SEARCH_FAILED_TEXT);
        return false;
      }
      const deleted = new Set<string>();
      for (const row of rows) {
        if (row.name !== name || !isCatalogueOfShop(row.identifier, short)) continue;
        if (isDeletedRow(row)) deleted.add(row.identifier);
        else ids.add(row.identifier);
      }
      // Only this shop's own catalogue ids: a list naming another shop's catalogue mustn't delete it.
      const catalogueIds = [...ids].filter((id) => isCatalogueOfShop(id, short) && !deleted.has(id));
      const { resources } = buildDeleteShopPublish({ name, storeId, catalogueIds, collectionsId });
      const labels: Record<string, string> = {
        [storeId]: "Shop",
        [dataContainerIdentifier(storeId)]: "Product list",
        ...(collectionsId && { [collectionsId]: "Collections" }),
      };
      catalogueIds.forEach((id, i) => {
        labels[id] = `Catalogue ${i + 1}`;
      });
      setJob({ resources, labels, storeId, name });
      return true;
    } catch (e) {
      setError(errorMessage(e, "Couldn't prepare the delete. Try again."));
      return false;
    } finally {
      setPreparing(false);
    }
  }, [user, currentStore, dataContainer]);

  /** The shop itself is gone: it leaves the seller's shops and every list, and another shop becomes current. */
  const forgetShop = useCallback(
    (current: DeleteShopJob) => {
      const { storeId, name, resources } = current;
      noteDeletedShop(name, storeId);
      markShopDeleted(name, storeId);
      for (const r of resources) invalidateQdnJson(r.service, name, r.identifier);
      invalidateQdnSearches((url) => url.includes("service=STORE") || url.includes("service=DOCUMENT"));
      const state = store.getState();
      // A shop created again under this id mustn't take the deleted list, still served for a while, as news.
      const page = state.global.dataContainer;
      if (page && page.storeId === storeId) {
        notePublishedIndex(storeId, indexKey(page as unknown as DataContainerDoc), `deleted:${storeId}`);
      }
      const remaining = state.store.myStores.filter((s) => s.id !== storeId);
      dispatch(setAllMyStores(remaining));
      if (state.store.hashMapStores[storeId]?.owner === name) dispatch(removeFromHashMapStores(storeId));
      const drafts = state.global.productsToSave;
      const draftIds = Object.keys(drafts).filter((id) => isDraftOfShop(drafts[id] as { id?: string; storeId?: unknown }, storeId));
      if (draftIds.length > 0) dispatch(removeManyFromProductsToSave(draftIds));
      if (state.global.currentStore?.id !== storeId) return;
      dispatch(setCurrentStore(null));
      dispatch(clearDataCotainer());
      dispatch(resetListProducts());
      const next = remaining[0];
      if (!next) {
        dispatch(setOwnShopStatus("none"));
        dispatch(updateRecentlyVisitedStoreId(""));
        return;
      }
      // useOwnShops loads the shop the recently visited id names; if it names it already, load it here.
      if (state.global.recentlyVisitedStoreId === next.id) void loadOwnShop(dispatch, next);
      else dispatch(updateRecentlyVisitedStoreId(next.id));
    },
    [dispatch, store]
  );

  /** Everything is on QDN. */
  const done = useCallback(() => {
    if (!job) return;
    forgetShop(job);
    dispatch(setNotification({ msg: "Shop deleted", alertType: "success" }));
    setJob(null);
  }, [job, forgetShop, dispatch]);

  /**
   * Closed before everything landed. Resolves true when the shop itself is
   * gone (the rest only held what nobody can reach from it any more).
   */
  const closed = useCallback(
    (sent: string[]): boolean => {
      if (!job) return false;
      const shopGone = sent.includes(job.storeId);
      if (shopGone) {
        forgetShop(job);
        dispatch(
          setNotification({ msg: "Shop deleted. Some of its products' details weren't cleared from QDN.", alertType: "info" })
        );
      } else if (sent.length > 0) {
        dispatch(
          setNotification({
            msg: "Your shop wasn't deleted, but parts of it were. Delete it again to finish.",
            alertType: "info",
          })
        );
      }
      setJob(null);
      return shopGone;
    },
    [job, forgetShop, dispatch]
  );

  return { prepare, preparing, error, job, done, closed };
}
