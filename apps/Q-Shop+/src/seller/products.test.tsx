/**
 * The seller's product flows on the seller page: the list, Add product, Edit
 * (the price-edit fix), and publishing (one request up to 20 resources,
 * batches past that, retries, a decline, a timeout). The pinned publish
 * shapes are in ProductManager.pin.test.tsx; here the flow around them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer, setOwnShopStatus, setProductsToSave } from "../state/features/globalSlice";
import { setAllMyStores } from "../state/features/storeSlice";
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
  dataContainer,
  decodeData64,
  mug,
  poster,
  viewedStore,
} from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { roomTiming } from "../qdn/publishBatches";
import { isDraftOfShop } from "./shopDrafts";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";

vi.mock("../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TkVX")}>
      {label}
    </button>
  ),
}));

/** Core answers: room on the account (or the counts given), the unit fee, and published resources by content. */
function stubNode(opts: { unconfirmed?: number[]; served?: Map<string, unknown> } = {}) {
  const calls: string[] = [];
  const counts = [...(opts.unconfirmed ?? [])];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> => {
      const url = String(input);
      calls.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async (): Promise<string> => JSON.stringify(body) });
      if (url.startsWith("/transactions/unconfirmed")) return ok(Array.from({ length: counts.shift() ?? 0 }, () => ({ type: "ARBITRARY" })));
      if (url.startsWith("/transactions/unitfee")) return ok("1000000");
      const m = url.match(/^\/arbitrary\/DOCUMENT\/([^/]+)\/([^/?]+)$/);
      if (m && opts.served?.has(decodeURIComponent(m[2]))) return ok(opts.served.get(decodeURIComponent(m[2])));
      return { ok: false, status: 404, text: async () => '{"error":1401}' };
    })
  );
  return calls;
}

function draft(n: number) {
  return {
    title: `New ${n}`,
    description: "",
    created: 1762000000000 + n,
    version: 1,
    images: ["data:image/webp;base64,TkVX"],
    mainImageIndex: 0,
    type: "digital",
    price: [{ currency: "qort", value: 1 + n }],
    storeId: STORE_ID,
    shortStoreId: SHORT_STORE_ID,
    category: "New",
    id: `q-store-product-${SHORT_STORE_ID}-N${String(n).padStart(9, "0")}`,
    status: "AVAILABLE",
    user: SELLER,
  };
}

function setup(handlers: Record<string, QortalHandler> = {}, path = `/product-manager/${STORE_ID}`) {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(dataContainer));
  const q = installQortalMock({ FETCH_QDN_RESOURCE: async () => structuredClone(catalogue), ...handlers });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>,
    { store, initialEntries: [path] }
  );
  return { store, q };
}

beforeEach(() => {
  roomTiming.visibleMs = 5;
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomTiming.visibleMs = 10_000;
});

