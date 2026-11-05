/**
 * Publishing prices from a currency (money/fiatPricing.ts): the seller's
 * rates and the products' prices in the currency become QORT and ARRR prices
 * in their catalogues, and the product list gets the new QORT prices and the
 * rates, last. Under the rules of every list write:
 * - one list write at a time (seller/listWrite.ts), and none while the shop
 *   has drafts (publishing them later would put their old prices back);
 * - the product list is read fresh first (seller/freshIndex.ts): a change
 *   from another device is shown and nothing goes out; a node that can't
 *   serve it, or can't be asked, stops it too;
 * - every catalogue holding a product whose price changes is read fresh, so
 *   the other products in it keep what is on QDN now; one that can't be read
 *   stops it, and a copy older than this tab's own last send of it waits for
 *   the node (seller/sentCatalogues.ts);
 * - publishing goes through PublishProductsDialog: batches past 20, the list
 *   last.
 */
import { useCallback, useState } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { AppDispatch, RootState } from "../state/store";
import { setDataContainer, setProducts, updateCatalogueHashMap, type Catalogue } from "../state/features/globalSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { dataContainerIdentifier } from "../qdn/identifiers";
import type { CatalogueDoc, DataContainerDoc, PublishResource } from "../qdn/payloads";
import { invalidateQdnJson, invalidateQdnSearches, isDeletedBody, mapWithConcurrency } from "../qdn/search";
import { errorMessage } from "../qdn/hubErrors";
import { shopCoins } from "../money/coins";
import { buildPricesPublish, type FiatPricing } from "../money/fiatPricing";
import { draftsOfShop } from "./shopDrafts";
import { indexKey, notePublishedIndex } from "./productIndex";
import { INDEX_CHANGED_TEXT, INDEX_UNREADABLE_TEXT, PrepareError, indexOnQdn, useShowNewerIndex } from "./freshIndex";
import { isCatalogueBehind, noteSentCatalogue, sentCatalogue } from "./sentCatalogues";
import { LIST_BUSY_TEXT, LIST_CHANGED_TEXT, releaseListWrite, takeListWrite, useListWriteOwner } from "./listWrite";
import { CATALOGUE_CONCURRENCY } from "./useCatalogueLoader";
import { CATALOGUE_BEHIND_TEXT } from "./usePublishProducts";

export const PRICES_DRAFTS_TEXT =
  "Publish or discard the products in Ready to publish first: publishing them afterwards would put back the prices they have now.";
export const PRICES_UNREADABLE_TEXT =
  "Some of your products couldn't be read from your node, so no prices were published. They may still be on their way from peers: try again in a minute.";

export interface PricesJob {
  resources: PublishResource[];
  labels: Record<string, string>;
  catalogues: CatalogueDoc[];
  dataContainer: DataContainerDoc;
  storeId: string;
  name: string;
  baseKey: string;
  changedProducts: number;
}

