/**
 * Deleting products from the seller page, against the mocked Hub and node:
 * select mode in the Products tab, Delete in the product form, what goes to
 * Hub (compared with qdn/payloads.ts buildDeleteProductsPublish), and every
 * way it stops before anything is sent. Nothing reaches a real node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer, setProductsToSave } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock, type QortalHandler } from "../test/qortalMock";
import { installVisibleIntersectionObserver } from "../test/mockNode";
import {
  CATALOGUE_ID,
  DATA_CONTAINER_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_ID,
  catalogue,
  chair,
  dataContainer,
  decodeData64,
  mug,
  poster,
  viewedStore,
} from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { buildDeleteProductsPublish, type DataContainerDoc } from "../qdn/payloads";
import { resetQdnCaches } from "../qdn/search";
import { roomTiming } from "../qdn/publishBatches";
import { indexKey, notePublishedIndex, resetPublishedIndexes } from "./productIndex";
import { DELETE_INDEX_CHANGED_TEXT } from "./freshIndex";
import { DELETE_CATALOGUES_UNREADABLE_TEXT, DELETE_NODE_BEHIND_TEXT } from "./useDeleteProducts";
import { noteSentCatalogue, resetSentCatalogues } from "./sentCatalogues";
import { LIST_BUSY_TEXT } from "./listWrite";
import { resetPendingDeletes } from "./pendingDeletes";

/** The node: the product list (`index`, the fixture's unless given) and the catalogue (unless `catalogue: null`). */
function stubNode(opts: { index?: unknown; catalogue?: unknown | null } = {}) {
  const index = opts.index ?? dataContainer;
  const cat = opts.catalogue === undefined ? catalogue : opts.catalogue;
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      calls.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (url.startsWith("/transactions/unconfirmed")) return ok([]);
      if (url.startsWith("/transactions/unitfee")) return ok("1000000");
      const m = url.match(/^\/arbitrary\/DOCUMENT\/([^/]+)\/([^/?]+)$/);
      const id = m ? decodeURIComponent(m[2]) : "";
      if (id === DATA_CONTAINER_ID) return ok(index);
      if (id === CATALOGUE_ID && cat !== null) return ok(cat);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
  return calls;
}

