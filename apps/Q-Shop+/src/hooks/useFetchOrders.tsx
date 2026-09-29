import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Product } from "../state/features/storeSlice";
import { addToHashMap } from "../state/features/orderSlice";

import { RootState } from "../state/store";
import { Order, upsertOrders } from "../state/features/orderSlice";
import { fetchAndEvaluateOrders } from "../utils/fetchOrders";
import {
  Catalogue,
  ProductDataContainer,
  setCatalogueHashMap,
  setIsLoadingGlobal,
  upsertMyOrders,
  upsertProducts
} from "../state/features/globalSlice";
import { fetchAndEvaluateCatalogues } from "../utils/fetchCatalogues";
import { ORDER_BASE, STORE_BASE } from "../constants/identifiers";

interface Resource {
  id: string;
  updated: number;
}
export const useFetchOrders = () => {
  const dispatch = useDispatch();
  const hashMapOrders = useSelector(
    (state: RootState) => state.order.hashMapOrders
  );
  const orders = useSelector((state: RootState) => state.order.orders);
  const store = useSelector(
    (state: RootState) => state.global?.currentStore?.id
  );
  const myOrders = useSelector((state: RootState) => state.global.myOrders);

  const products: Product[] = useSelector(
    (state: RootState) => state.global.products
  );
  const listProducts = useSelector(
    (state: RootState) => state.global.listProducts
  );

  const catalogueHashMap = useSelector(
    (state: RootState) => state.global.catalogueHashMap
  );

  const getOrder = async (user: string, orderId: string, content: any) => {
    const res = await fetchAndEvaluateOrders({
      user,
      orderId,
      content
    });
    dispatch(addToHashMap(res));
    return res;
  };

  const getCatalogue = async (user: string, catalogueId: string) => {
    const res = await fetchAndEvaluateCatalogues({
      user,
      catalogueId
    });
    if (res?.isValid) {
      dispatch(setCatalogueHashMap(res));
      return res;
    }
  };

  const checkAndUpdateResource = React.useCallback(
    (resource: Resource) => {
      // Check if the post exists in hashMapPosts
      const existingResource: Order | undefined = hashMapOrders[resource.id];
      if (!existingResource) {
        // If the post doesn't exist, add it to hashMapPosts
        return true;
      } else if (
        resource?.updated &&
        existingResource?.updated &&
        resource.updated > existingResource.updated
      ) {
        // If the post exists and its updated is more recent than the existing post's updated, update it in hashMapPosts
        return true;
      } else {
        return false;
      }
    },
    [hashMapOrders]
  );

  const checkAndUpdateResourceCatalogue = React.useCallback(
    (resource: { id: string }) => {
      // Check if the post exists in hashMapPosts
      const existingResource: Catalogue | undefined =
        catalogueHashMap[resource.id];
      if (!existingResource) {
        // If the post doesn't exist, add it to hashMapPosts
        return true;
      } else {
        return false;
      }
    },
    [catalogueHashMap]
  );

  // Get the orders that you've received from your own store
  const getOrders = React.useCallback(async () => {
    if (!store) return;

    try {
      dispatch(setIsLoadingGlobal(true));
      const offset = orders.length;
      const parts = store.split(`${STORE_BASE}-`);
      const shortStoreId = parts[1];

      const query = `${ORDER_BASE}-${shortStoreId}`;
      const url = `/arbitrary/resources/search?service=DOCUMENT_PRIVATE&query=${query}&limit=20&includemetadata=true&mode=ALL&offset=${offset}&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const responseData = await response.json();

      const structureData = responseData.map((order: any): Order => {
        return {
          created: order?.created,
          updated: order?.updated,
          user: order.name,
          id: order.identifier
        };
      });

      dispatch(upsertOrders(structureData));
      // Get the order raw data from getOrder API Call only if the hashMapOrders doesn't have the order or if the order is more recently updated than the existing order
      let localOrderHashMap: Record<string, Order> = {};
      for (const content of structureData) {
        if (hashMapOrders[content.id] || localOrderHashMap[content.id]) {
          continue;
        }
        if (content.user && content.id) {
          const res = checkAndUpdateResource(content);
          if (res) {
            const fetchedOrder: Order = await getOrder(
              content.user,
              content.id,
              content
            );
            if (fetchedOrder) {
              localOrderHashMap = {
                ...localOrderHashMap,
                [fetchedOrder.id]: fetchedOrder
              };
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [store, orders]);

  // Get the orders that you've made from other stores (not the ones that you've received)
  const getMyOrders = React.useCallback(
    async (name: string) => {
      try {
        dispatch(setIsLoadingGlobal(true));
        const offset = orders.length;
        const query = `${ORDER_BASE}-`;
        const url = `/arbitrary/resources/search?service=DOCUMENT_PRIVATE&query=${query}&limit=20&includemetadata=true&offset=${offset}&name=${name}&exactmatchnames=true&mode=ALL&reverse=true`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });
        const responseData = await response.json();

        const structureData = responseData.map((order: any): Order => {
          return {
            created: order?.created,
            updated: order?.updated,
            user: order.name,
            id: order.identifier
          };
        });

        dispatch(upsertMyOrders(structureData));
        // Get the order raw data from getOrder API Call only if the hashMapOrders doesn't have the order or if the order is more recently updated than the existing order
        let localOrderHashMap: Record<string, Order> = {};
        for (const content of structureData) {
          if (hashMapOrders[content.id] || localOrderHashMap[content.id]) {
            continue;
          }
          if (content.user && content.id) {
            const res = checkAndUpdateResource(content);
            if (res) {
              const fetchedOrder: Order = await getOrder(
                content.user,
                content.id,
                content
              );
              if (fetchedOrder) {
                localOrderHashMap = {
                  ...localOrderHashMap,
                  [fetchedOrder.id]: fetchedOrder
                };
              }
            }
          }
        }
      } catch (error) {
      } finally {
        dispatch(setIsLoadingGlobal(false));
      }
    },
    [store, myOrders]
  );

  // Fetch the product resources and set it with its metadata inside the catalogueHashMap. The product resources were originally set in Redux in the global wrapper by fetching the data-container from QDN
  const getProducts = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true));
      const offset = products.length;
      const productList = listProducts.products;
      const responseData = productList.slice(offset, offset + 20);
      const structureData = responseData.map(
        (product: ProductDataContainer): Product => {
          return {
            created: product?.created,
            catalogueId: product.catalogueId,
            id: product?.productId || "",
            user: product?.user || "",
            status: product?.status || ""
          };
        }
      );

      dispatch(upsertProducts(structureData));
      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdateResourceCatalogue({
            id: content.catalogueId
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
  }, [products, listProducts]);

  return {
    getOrder,
    hashMapOrders,
    checkAndUpdateResource,
    getOrders,
    getProducts,
    getCatalogue,
    checkAndUpdateResourceCatalogue,
    getMyOrders
  };
};
