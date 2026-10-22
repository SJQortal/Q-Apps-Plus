/**
 * Publish the drafts: pictures past the third go to their own documents
 * (qdn/productPictures.ts splitProductPictures), then the catalogues and the
 * product index come from the original's builder (qdn/payloads.ts
 * buildProductPublish, unchanged); hand them to PublishProductsDialog, and once everything is on QDN update Redux as
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
import { useDispatch, useSelector, useStore } from "react-redux";
import ShortUniqueId from "short-unique-id";
import type { AppDispatch, RootState } from "../state/store";
import {
  clearAllProductsToSave,
  removeManyFromProductsToSave,
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
import { invalidateQdnJson, invalidateQdnSearches, isDeletedBody } from "../qdn/search";
import { splitProductPictures } from "../qdn/productPictures";
import { errorMessage } from "../qdn/hubErrors";
import { draftsOfShop } from "./shopDrafts";
import { indexKey, notePublishedIndex } from "./productIndex";
import { INDEX_CHANGED_TEXT, PrepareError, indexOnQdn, useShowNewerIndex } from "./freshIndex";
import { isCatalogueBehind, noteSentCatalogue, sentCatalogue } from "./sentCatalogues";
import { LIST_BUSY_TEXT, LIST_CHANGED_TEXT, releaseListWrite, takeListWrite, useListWriteOwner } from "./listWrite";

export const CATALOGUE_BEHIND_TEXT =
  "Your last change hasn't reached your node yet, so nothing was published. Try again in a minute.";

export { INDEX_CHANGED_TEXT, INDEX_UNREADABLE_TEXT } from "./freshIndex";

const uid = new ShortUniqueId({ length: 10 });

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
  const store = useStore<RootState>();
  const lock = useListWriteOwner();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const allDrafts = useSelector((state: RootState) => state.global.productsToSave);
  const showNewerIndex = useShowNewerIndex();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<PublishJob | null>(null);

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
    if (!takeListWrite(lock)) return setError(LIST_BUSY_TEXT);
    let handedOver = false;
    setPreparing(true);
    try {
      // The publish builds on the page's copy only once it holds everything the
      // index on QDN names now; otherwise the page shows what's new first.
      const seen = dataContainer as unknown as DataContainerDoc;
      const onQdn = await indexOnQdn(name, storeId, seen);
      if (onQdn.kind === "newer") {
        await showNewerIndex(seen, onQdn.merged, storeId, name);
        setNotice(INDEX_CHANGED_TEXT);
        return;
      }
      // The node hasn't caught up with this tab's own last publish: what this tab sent is the newest.
      const nodeBehind = onQdn.kind === "behind";
      const base = seen;
      // Pictures 4–10 go first, in documents of their own; the catalogues keep 3.
      const pictures = splitProductPictures(name, productsToSave as unknown as Record<string, ProductDraft>);
      const built = await buildProductPublish({
        name,
        shortStoreId: shortStoreIdOf(storeId),
        dataContainer: base,
        productsToSave: pictures.drafts,
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
          // A deleted catalogue holds nothing: an edit puts its product back into it.
          if (isDeletedBody(res)) return { id: catalogueId, products: {} };
          if (res && typeof res === "object" && !res.error && res.products) {
            // A different copy of a catalogue this session just sent: building on it could undo that
            // publish. When the node is known to lag behind this tab, build on what this tab sent.
            if (isCatalogueBehind(name, catalogueId, res)) {
              const mine = nodeBehind ? sentCatalogue(name, catalogueId) : null;
              if (mine) return mine as unknown as CatalogueDoc;
              throw new PrepareError(CATALOGUE_BEHIND_TEXT);
            }
            return res as CatalogueDoc;
          }
          if (edited.has(catalogueId)) {
            throw new PrepareError(
              "Some products you edited couldn't be read from your node, so their changes can't be saved yet. Try again in a minute."
            );
          }
          return null;
        },
        newUid: () => uid(),
      });
      const labels: Record<string, string> = { ...pictures.labels };
      built.catalogues.forEach((cat, i) => {
        const n = Object.keys(cat.products ?? {}).length;
        labels[cat.id] = `Catalogue ${i + 1} · ${n === 1 ? "1 product" : `${n} products`}`;
      });
      labels[built.dataContainer.id] = "Product list";
      // The page's list changed while this read the node (say, a reload): build again on the new one.
      if (store.getState().global.dataContainer !== dataContainer) throw new PrepareError(LIST_CHANGED_TEXT);
      setJob({
        ...built,
        resources: [...pictures.resources, ...built.resources],
        labels,
        storeId,
        name,
        draftIds: Object.keys(productsToSave),
        baseKey: indexKey(base),
      });
      handedOver = true;
    } catch (e) {
      setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
    } finally {
      setPreparing(false);
      if (!handedOver) releaseListWrite(lock);
    }
  }, [user, currentStore, dataContainer, allDrafts, showNewerIndex, lock, store]);

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
    for (const cat of catalogues) {
      map[cat.id] = cat as unknown as Catalogue;
      noteSentCatalogue(name, cat);
    }
    dispatch(updateCatalogueHashMap(map));
    for (const r of resources) invalidateQdnJson(r.service, name, r.identifier);
    invalidateQdnSearches((url) => url.includes("service=DOCUMENT"));
    dispatch(setNotification({ msg: "Products published", alertType: "success" }));
    setJob(null);
    releaseListWrite(lock);
  }, [job, allDrafts, dispatch, lock]);

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
      releaseListWrite(lock);
    },
    [dispatch, lock]
  );

  return { prepare, preparing, error, notice, clearError: () => setError(null), job, done, closed };
}
