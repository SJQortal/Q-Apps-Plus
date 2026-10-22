/**
 * Publish the drafts: build the catalogues and the product index with the
 * original's builder (qdn/payloads.ts buildProductPublish, unchanged), hand
 * them to PublishProductsDialog, and once everything is on QDN update Redux as
 * the original did (clear the drafts, the new index, the products, the
 * catalogues) and drop the cached copies.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ShortUniqueId from "short-unique-id";
import type { AppDispatch, RootState } from "../state/store";
import {
  clearAllProductsToSave,
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
import { invalidateQdnJson, invalidateQdnSearches } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";

const uid = new ShortUniqueId({ length: 10 });

class PrepareError extends Error {}

export interface PublishJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  catalogues: CatalogueDoc[];
  dataContainer: DataContainerDoc;
  storeId: string;
  name: string;
}

export function usePublishProducts() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const productsToSave = useSelector((state: RootState) => state.global.productsToSave);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<PublishJob | null>(null);

  const prepare = useCallback(async () => {
    setError(null);
    const name = user?.name;
    if (!user?.address || !name) return setError("Sign in with your Qortal name to publish.");
    if (!currentStore?.id) return setError("Your shop isn't loaded yet.");
    // As the original checks: the product index must be this shop's.
    if (!dataContainer?.products || dataContainer.storeId !== currentStore.id) {
      return setError("Your shop's product list isn't loaded yet. Try again in a moment.");
    }
    if (Object.keys(productsToSave).length === 0) return;
    const storeId = currentStore.id;
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
      const built = await buildProductPublish({
        name,
        shortStoreId: shortStoreIdOf(storeId),
        dataContainer: dataContainer as unknown as DataContainerDoc,
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
      setJob({ ...built, labels, storeId, name });
    } catch (e) {
      setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
    } finally {
      setPreparing(false);
    }
  }, [user, currentStore, dataContainer, productsToSave]);

  /** Everything is on QDN: the original's Redux updates, then fresh reads. */
  const done = useCallback(() => {
    if (!job) return;
    const { dataContainer: dc, catalogues, storeId, name, resources } = job;
    dispatch(clearAllProductsToSave());
    dispatch(setDataContainer({ ...dc, id: dataContainerIdentifier(storeId) }));
    dispatch(setProducts(Object.keys(dc.products).map((key) => ({ ...dc.products[key], id: key }))));
    const map: Record<string, Catalogue> = {};
    for (const cat of catalogues) map[cat.id] = cat as unknown as Catalogue;
    dispatch(updateCatalogueHashMap(map));
    for (const r of resources) invalidateQdnJson(r.service, name, r.identifier);
    invalidateQdnSearches((url) => url.includes("service=DOCUMENT"));
    dispatch(setNotification({ msg: "Products published", alertType: "success" }));
    setJob(null);
  }, [job, dispatch]);

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

  return { prepare, preparing, error, clearError: () => setError(null), job, done, closed };
}
