import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setCatalogueHashMap, setCurrentStore, setDataContainer } from "../../state/features/globalSlice";
import { addToReviews } from "../../state/features/storeSlice";
import { installMockNode, makeWorld } from "../../test/mockNode";
import { currentStoreFrom } from "../../hooks/useOwnShops";
import { DATA_CONTAINER_ID, SELLER, STORE_ID, dataContainer, storeJson } from "../../test/fixtures/shop";
import { useCatalogue, useCatalogueLoader, useShopReviews, useViewedShop } from "./useShopData";
import { getShopDetails, resetShopDetails } from "../../discovery/shopDetails";
import { shopKey } from "../../discovery/shopIndex";

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

  it("hands the shop it read to the home cards, and the seller's own copy after an edit", async () => {
    resetShopDetails();
    installMockNode(makeWorld());
    const key = shopKey(SELLER, STORE_ID);
    const visitor = renderHook(() => useViewedShop(SELLER, STORE_ID), { wrapper: wrapperFor(createAppStore()) });
    await waitFor(() => expect(visitor.result.current.shopStatus).toBe("ready"));
    expect(getShopDetails(key)).toMatchObject({ status: "ready", valid: true, shop: { title: "Seller's Shop" } });
    visitor.unmount();

    const store = createAppStore();
    store.dispatch(addUser({ address: "Q", publicKey: "pk", name: SELLER }));
    store.dispatch(setCurrentStore(currentStoreFrom(STORE_ID, SELLER, storeJson)));
    store.dispatch(setDataContainer({ ...dataContainer, id: DATA_CONTAINER_ID }));
    renderHook(() => useViewedShop(SELLER, STORE_ID), { wrapper: wrapperFor(store) });
    // The seller tools publish an edit and update their copy: the home card follows.
    const logo = "data:image/webp;base64,TkVX";
    act(() => {
      store.dispatch(setCurrentStore(currentStoreFrom(STORE_ID, SELLER, { ...storeJson, logo, supportedCoins: ["QORT", "BTC"], foreignCoins: { BTC: "bc1q" } })));
    });
    expect(getShopDetails(key)).toMatchObject({ status: "ready", shop: { logo, supportedCoins: ["QORT", "BTC"] } });
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

describe("catalogues of the right owner only", () => {
  const CAT = "q-store-catalogue-my-shop-CAT0000001";
  const P11 = "q-store-product-my-shop-P000000011";
  /** Another name's copy under the seller's catalogue identifier (pitfall 15). */
  const mallorys = (user: string | null = "Mallory") => ({
    id: CAT,
    ...(user ? { user } : {}),
    isValid: true,
    products: { [P11]: { title: "Pay me directly", price: [{ currency: "qort", value: 1 }], status: "AVAILABLE" } },
  });

  it("reads a catalogue again under the owner's name when the shared map holds another name's copy", async () => {
    const node = installMockNode(makeWorld());
    const store = createAppStore();
    store.dispatch(setCatalogueHashMap(mallorys()));
    const { result } = renderHook(() => useCatalogueLoader(SELLER), { wrapper: wrapperFor(store) });
    expect(result.current.catalogues[CAT]).toBeUndefined();
    act(() => result.current.load([CAT]));
    await waitFor(() => expect(result.current.catalogues[CAT]?.products[P11]?.title).toBe("Product 11"));
    expect(node.fetchCalls.filter((u) => u.includes(CAT))).toEqual([`/arbitrary/DOCUMENT/Seller%20Name/${CAT}`]);
    expect(store.getState().global.catalogueHashMap[CAT]).toMatchObject({ user: SELLER });
    // Another screen puts the other copy back in the shared map: this page keeps the owner's.
    act(() => {
      store.dispatch(setCatalogueHashMap(mallorys()));
    });
    expect(result.current.catalogues[CAT]?.products[P11]?.title).toBe("Product 11");
    act(() => result.current.load([CAT]));
    expect(node.fetchCalls.filter((u) => u.includes(CAT))).toHaveLength(1);
  });

  it("counts an entry without a publisher (the seller's own publish) only on the signed-in seller's shop", async () => {
    const node = installMockNode(makeWorld());
    const store = createAppStore();
    store.dispatch(setCatalogueHashMap(mallorys(null)));
    const visitor = renderHook(() => useCatalogueLoader(SELLER), { wrapper: wrapperFor(store) });
    expect(visitor.result.current.catalogues[CAT]).toBeUndefined();
    visitor.unmount();
    store.dispatch(addUser({ address: "Q", publicKey: "pk", name: SELLER }));
    const seller = renderHook(() => useCatalogueLoader(SELLER), { wrapper: wrapperFor(store) });
    expect(seller.result.current.catalogues[CAT]?.products[P11]?.title).toBe("Pay me directly");
    act(() => seller.result.current.load([CAT]));
    expect(node.fetchCalls.filter((u) => u.includes(CAT))).toHaveLength(0);
  });

  it("the product page reads the owner's catalogue instead of another name's copy", async () => {
    const node = installMockNode(makeWorld());
    const store = createAppStore();
    store.dispatch(setCatalogueHashMap(mallorys()));
    const { result } = renderHook(() => useCatalogue(SELLER, CAT), { wrapper: wrapperFor(store) });
    expect(result.current.catalogue).toBeUndefined();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.catalogue?.products[P11]?.title).toBe("Product 11");
    expect(node.fetchCalls.filter((u) => u.includes(CAT))).toEqual([`/arbitrary/DOCUMENT/Seller%20Name/${CAT}`]);
    act(() => {
      store.dispatch(setCatalogueHashMap(mallorys()));
    });
    expect(result.current.catalogue?.products[P11]?.title).toBe("Product 11");
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
