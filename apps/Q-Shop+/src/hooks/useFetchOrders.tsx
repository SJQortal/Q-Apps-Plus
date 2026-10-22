/**
 * The original's fetch hook. The order lists now load through src/orders
 * (paged per list, opened 5 at a time, statuses in one search per list);
 * `getOrders`, `getMyOrders` and `getOrder` hand over to it for any caller
 * still using them. `getProducts`, `getCatalogue` and
 * `checkAndUpdateResourceCatalogue` serve the shop, product and seller pages
 * and work as before.
 */
import React from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { Product } from "../state/features/storeSlice";
import type { RootState } from "../state/store";
import { addToHashMap, type Order } from "../state/features/orderSlice";
import { fetchAndEvaluateOrders } from "../utils/fetchOrders";
import {
  type Catalogue,
  type ProductDataContainer,
  setCatalogueHashMap,
  setIsLoadingGlobal,
  upsertProducts,
} from "../state/features/globalSlice";
import { fetchAndEvaluateCatalogues } from "../utils/fetchCatalogues";
import { shortStoreIdOf } from "../qdn/identifiers";
import { loadOrders, type OrderStore } from "../orders/loader";

interface Resource {
  id: string;
  updated: number;
}

export const useFetchOrders = () => {
  const dispatch = useDispatch();
  const store: OrderStore = useStore<RootState>();
  const hashMapOrders = useSelector((state: RootState) => state.order.hashMapOrders);
  const currentStore = useSelector((state: RootState) => state.global?.currentStore);
  const userName = useSelector((state: RootState) => state.auth.user?.name);
  const products: Product[] = useSelector((state: RootState) => state.global.products);
  const listProducts = useSelector((state: RootState) => state.global.listProducts);
  const catalogueHashMap = useSelector((state: RootState) => state.global.catalogueHashMap);

  /** One order, read and decrypted as the original does; a failed one is skipped (Bugs 4). */
  const getOrder = React.useCallback(
    async (user: string, orderId: string, content: any) => {
      const res = await fetchAndEvaluateOrders({ user, orderId, content });
      if (res?.isValid) dispatch(addToHashMap(res));
      return res;
    },
    [dispatch]
  );

  const getCatalogue = React.useCallback(
    async (user: string, catalogueId: string) => {
      const res = await fetchAndEvaluateCatalogues({
        user,
        catalogueId,
      });
      if (res?.isValid) {
        dispatch(setCatalogueHashMap(res));
        return res;
      }
    },
    [dispatch]
  );

  const checkAndUpdateResource = React.useCallback(
    (resource: Resource) => {
      // New, or updated since it was read.
      const existingResource: Order | undefined = hashMapOrders[resource.id];
      if (!existingResource) return true;
      return !!(resource?.updated && existingResource?.updated && resource.updated > existingResource.updated);
    },
    [hashMapOrders]
  );

  const checkAndUpdateResourceCatalogue = React.useCallback(
    (resource: { id: string }) => {
      // Only catalogues not fetched yet.
      const existingResource: Catalogue | undefined = catalogueHashMap[resource.id];
      return !existingResource;
    },
    [catalogueHashMap]
  );

  /** The next page of the orders your current shop received. */
  const getOrders = React.useCallback(async () => {
    if (!currentStore?.id) return;
    await loadOrders(
      store,
      {
        kind: "seller",
        storeId: currentStore.id,
        shortStoreId: shortStoreIdOf(currentStore.id),
        seller: currentStore.owner || userName || "",
      },
      store.getState().order.seller.owner === currentStore.id ? "more" : "first"
    );
  }, [store, currentStore, userName]);

  /** The next page of the orders `name` placed (paged from the buyer's own list: Bugs 5). */
  const getMyOrders = React.useCallback(
    async (name: string) => {
      if (!name) return;
      await loadOrders(store, { kind: "buyer", name }, store.getState().order.buyer.owner === name ? "more" : "first");
    },
    [store]
  );

  // Fetch the product resources and set it with its metadata inside the catalogueHashMap. The product resources were originally set in Redux in the global wrapper by fetching the data-container from QDN
  const getProducts = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true));
      const offset = products.length;
      const productList = listProducts.products;
      const responseData = productList.slice(offset, offset + 20);
      const structureData = responseData.map((product: ProductDataContainer): Product => {
        return {
          created: product?.created,
          catalogueId: product.catalogueId,
          id: product?.productId || "",
          user: product?.user || "",
          status: product?.status || "",
        };
      });

      dispatch(upsertProducts(structureData));
      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdateResourceCatalogue({
            id: content.catalogueId,
          });
          if (res) {
            getCatalogue(content.user, content.catalogueId);
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [dispatch, products, listProducts, checkAndUpdateResourceCatalogue, getCatalogue]);

  return {
    getOrder,
    hashMapOrders,
    checkAndUpdateResource,
    getOrders,
    getProducts,
    getCatalogue,
    checkAndUpdateResourceCatalogue,
    getMyOrders,
  };
};
