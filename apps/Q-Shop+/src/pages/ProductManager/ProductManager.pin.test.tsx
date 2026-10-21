/**
 * Pins how the original Product Manager publishes products: the last
 * catalogue is topped up to 10 products, then new catalogues are opened, and
 * the data container (the shop's product index) goes last in one
 * PUBLISH_MULTIPLE_QDN_RESOURCES. Written against the upstream code before any
 * change (docs/apps/Q-Shop+.md → Data contract).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { createAppStore } from "../../state/store";
import { HubThemeProvider } from "../../hub-theme";
import { THEME_STORAGE_KEY, themeConfig } from "../../theme/qplus-theme";
import { addUser } from "../../state/features/authSlice";
import { setCurrentStore, setDataContainer, setProductsToSave } from "../../state/features/globalSlice";
import { installQortalMock } from "../../test/qortalMock";
import {
  CATALOGUE_ID,
  DATA_CONTAINER_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_ID,
  catalogue,
  dataContainer,
  decodeData64,
  mug,
  viewedStore,
} from "../../test/fixtures/shop";
import { ProductManager } from "./ProductManager";

vi.mock("short-unique-id", () => ({
  default: class {
    constructor() {
      return () => "NEWCATxxx1";
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function newProduct(n: number) {
  return {
    title: `New ${n}`,
    description: `New product ${n}`,
    created: 1762000000000 + n,
    version: 1,
    images: ["data:image/webp;base64,TkVX"],
    mainImageIndex: 0,
    type: "digital",
    price: [{ currency: "qort", value: n }],
    storeId: STORE_ID,
    shortStoreId: SHORT_STORE_ID,
    category: "New",
    id: `q-store-product-${SHORT_STORE_ID}-NEWxxxxxx${n}`,
    status: "AVAILABLE",
    user: SELLER,
  };
}

function setup(lastCatalogue: any, container: any) {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore }));
  store.dispatch(setDataContainer(container));
  const q = installQortalMock({
    FETCH_QDN_RESOURCE: async () => structuredClone(lastCatalogue),
    PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[`/product-manager/${STORE_ID}`]}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Routes>
            <Route path="/product-manager/:store" element={<ProductManager />} />
          </Routes>
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  return { store, q };
}

describe("publishing products (pinned)", () => {
  it("tops up the last catalogue, applies edits to it and republishes the data container last", async () => {
    const { store, q } = setup(catalogue, dataContainer);
    const added = newProduct(1);
    store.dispatch(setProductsToSave(added));
    const edited = { ...mug, title: "Big mug", price: [{ currency: "qort", value: 2 }], isUpdate: true, status: "OUT_OF_STOCK" };
    store.dispatch(setProductsToSave(edited));

    fireEvent.click(await screen.findByRole("button", { name: "Save Products" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));

    // The last catalogue is read once (it has fewer than 10 products).
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toContainEqual({
      action: "FETCH_QDN_RESOURCE",
      name: SELLER,
      service: "DOCUMENT",
      identifier: CATALOGUE_ID,
    });

    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(Object.keys(pub).sort()).toEqual(["action", "resources"]);
    expect(pub.resources.map((r: any) => ({ ...r, data64: undefined }))).toEqual([
      { name: SELLER, service: "DOCUMENT", identifier: CATALOGUE_ID, filename: "catalogue.json", data64: undefined },
      { name: SELLER, service: "DOCUMENT", identifier: DATA_CONTAINER_ID, filename: "datacontainer.json", data64: undefined },
    ]);

    const cat = decodeData64(pub.resources[0].data64);
    expect(Object.keys(cat.products)).toEqual([...Object.keys(catalogue.products), added.id]);
    expect(cat.products[added.id]).toEqual({ ...added, catalogueId: CATALOGUE_ID });
    expect(cat.products[mug.id]).toEqual(edited);

    const dc = decodeData64(pub.resources[1].data64);
    expect(dc.storeId).toBe(STORE_ID);
    expect(dc.shortStoreId).toBe(SHORT_STORE_ID);
    expect(dc.owner).toBe(SELLER);
    expect(dc.id).toBe(DATA_CONTAINER_ID);
    expect(dc.products[added.id]).toEqual({
      created: added.created,
      priceQort: 1,
      category: "New",
      catalogueId: CATALOGUE_ID,
      status: "AVAILABLE",
    });
    expect(dc.products[mug.id]).toEqual({
      created: mug.created,
      priceQort: 2,
      category: "Kitchen",
      catalogueId: CATALOGUE_ID,
      status: "OUT_OF_STOCK",
    });
    expect(dc.catalogues).toEqual([
      { id: CATALOGUE_ID, products: { ...dataContainer.catalogues[0].products, [added.id]: true } },
    ]);
  });

  it("opens a new catalogue once the last one holds 10 products", async () => {
    const nine: Record<string, any> = {};
    const nineIndex: Record<string, true> = {};
    for (let i = 0; i < 9; i++) {
      const id = `q-store-product-${SHORT_STORE_ID}-OLDxxxxxx${i}`;
      nine[id] = { ...mug, id, title: `Old ${i}` };
      nineIndex[id] = true;
    }
    const fullish = { id: CATALOGUE_ID, products: nine };
    const container = {
      ...dataContainer,
      products: {},
      catalogues: [{ id: CATALOGUE_ID, products: nineIndex }],
    };
    const { store, q } = setup(fullish, container);
    store.dispatch(setProductsToSave(newProduct(1)));
    store.dispatch(setProductsToSave(newProduct(2)));

    fireEvent.click(await screen.findByRole("button", { name: "Save Products" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    const newCatId = `q-store-catalogue-${SHORT_STORE_ID}-NEWCATxxx1`;
    expect(pub.resources.map((r: any) => r.identifier)).toEqual([CATALOGUE_ID, newCatId, DATA_CONTAINER_ID]);
    expect(Object.keys(decodeData64(pub.resources[0].data64).products)).toHaveLength(10);
    expect(decodeData64(pub.resources[1].data64)).toEqual({
      id: newCatId,
      products: { [newProduct(2).id]: { ...newProduct(2), catalogueId: newCatId } },
    });
    const dc = decodeData64(pub.resources[2].data64);
    expect(dc.catalogues.map((c: any) => [c.id, Object.keys(c.products).length])).toEqual([
      [CATALOGUE_ID, 10],
      [newCatId, 1],
    ]);
  });
});