function setup(handlers: Record<string, QortalHandler> = {}) {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(dataContainer));
  const q = installQortalMock({ FETCH_QDN_RESOURCE: async () => structuredClone(catalogue), ...handlers });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=products`] }
  );
  return { store, q };
}

async function selectAndDelete(titles: string[]) {
  const list = await screen.findByRole("list", { name: "Products" });
  for (const title of titles) await within(list).findByText(title);
  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  for (const title of titles) fireEvent.click(within(list).getByRole("checkbox", { name: new RegExp(`^Select ${title}\\b`) }));
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  const ask = await screen.findByRole("dialog", { name: titles.length === 1 ? "Delete this product?" : `Delete ${titles.length} products?` });
  fireEvent.click(within(ask).getByRole("button", { name: titles.length === 1 ? "Delete product" : `Delete ${titles.length} products` }));
  return ask;
}

beforeEach(() => {
  installVisibleIntersectionObserver();
  resetQdnCaches();
  resetPublishedIndexes();
  resetSentCatalogues();
  resetPendingDeletes();
  roomTiming.visibleMs = 5;
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomTiming.visibleMs = 10_000;
});

describe("deleting products", () => {
  it("selects several, then sends one publish: the product list first, then the catalogue without them", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    // A pending edit of one of them goes with it.
    store.dispatch(setProductsToSave({ ...poster, title: "Big poster", isUpdate: true }));
    const list = await screen.findByRole("list", { name: "Products" });
    await within(list).findByText("Poster");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("toolbar", { name: "Selected products" })).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("checkbox", { name: /^Select Poster\b/ }));
    fireEvent.click(within(list).getByRole("checkbox", { name: /^Select Mug\b/ }));
    expect(within(list).getByRole("checkbox", { name: /^Select Mug\b/ })).toHaveAttribute("aria-checked", "true");
    expect(within(list).getByRole("checkbox", { name: /^Select Chair\b/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const ask = await screen.findByRole("dialog", { name: "Delete 2 products?" });
    const named = within(within(ask).getByRole("list", { name: "Products to delete" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(named.sort()).toEqual(["Mug", "Poster"]);
    expect(within(ask).getByText(/set it to Retired instead/)).toBeInTheDocument();
    fireEvent.click(within(ask).getByRole("button", { name: "Delete 2 products" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    const expected = buildDeleteProductsPublish({
      name: SELLER,
      dataContainer: dataContainer as unknown as DataContainerDoc,
      productIds: [mug.id, poster.id],
      catalogues: { [CATALOGUE_ID]: catalogue },
      deletedAt: 0,
    }).resources;
    expect(sent.map((r: any) => r.identifier)).toEqual(expected.map((r) => r.identifier));
    // The catalogue first, the product list last.
    expect(sent.map((r: any) => r.identifier)).toEqual([CATALOGUE_ID, DATA_CONTAINER_ID]);
    expect(decodeData64(sent[1].data64)).toEqual({
      ...dataContainer,
      products: { [chair.id]: dataContainer.products[chair.id] },
      catalogues: [{ id: CATALOGUE_ID, products: { [chair.id]: true } }],
      deletedProducts: { [mug.id]: expect.any(Number), [poster.id]: expect.any(Number) },
    });
    expect(decodeData64(sent[0].data64)).toEqual({ id: CATALOGUE_ID, products: { [chair.id]: chair } });

    // The page follows: one product left, its draft gone, out of select mode.
    await waitFor(() => expect(Object.keys(store.getState().global.dataContainer!.products)).toEqual([chair.id]));
    expect(store.getState().global.productsToSave[poster.id]).toBeUndefined();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Products" })).getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByRole("toolbar", { name: "Selected products" })).toBeNull();
    expect(store.getState().notifications.alertTypes.alertSuccess).toBe("2 products deleted");
  });

  it("Select all picks what the filters show; Cancel leaves select mode with nothing deleted", async () => {
    stubNode();
    const { q } = setup();
    const list = await screen.findByRole("list", { name: "Products" });
    await within(list).findByText("Chair");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
    // The keyboard follows: into the bar.
    await waitFor(() => expect(screen.getByRole("button", { name: "Select all" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("3 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(screen.getByText("Select the products to delete")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Select" })).toHaveFocus());
    // Tapping a product opens it again.
    fireEvent.click(within(list).getByRole("button", { name: /^Edit Chair\b/ }));
    expect(await screen.findByRole("dialog", { name: "Edit product" })).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("says when the search hides chosen products, and Escape leaves select mode", async () => {
    stubNode();
    setup();
    const list = await screen.findByRole("list", { name: "Products" });
    await within(list).findByText("Chair");
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(within(list).getByRole("checkbox", { name: /^Select Mug\b/ }));
    fireEvent.click(within(list).getByRole("checkbox", { name: /^Select Chair\b/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your products" }), { target: { value: "chair" } });
    expect(await screen.findByText("2 selected, 1 hidden by the search or filters")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Select none" }), { key: "Escape" });
    expect(screen.queryByRole("toolbar", { name: "Selected products" })).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Select" })).toHaveFocus());
  });

  it("deletes from the product form, which stays open until it's deleted", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Mug\b/ }));
    const form = await screen.findByRole("dialog", { name: "Edit product" });
    fireEvent.click(within(form).getByRole("button", { name: "Delete" }));
    const ask = await screen.findByRole("dialog", { name: "Delete this product?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete this product?" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Edit product" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("dialog", { name: "Edit product" })).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Delete this product?" })).getByRole("button", { name: "Delete product" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit product" })).toBeNull());
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
    expect(Object.keys(store.getState().global.dataContainer!.products).sort()).toEqual([chair.id, poster.id].sort());
  });

  it("a new product (only a draft) has no Delete in its form", async () => {
    stubNode();
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    const form = await screen.findByRole("dialog", { name: "Add product" });
    expect(within(form).queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("shows a change on QDN from another device first, and deletes nothing", async () => {
    const lamp = `q-store-product-${SHORT_STORE_ID}-LAMPxxxxx4`;
    const newer = {
      ...dataContainer,
      products: { ...dataContainer.products, [lamp]: { created: 1, priceQort: 3, category: "Lighting", catalogueId: CATALOGUE_ID, status: "AVAILABLE" } },
      catalogues: [{ id: CATALOGUE_ID, products: { ...dataContainer.catalogues[0].products, [lamp]: true } }],
    };
    stubNode({ index: newer });
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const ask = await selectAndDelete(["Mug"]);
    expect(await within(ask).findByText(DELETE_INDEX_CHANGED_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(Object.keys(store.getState().global.dataContainer!.products)).toContain(lamp);
  });

  it("waits while the node still serves the list from before this tab's last change", async () => {
    const before = { ...dataContainer, products: { [mug.id]: dataContainer.products[mug.id] } };
    notePublishedIndex(STORE_ID, indexKey(before as any), indexKey(dataContainer as any));
    stubNode({ index: before });
    const { q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const ask = await selectAndDelete(["Mug"]);
    expect(await within(ask).findByText(DELETE_NODE_BEHIND_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("stops when a catalogue holding one can't be read", async () => {
    stubNode({ catalogue: null });
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const ask = await selectAndDelete(["Mug"]);
    expect(await within(ask).findByText(DELETE_CATALOGUES_UNREADABLE_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(Object.keys(store.getState().global.dataContainer!.products)).toHaveLength(3);
  });

  it("a decline in Hub closes quietly and changes nothing", async () => {
    stubNode();
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: "User declined request" };
      },
    });
    await selectAndDelete(["Mug"]);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(Object.keys(store.getState().global.dataContainer!.products)).toHaveLength(3);
    // Still selecting, so the seller can try again.
    expect(screen.getByRole("toolbar", { name: "Selected products" })).toBeInTheDocument();
  });

  it("when only the product list lands, the products leave the page, and Finish deleting clears their catalogue", async () => {
    stubNode();
    let fail = true;
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        if (fail) {
          fail = false;
          throw { error: { unsuccessfulPublishes: [{ identifier: CATALOGUE_ID }] } };
        }
        return true;
      },
    });
    await selectAndDelete(["Mug"]);
    const result = await screen.findByRole("dialog", { name: "Delete incomplete" });
    expect(within(result).getByRole("button", { name: "Retry failed" })).toBeInTheDocument();
    // The actions' Close (the title bar has one too).
    fireEvent.click(within(result).getAllByRole("button", { name: "Close" }).at(-1)!);
    await waitFor(() => expect(Object.keys(store.getState().global.dataContainer!.products)).not.toContain(mug.id));
    expect(store.getState().notifications.alertTypes.alertInfo).toBe(
      "The products left your shop, but some catalogues still hold them. Finish deleting them from your seller page."
    );
    // The seller page offers to finish: the catalogue, read fresh, without the mug.
    expect(await screen.findByText(/A product you deleted is still in your catalogues/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish deleting" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(2));
    const second = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[1] as any).resources;
    expect(second.map((r: any) => r.identifier)).toEqual([CATALOGUE_ID]);
    expect(Object.keys(decodeData64(second[0].data64).products)).not.toContain(mug.id);
    await waitFor(() => expect(screen.queryByText(/still in your catalogues/)).toBeNull());
  });

  it("waits while the node still serves a catalogue from before this tab's last change", async () => {
    stubNode();
    // This tab just sent the catalogue without the poster; the node still serves the old one.
    noteSentCatalogue(SELLER, { ...catalogue, products: { [mug.id]: mug, [chair.id]: chair } });
    const { q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const ask = await selectAndDelete(["Mug"]);
    expect(await within(ask).findByText(DELETE_NODE_BEHIND_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("one product-list write at a time: a delete started while a publish prepares is refused", async () => {
    // The node answers the product list slowly, so the publish is still preparing.
    let answer: (() => void) | null = null;
    const slow = new Promise<void>((resolve) => (answer = resolve));
    const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.startsWith("/transactions/")) return ok([]);
        if (url.includes(DATA_CONTAINER_ID)) {
          await slow;
          return ok(dataContainer);
        }
        if (url.includes(CATALOGUE_ID)) return ok(catalogue);
        return { ok: false, status: 404, text: async () => "{}", json: async () => ({}) };
      })
    );
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    store.dispatch(setProductsToSave({ ...mug, id: "q-store-product-my-shop-NEWxxxxxx1", title: "New", isUpdate: false, storeId: STORE_ID }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    const ask = await selectAndDelete(["Mug"]);
    expect(await within(ask).findByText(LIST_BUSY_TEXT)).toBeInTheDocument();
    answer!();
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    // Only the publish went out; the mug is still listed.
    expect(Object.keys(store.getState().global.dataContainer!.products)).toContain(mug.id);
  });
});