describe("the products tab", () => {
  it("lists every product from the index at once, and loads titles for those on screen", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { q } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    expect(screen.getByRole("heading", { level: 1, name: viewedStore.title })).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Products" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(await within(list).findByText("Poster")).toBeInTheDocument();
    // One catalogue holds all three: one read.
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toEqual([
      { action: "FETCH_QDN_RESOURCE", name: SELLER, service: "DOCUMENT", identifier: CATALOGUE_ID },
    ]);
    expect(screen.getByRole("button", { name: "Available 3" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Out of stock 0" }));
    expect(await screen.findByText("No products match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(within(await screen.findByRole("list", { name: "Products" })).getAllByRole("listitem")).toHaveLength(3);
  });

  it("an edit starts from the product's prices and keeps the ARRR price (bug 3)", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Poster" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    expect(within(dialog).getByRole("textbox", { name: /^Price in QORT/ })).toHaveValue("0.1");
    expect(within(dialog).getByRole("textbox", { name: /^Price in Pirate Chain/ })).toHaveValue("0.25");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Big poster" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(store.getState().global.productsToSave[poster.id]).toBeDefined());
    expect(store.getState().global.productsToSave[poster.id]).toEqual({
      ...poster,
      title: "Big poster",
      price: [
        { currency: "qort", value: 0.1 },
        { currency: "ARRR", value: 0.25 },
      ],
      isUpdate: true,
      status: "AVAILABLE",
      user: SELLER,
    });
  });

  it("Add product puts a new product in Ready to publish, in the original's shape", async () => {
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    expect(await within(dialog).findByText("Add at least one image")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Tea cup" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /^Category/ }), { target: { value: "Kitchen" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Price in QORT/ }), { target: { value: "2,5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1));
    const [added] = Object.values(store.getState().global.productsToSave) as any[];
    expect(Object.keys(added)).toEqual([
      "title",
      "description",
      "created",
      "version",
      "images",
      "mainImageIndex",
      "type",
      "price",
      "storeId",
      "shortStoreId",
      "category",
      "id",
      "status",
      "user",
    ]);
    expect(added).toMatchObject({
      title: "Tea cup",
      images: ["data:image/webp;base64,TkVX"],
      type: "digital",
      price: [{ currency: "qort", value: 2.5 }],
      storeId: STORE_ID,
      shortStoreId: SHORT_STORE_ID,
      category: "Kitchen",
      status: "AVAILABLE",
      user: SELLER,
    });
    expect(added.id).toMatch(new RegExp(`^q-store-product-${SHORT_STORE_ID}-.{10}$`));
    expect(screen.getByRole("heading", { name: "Ready to publish: 1 product" })).toBeInTheDocument();
  });
});

describe("the page's states", () => {
  it("another of the seller's shops loads as the current one; if the node can't read it, says so with Retry", async () => {
    stubNode();
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
    store.dispatch(setDataContainer(dataContainer));
    store.dispatch(
      setAllMyStores([
        { id: STORE_ID, owner: SELLER, title: viewedStore.title, description: "", created: 1 },
        { id: "q-store-general-other", owner: SELLER, title: "Other shop", description: "", created: 2 },
      ])
    );
    installQortalMock();
    renderWithProviders(
      <Routes>
        <Route path="/product-manager/:store" element={<ProductManager />} />
      </Routes>,
      { store, initialEntries: ["/product-manager/q-store-general-other"] }
    );
    expect(await screen.findByText("Couldn't load this shop from your node")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Other shop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("a shop without a product list on QDN offers to create one, and shows no endless skeleton", async () => {
    stubNode();
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
    store.dispatch(setOwnShopStatus("container-missing"));
    installQortalMock();
    renderWithProviders(
      <Routes>
        <Route path="/product-manager/:store" element={<ProductManager />} />
      </Routes>,
      { store, initialEntries: [`/product-manager/${STORE_ID}?tab=products`] }
    );
    expect(screen.getByText("Your shop has no product list on QDN yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product list" })).toBeInTheDocument();
    expect(screen.getByText("Your products show here once your product list loads")).toBeInTheDocument();
    expect(screen.queryByLabelText("Loading products")).toBeNull();
  });
});

describe("publishing", () => {
  it("updates the shop's state as the original did once everything is on QDN", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const dc = decodeData64(call.resources[1].data64);
    const state = store.getState().global;
    expect(state.dataContainer).toEqual({ ...dc, id: DATA_CONTAINER_ID });
    expect(state.listProducts.products).toHaveLength(4);
    expect(state.catalogueHashMap[CATALOGUE_ID].products[draft(1).id]).toEqual({ ...draft(1), catalogueId: CATALOGUE_ID });
    expect(screen.queryByRole("heading", { name: /Ready to publish/ })).toBeNull();
  });

  it("publishes only this shop's drafts; another shop's stay in the list, untouched", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const other = { ...draft(2), storeId: "q-store-general-my-shop-2", shortStoreId: "my-shop-2", id: "q-store-product-my-shop-2-OTHERxxxx1" };
    store.dispatch(setProductsToSave(draft(1)));
    store.dispatch(setProductsToSave(other));
    expect(await screen.findByRole("heading", { name: "Ready to publish: 1 product" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toEqual([other.id]));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const cat = decodeData64(call.resources[0].data64);
    expect(Object.keys(cat.products)).toContain(draft(1).id);
    expect(Object.keys(cat.products)).not.toContain(other.id);
  });

  it("matches drafts without a shop id by their product id, exactly", () => {
    expect(isDraftOfShop({ id: `q-store-product-${SHORT_STORE_ID}-ABCDEFGHIJ` }, STORE_ID)).toBe(true);
    expect(isDraftOfShop({ id: `q-store-product-${SHORT_STORE_ID}-2-ABCDEFGHIJ` }, STORE_ID)).toBe(false);
    expect(isDraftOfShop({ id: "x", storeId: STORE_ID }, STORE_ID)).toBe(true);
    expect(isDraftOfShop({ id: `q-store-product-${SHORT_STORE_ID}-ABCDEFGHIJ`, storeId: "q-store-general-other" }, STORE_ID)).toBe(false);
  });

  it("sends more than 20 resources in batches of 20, waiting for room, with the product list last, on its own", async () => {
    // The second batch (1 resource) fits once at most 24 wait: 25 makes it wait one round.
    const calls = stubNode({ unconfirmed: [0, 25, 3, 3] });
    const timeouts: number[] = [];
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    (globalThis as any).qortalRequestWithTimeout = (params: any, ms: number) => {
      timeouts.push(ms);
      return (globalThis as any).qortalRequest(params);
    };
    for (let n = 1; n <= 201; n++) store.dispatch(setProductsToSave(draft(n)));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog", { name: "Publish in 3 batches" });
    expect(await within(dialog).findByText(/22 publishes in 3 batches of up to 20, 0.22 QORT in fees/)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Start publishing" }));
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}), { timeout: 4000 });

    const pubs = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(pubs.map((p) => Object.keys(p).sort())).toEqual([
      ["action", "resources"],
      ["action", "resources"],
      ["action", "resources"],
    ]);
    expect(pubs.map((p) => p.resources.length)).toEqual([20, 1, 1]);
    expect(pubs[0].resources.some((r: any) => r.identifier === DATA_CONTAINER_ID)).toBe(false);
    expect(pubs[1].resources.some((r: any) => r.identifier === DATA_CONTAINER_ID)).toBe(false);
    expect(pubs[2].resources[0].identifier).toBe(DATA_CONTAINER_ID);
    expect(pubs[0].resources[0].identifier).toBe(CATALOGUE_ID);
    // Room checked before each batch; the second waited until the first was confirmed.
    const roomCheck = `/transactions/unconfirmed?creator=${encodeURIComponent(SELLER_PK)}&limit=100`;
    expect(calls.filter((u) => u.startsWith("/transactions/unconfirmed"))).toEqual([roomCheck, roomCheck, roomCheck, roomCheck]);
    expect(timeouts).toEqual([PUBLISH_TIMEOUT_MS, PUBLISH_TIMEOUT_MS, PUBLISH_TIMEOUT_MS]);
    const dc = decodeData64(pubs[2].resources[0].data64);
    expect(Object.keys(dc.products)).toHaveLength(3 + 201);
    expect(dc.catalogues).toHaveLength(21);
    expect(dc.catalogues.every((c: any) => Object.keys(c.products).length <= 10)).toBe(true);
  });

  it("holds the product list back while a catalogue failed, and retries only what failed", async () => {
    stubNode();
    let first = true;
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async (p: any) => {
        if (first) {
          first = false;
          throw { error: { unsuccessfulPublishes: [{ identifier: p.resources[0].identifier }] } };
        }
        return true;
      },
    });
    for (let n = 1; n <= 201; n++) store.dispatch(setProductsToSave(draft(n)));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    const retry = await screen.findByRole("button", { name: "Retry failed" }, { timeout: 4000 });
    let pubs = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    // Batch 2 went without the product list, since a catalogue it names is missing.
    expect(pubs.map((p) => p.resources.length)).toEqual([20, 1]);
    expect(pubs[1].resources[0].identifier).not.toBe(DATA_CONTAINER_ID);
    expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(201);
    fireEvent.click(retry);
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}), { timeout: 4000 });
    pubs = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    // The failed catalogue first, then the product list on its own.
    expect(pubs.slice(2).map((p) => p.resources.map((r: any) => r.identifier))).toEqual([[CATALOGUE_ID], [DATA_CONTAINER_ID]]);
  });

  it("a decline in Hub closes quietly and keeps the drafts", async () => {
    stubNode();
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: "User declined request" };
      },
    });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(Object.keys(store.getState().global.productsToSave)).toEqual([draft(1).id]);
  });

  it("after a timeout, checks QDN for the content before offering anything again", async () => {
    const served = new Map<string, unknown>();
    stubNode({ served });
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async (p: any) => {
        // Hub carries on and publishes; the app only hears the timeout.
        for (const r of p.resources) served.set(r.identifier, decodeData64(r.data64));
        throw "The request timed out";
      },
    });
    store.dispatch(setProductsToSave({ ...mug, title: "Big mug", isUpdate: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}));
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
  });

  it("after a timeout with nothing on QDN, says so and offers Check again before Retry", async () => {
    stubNode();
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw "The request timed out";
      },
    });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("dialog", { name: "Publish incomplete" });
    expect(within(dialog).getByText(/Hub may still be publishing them/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Check again" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry missing" })).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
    expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1);
  });
});