export function useShopPricing() {
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const lock = useListWriteOwner();
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const dataContainer = useSelector((state: RootState) => state.global.dataContainer);
  const allDrafts = useSelector((state: RootState) => state.global.productsToSave);
  const showNewerIndex = useShowNewerIndex();
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<PricesJob | null>(null);
  const storeId = currentStore?.id ?? "";

  /**
   * Resolves true when the publish is ready to send (`job`). `prices`:
   * product id → its price in the currency, or null to stop following it;
   * `pricing` null stops pricing in a currency.
   */
  const prepare = useCallback(
    async (args: { pricing: Pick<FiatPricing, "currency" | "rates"> | null; prices: Record<string, number | null> }): Promise<boolean> => {
      setError(null);
      setNotice(null);
      if (!name) {
        setError("Sign in with your Qortal name to publish prices.");
        return false;
      }
      if (!storeId || !dataContainer?.products || dataContainer.storeId !== storeId) {
        setError("Your shop's product list isn't loaded yet. Try again in a moment.");
        return false;
      }
      if (Object.keys(draftsOfShop(allDrafts, storeId)).length > 0) {
        setError(PRICES_DRAFTS_TEXT);
        return false;
      }
      if (!takeListWrite(lock)) {
        setError(LIST_BUSY_TEXT);
        return false;
      }
      let handedOver = false;
      setPreparing(true);
      try {
        const seen = dataContainer as unknown as DataContainerDoc;
        const onQdn = await indexOnQdn(name, storeId, seen);
        if (onQdn.kind === "newer") {
          await showNewerIndex(seen, onQdn.merged, storeId, name);
          setNotice(INDEX_CHANGED_TEXT);
          return false;
        }
        if (onQdn.kind === "unknown") throw new PrepareError(INDEX_UNREADABLE_TEXT);
        const nodeBehind = onQdn.kind === "behind";
        // The catalogues whose products change, read fresh (by the seller's name).
        const ids = [
          ...new Set(Object.keys(args.prices).map((id) => seen.products[id]?.catalogueId).filter((id): id is string => !!id)),
        ];
        const catalogues: Record<string, CatalogueDoc> = {};
        await mapWithConcurrency(ids, CATALOGUE_CONCURRENCY, async (catalogueId) => {
          let res: unknown = null;
          try {
            res = await qortalRequest({ action: "FETCH_QDN_RESOURCE", name, service: "DOCUMENT", identifier: catalogueId });
          } catch {
            res = null;
          }
          // A deleted catalogue holds nothing: none of its products are priced.
          if (isDeletedBody(res)) {
            catalogues[catalogueId] = { id: catalogueId, products: {} };
            return;
          }
          const body = res as { error?: unknown; products?: unknown } | null;
          if (!body || typeof body !== "object" || body.error || !body.products || typeof body.products !== "object") {
            throw new PrepareError(PRICES_UNREADABLE_TEXT);
          }
          if (isCatalogueBehind(name, catalogueId, body)) {
            const mine = nodeBehind ? sentCatalogue(name, catalogueId) : null;
            if (!mine) throw new PrepareError(CATALOGUE_BEHIND_TEXT);
            catalogues[catalogueId] = mine as unknown as CatalogueDoc;
            return;
          }
          catalogues[catalogueId] = body as CatalogueDoc;
        });
        const built = buildPricesPublish({
          name,
          dataContainer: seen,
          catalogues,
          prices: args.prices,
          pricing: args.pricing,
          takesArrr: shopCoins(currentStore).includes("ARRR"),
          now: Date.now(),
        });
        const labels: Record<string, string> = {};
        built.catalogues.forEach((cat, i) => {
          const n = built.changedProducts.filter((id) => built.dataContainer.products[id]?.catalogueId === cat.id).length;
          labels[cat.id] = `Catalogue ${i + 1} · ${n === 1 ? "1 price" : `${n} prices`}`;
        });
        labels[built.resources.at(-1)!.identifier] = args.pricing ? "Product list (prices and rates)" : "Product list";
        if (store.getState().global.dataContainer !== dataContainer) throw new PrepareError(LIST_CHANGED_TEXT);
        setJob({
          resources: built.resources,
          labels,
          catalogues: built.catalogues,
          dataContainer: built.dataContainer,
          storeId,
          name,
          baseKey: indexKey(seen),
          changedProducts: built.changedProducts.length,
        });
        handedOver = true;
        return true;
      } catch (e) {
        setError(e instanceof PrepareError ? e.message : errorMessage(e, "Couldn't prepare the publish. Try again."));
        return false;
      } finally {
        setPreparing(false);
        if (!handedOver) releaseListWrite(lock);
      }
    },
    [name, storeId, dataContainer, allDrafts, lock, showNewerIndex, currentStore, store]
  );

  /** What landed: the catalogues sent are remembered; the list, when it landed, is the page's. */
  const apply = useCallback(
    (current: PricesJob, sent: Set<string>) => {
      const map: Record<string, Catalogue> = {};
      for (const cat of current.catalogues) {
        if (!sent.has(cat.id)) continue;
        map[cat.id] = cat as unknown as Catalogue;
        noteSentCatalogue(current.name, cat);
        invalidateQdnJson("DOCUMENT", current.name, cat.id);
      }
      if (Object.keys(map).length > 0) dispatch(updateCatalogueHashMap(map));
      const listId = dataContainerIdentifier(current.storeId);
      if (sent.has(listId)) {
        notePublishedIndex(current.storeId, current.baseKey, indexKey(current.dataContainer));
        dispatch(setDataContainer({ ...current.dataContainer, id: listId }));
        dispatch(setProducts(Object.keys(current.dataContainer.products).map((key) => ({ ...current.dataContainer.products[key], id: key }))));
        invalidateQdnJson("DOCUMENT", current.name, listId);
      }
      invalidateQdnSearches((url) => url.includes("service=DOCUMENT"));
    },
    [dispatch]
  );

  const done = useCallback(() => {
    if (!job) return;
    apply(job, new Set(job.resources.map((r) => r.identifier)));
    dispatch(setNotification({ msg: "Prices published", alertType: "success" }));
    setJob(null);
    releaseListWrite(lock);
  }, [job, apply, dispatch, lock]);

  const closed = useCallback(
    (sent: string[]) => {
      if (job && sent.length > 0) {
        apply(job, new Set(sent));
        dispatch(setNotification({ msg: "Not everything was published. Publish the prices again to finish.", alertType: "info" }));
      }
      setJob(null);
      releaseListWrite(lock);
    },
    [job, apply, dispatch, lock]
  );

  return { prepare, preparing, error, notice, job, done, closed };
}
