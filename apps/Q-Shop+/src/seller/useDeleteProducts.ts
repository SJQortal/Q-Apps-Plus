/**
 * Delete products (DeleteProductsDialog asks first, then sends what this
 * builds through PublishProductsDialog):
 * - the product index is read fresh (seller/freshIndex.ts): a change from
 *   another device is shown first and nothing is deleted; right after this
 *   tab's own publish, while the node still serves the list from before it,
 *   the seller is asked to try again in a minute, since the catalogues the
 *   node serves could be older still;
 * - each catalogue holding one of the products is read fresh from QDN, so
 *   the other products in it keep what is on QDN now;
 * - qdn/payloads.ts buildDeleteProductsPublish: those catalogues without
 *   them first, then the index without them (sent through
 *   PublishProductsDialog with the index last, after waiting for room in the
 *   account's 25 unconfirmed publishes);
 * - a catalogue this session sent minutes ago and the node serves
 *   differently counts as the node lagging (seller/sentCatalogues.ts):
 *   building on that copy would undo the earlier publish.
 * If the index lands but a catalogue doesn't and the seller closes the
 * dialog, the products are left in those catalogues: the seller page offers
 * Finish deleting (seller/pendingDeletes.ts).
 * Once everything landed, the page's index, products and catalogues follow,
 * the products' drafts go, and the cached copies are dropped. Their orders
 * keep their own copy of each product, so nothing changes for them.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import {
  removeManyFromProductsToSave,
  setDataContainer,
  setProducts,
  updateCatalogueHashMap,
  type Catalogue,
} from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { dataContainerIdentifier } from "../qdn/identifiers";
import {
  buildDeleteProductsPublish,
  cataloguesHolding,
  type CatalogueDoc,
  type DataContainerDoc,
  type PublishResource,
} from "../qdn/payloads";
import { QdnDeletedError, fetchQdnJson, invalidateQdnJson, invalidateQdnSearches, mapWithConcurrency } from "../qdn/search";
import { emptiedPicturesOf, morePicturesOf } from "../qdn/productPictures";
import { errorMessage } from "../qdn/hubErrors";
import { isCatalogueJson } from "../utils/fetchCatalogues";
import { indexKey, notePublishedIndex } from "./productIndex";
import {
  DELETE_INDEX_CHANGED_TEXT,
  DELETE_INDEX_UNREADABLE_TEXT,
  PrepareError,
  indexOnQdn,
  useShowNewerIndex,
} from "./freshIndex";
import { CATALOGUE_CONCURRENCY } from "./useCatalogueLoader";
import { isCatalogueBehind, noteSentCatalogue } from "./sentCatalogues";
import { notePendingDelete } from "./pendingDeletes";
import { LIST_BUSY_TEXT, LIST_CHANGED_TEXT, releaseListWrite, takeListWrite, useListWriteOwner } from "./listWrite";

export const DELETE_NODE_BEHIND_TEXT =
  "Your last change hasn't reached your node yet, so nothing was deleted. Try again in a minute.";
export const DELETE_CATALOGUES_UNREADABLE_TEXT =
  "Some of these products' details couldn't be read from your node, so nothing was deleted. Try again in a minute.";

export interface DeleteProductsJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  dataContainer: DataContainerDoc;
  catalogues: CatalogueDoc[];
  /** The products this deletes (the ones the index lists). */
  removed: string[];
  storeId: string;
  name: string;
  /** What the index this built on named (productIndex.indexKey). */
  baseKey: string;
}

/**
 * Each catalogue as QDN serves it now, raw; a deleted one holds nothing.
 * `failed` when one can't be read; `behind` when one is an older copy of one
 * this session just sent.
 */
export async function readCataloguesFresh(
  name: string,
  ids: string[]
): Promise<{ read: Record<string, CatalogueDoc>; failed: boolean; behind: boolean }> {
  const read: Record<string, CatalogueDoc> = {};
  let failed = false;
  let behind = false;
  await mapWithConcurrency(ids, CATALOGUE_CONCURRENCY, async (id) => {
    try {
      const body = await fetchQdnJson("DOCUMENT", name, id, { fresh: true });
      if (!isCatalogueJson(body)) failed = true;
      else if (isCatalogueBehind(name, id, body)) behind = true;
      else read[id] = body as unknown as CatalogueDoc;
    } catch (error) {
      if (error instanceof QdnDeletedError) read[id] = { id, products: {} };
      else failed = true;
    }
  });
  return { read, failed, behind };
}

