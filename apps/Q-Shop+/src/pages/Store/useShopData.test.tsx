import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../../state/features/globalSlice";
import { addToReviews } from "../../state/features/storeSlice";
import { installMockNode, makeWorld } from "../../test/mockNode";
import { currentStoreFrom } from "../../hooks/useOwnShops";
import { DATA_CONTAINER_ID, SELLER, STORE_ID, dataContainer, storeJson } from "../../test/fixtures/shop";
import { useCatalogueLoader, useShopReviews, useViewedShop } from "./useShopData";

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrapperFor(store: ReturnType<typeof createAppStore>) {
  return ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;
}

describe("useViewedShop", { timeout: 20_000 }, () => {
  it("reads the shop and its index in parallel, and tells the app which shop is viewed", async () => {
    const node = installMockNode(makeWorld());
    const store = createAppStore();
    const { result } = renderHook(() => useViewedShop(SELLER, STORE_ID), { wrapper: wrapperFor(store) });
    expect(result.current.shopStatus).toBe("loading");
    await waitFor(() => expect(result.current.productsStatus).toBe("ready"));
    expect(result.current.shop?.title).toBe("Seller's Shop");
    expect(result.current.shop?.owner).toBe(SELLER);
    expect(Object.keys(result.current.index!.products)).toHaveLength(12);
    expect(node.fetchCalls).toEqual([
      "/arbitrary/STORE/Seller%20Name/q-store-general-my-shop",
      "/arbitrary/DOCUMENT/Seller%20Name/q-store-general-my-shop-datacontainer",
    ]);
    const state = store.getState().store;
    expect(state.storeId).toBe(STORE_ID);
    expect(state.storeOwner).toBe(SELLER);
    expect(state.currentViewedStore?.id).toBe(STORE_ID);
    expect(state.viewedStoreListProducts.products).toHaveLength(12);
    expect(state.hashMapStores[STORE_ID]?.title).toBe("Seller's Shop");
    expect(store.getState().global.recentlyVisitedStoreId).toBe(STORE_ID);
  });

  it("serves the owner's current shop from Redux without a fetch", async () => {
    const node = installMockNode(makeWorld());
    const store = createAppStore();
    store.dispatch(addUser({ address: "Q", publicKey: "pk", name: SELLER }));
    store.dispatch(setCurrentStore(currentStoreFrom(STORE_ID, SELLER, storeJson)));
    store.dispatch(setDataContainer({ ...dataContainer, id: DATA_CONTAINER_ID }));
    const { result } = renderHook(() => useViewedShop(SELLER, STORE_ID), { wrapper: wrapperFor(store) });
    expect(result.current.shopStatus).toBe("ready");
    expect(result.current.isOwner).toBe(true);
    expect(Object.keys(result.current.index!.products)).toHaveLength(3);
    expect(node.fetchCalls).toEqual([]);
  });

  it("says missing when the shop doesn't exist", async () => {
    installMockNode(makeWorld());
    const store = createAppStore();
    const { result } = renderHook(() => useViewedShop("Nobody", "q-store-general-none"), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(result.current.shopStatus).toBe("missing"));
    await waitFor(() => expect(result.current.productsStatus).toBe("missing"));
  });
});

describe("useCatalogueLoader", () => {
  it("loads each catalogue once into the shared catalogue map", async () => {
    const node = installMockNode(makeWorld({ productsPerShop: 25 }));
    const store = createAppStore();
    const { result } = renderHook(() => useCatalogueLoader(SELLER), { wrapper: wrapperFor(store) });
    const ids = ["q-store-catalogue-my-shop-CAT0000000", "q-store-catalogue-my-shop-CAT0000001"];
    result.current.load(ids);
    result.current.load(ids);
    await waitFor(() => expect(Object.keys(result.current.catalogues)).toHaveLength(2));
    expect(store.getState().global.catalogueHashMap[ids[0]]).toMatchObject({ id: ids[0], user: SELLER, isValid: true });
    result.current.load(ids);
    expect(node.fetchCalls.filter((u) => u.includes("q-store-catalogue-"))).toHaveLength(2);
  });
});

describe("useShopReviews", () => {
  it("summarises the shop's reviews and adds ones just published here", async () => {
    installMockNode(makeWorld());
    const store = createAppStore();
    const { result } = renderHook(() => useShopReviews(STORE_ID, SELLER), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.summary.count).toBe(6);
    expect(result.current.summary.average).toBeCloseTo(3.5);
    store.dispatch(
      addToReviews({ id: "q-store-review-my-shop-NEWREVIEW1-50", name: "Buyer+One", created: 2e12, title: "t", description: "d", rating: 5 })
    );
    await waitFor(() => expect(result.current.summary.count).toBe(7));
    expect(result.current.reviews[0].name).toBe("Buyer+One");
  });
});