export function useDeleteProducts() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const lock = useListWriteOwner();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const drafts = useSelector((state: RootState) => state.global.productsToSave);
  const showNewerIndex = useShowNewerIndex();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<DeleteProductsJob | null>(null);

  /** Resolves true when the publish is ready to send (`job`); otherwise `error` or `notice` says why not. */
  const prepare = useCallback(
    async (productIds: string[]): Promise<boolean> => {
      setError(null);
      setNotice(null);
      const name = user?.name;
      if (!name) {
        setError("Sign in with your Qortal name to delete products.");
        return false;
      }
      if (!currentStore?.id || !dataContainer?.products || dataContainer.storeId !== currentStore.id) {
        setError("Your shop's product list isn't loaded yet. Try again in a moment.");
        return false;
      }
      const storeId = currentStore.id;
      const seen = dataContainer as unknown as DataContainerDoc;
      const listed = [...new Set(productIds)].filter((id) => !!seen.products[id]);
      if (listed.length === 0) {
        setError("These products aren't in your product list.");
        return false;
      }
      if (!takeListWrite(lock)) {
        setError(LIST_BUSY_TEXT);
        return false;
      }
      let handedOver = false;
      setPreparing(true);
      try {
        const state = await indexOnQdn(name, storeId, seen, DELETE_INDEX_UNREADABLE_TEXT);
        if (state.kind === "newer") {
          await showNewerIndex(seen, state.merged, storeId, name);
          setNotice(DELETE_INDEX_CHANGED_TEXT);
          return false;
        }
        if (state.kind === "behind") throw new PrepareError(DELETE_NODE_BEHIND_TEXT);
        if (state.kind === "unknown") throw new PrepareError(DELETE_INDEX_UNREADABLE_TEXT);
        const fresh = await readCataloguesFresh(name, cataloguesHolding(seen, listed));
        if (fresh.behind) throw new PrepareError(DELETE_NODE_BEHIND_TEXT);
        if (fresh.failed) throw new PrepareError(DELETE_CATALOGUES_UNREADABLE_TEXT);
        const catalogues = fresh.read;
        const built = buildDeleteProductsPublish({ name, dataContainer: seen, productIds: listed, catalogues, deletedAt: Date.now() });
        const labels: Record<string, string> = { [dataContainerIdentifier(storeId)]: "Product list" };
        // Their pictures past the third (qdn/productPictures.ts) are emptied once the catalogues no longer
        // hold them (a delete that stops part-way leaves a listed product's pictures alone), before the list.
        const gone = built.removed
          .map((id) => Object.values(catalogues).find((cat) => cat?.products?.[id])?.products?.[id] as { id: string; title?: unknown } | undefined)
          .filter((p): p is { id: string; title?: unknown } => !!p && typeof p.id === "string");
        const pictures = emptiedPicturesOf(name, gone);
        for (const r of pictures) {
          const product = gone.find((p) => morePicturesOf(p)?.id === r.identifier);
          labels[r.identifier] = `More pictures · ${typeof product?.title === "string" && product.title.trim() ? product.title.trim() : "Product"}`;
        }
        built.catalogues.forEach((cat, i) => {
          const left = Object.keys(cat.products ?? {}).length;
          labels[cat.id] = `Catalogue ${i + 1} · ${left === 0 ? "now empty" : left === 1 ? "1 product left" : `${left} products left`}`;
        });
        if (store.getState().global.dataContainer !== dataContainer) throw new PrepareError(LIST_CHANGED_TEXT);
        const list = built.resources[built.resources.length - 1];
        setJob({ ...built, resources: [...built.resources.slice(0, -1), ...pictures, list], labels, storeId, name, baseKey: indexKey(seen) });
        handedOver = true;
        return true;
      } catch (e) {
        setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the delete. Try again."));
        return false;
      } finally {
        setPreparing(false);
        if (!handedOver) releaseListWrite(lock);
      }
    },
    [user, currentStore, dataContainer, showNewerIndex, lock, store]
  );

  /**
   * The page follows what landed: the index (the products leave the shop,
   * their drafts go) and each catalogue sent. When the index landed without
   * some catalogues, those are remembered for Finish deleting. `sent` holds
   * identifiers.
   */
  const apply = useCallback(
    (current: DeleteProductsJob, sent: Set<string>) => {
      const { dataContainer: dc, catalogues, storeId, name, resources, removed, baseKey } = current;
      const listSent = sent.has(dataContainerIdentifier(storeId));
      if (listSent) {
        notePublishedIndex(storeId, baseKey, indexKey(dc));
        dispatch(setDataContainer({ ...dc, id: dataContainerIdentifier(storeId) }));
        dispatch(setProducts(Object.keys(dc.products).map((key) => ({ ...dc.products[key], id: key }))));
        const draftIds = removed.filter((id) => !!drafts[id]);
        if (draftIds.length > 0) dispatch(removeManyFromProductsToSave(draftIds));
      }
      const map: Record<string, Catalogue> = {};
      for (const cat of catalogues) {
        if (!sent.has(cat.id)) continue;
        map[cat.id] = { ...cat, user: name, isValid: true } as unknown as Catalogue;
        noteSentCatalogue(name, cat);
      }
      if (Object.keys(map).length > 0) dispatch(updateCatalogueHashMap(map));
      const left = catalogues.filter((cat) => !sent.has(cat.id)).map((cat) => cat.id);
      if (listSent && left.length > 0) notePendingDelete({ name, storeId, productIds: removed, catalogueIds: left });
      for (const r of resources) if (sent.has(r.identifier)) invalidateQdnJson(r.service, name, r.identifier);
      invalidateQdnSearches((url) => url.includes("service=DOCUMENT"));
    },
    [drafts, dispatch]
  );

  /** Everything is on QDN. */
  const done = useCallback(() => {
    if (!job) return;
    apply(job, new Set(job.resources.map((r) => r.identifier)));
    const n = job.removed.length;
    dispatch(setNotification({ msg: n === 1 ? "Product deleted" : `${n} products deleted`, alertType: "success" }));
    setJob(null);
    releaseListWrite(lock);
  }, [job, apply, dispatch, lock]);

  /** Closed before everything landed: the page follows what did, and says what that means. */
  const closed = useCallback(
    (sent: string[]) => {
      if (job && sent.length > 0) {
        apply(job, new Set(sent));
        const listDone = sent.includes(dataContainerIdentifier(job.storeId));
        dispatch(
          setNotification({
            msg: listDone
              ? "The products left your shop, but some catalogues still hold them. Finish deleting them from your seller page."
              : "Nothing left your shop yet. Delete the products again to finish.",
            alertType: "info",
          })
        );
      }
      setJob(null);
      releaseListWrite(lock);
    },
    [job, apply, dispatch, lock]
  );

  return { prepare, preparing, error, notice, job, done, closed, clear: () => (setError(null), setNotice(null)) };
}
