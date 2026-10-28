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
  chair,
  dataContainer,
  decodeData64,
  mug,
  poster,
  viewedStore,
} from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { useOwnShops } from "../hooks/useOwnShops";
import { useShopPublish } from "../hooks/useShopPublish";
import { roomTiming } from "../qdn/publishBatches";
import { picturesIdentifier } from "../qdn/identifiers";
import { picturesSig } from "../qdn/productPictures";
import { isDraftOfShop } from "./shopDrafts";
import { collectionDrafts, collectionsDraftKey } from "./useCollections";
import { resetPublishedIndexes } from "./productIndex";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";
import { SHOP_CATEGORIES } from "../constants/categories";
import { categoryInput, categoryOptions, pickCategory } from "../test/categories";
import { selectField, selectValue } from "../test/select";

vi.mock("../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TkVX")}>
      {label}
    </button>
  ),
}));

type ShopRow = { identifier: string; title: string };

/**
 * Core answers: room on the account (or the counts given), the unit fee,
 * published resources by content, and the seller's shops for a search. The
 * shop's product list is served as the fixture's unless `served` has one or
 * `index` says otherwise (null: not on the node).
 */
function stubNode(
  opts: { unconfirmed?: number[]; served?: Map<string, unknown>; shops?: ShopRow[]; index?: unknown } = {}
) {
  const served = opts.served ?? new Map<string, unknown>();
  const index = opts.index === undefined ? dataContainer : opts.index;
  const calls: string[] = [];
  const counts = [...(opts.unconfirmed ?? [])];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      calls.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (url.startsWith("/arbitrary/resources/search") && opts.shops) {
        const rows = opts.shops.map((s, i) => ({ name: SELLER, service: "STORE", identifier: s.identifier, created: i + 1, metadata: { title: s.title } }));
        return ok(rows);
      }
      if (url.startsWith("/transactions/unconfirmed")) return ok(Array.from({ length: counts.shift() ?? 0 }, () => ({ type: "ARBITRARY" })));
      if (url.startsWith("/transactions/unitfee")) return ok("1000000");
      const m = url.match(/^\/arbitrary\/DOCUMENT\/([^/]+)\/([^/?]+)$/);
      const id = m ? decodeURIComponent(m[2]) : "";
      if (m && served.has(id)) return ok(served.get(id));
      if (m && id === DATA_CONTAINER_ID && index !== null) return ok(index);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
  return calls;
}

/** The seller page as GlobalWrapper mounts it: with the hook that loads the seller's shops. */
function SellerPage() {
  useOwnShops();
  return (
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>
  );
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
  resetPublishedIndexes();
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

  it("opens a product's form from its page's Edit product (?edit=), once", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    setup({}, `/product-manager/${STORE_ID}?tab=products&edit=${encodeURIComponent(poster.id)}`);
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    expect(within(dialog).getByRole("textbox", { name: /^Title/ })).toHaveValue("Poster");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit product" })).toBeNull());
  });

  it("an edit starts from the product's prices and keeps the ARRR price (bug 3)", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
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

  it("Duplicate starts a new product from the one being edited, its title marked (copy)", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const edit = await screen.findByRole("dialog", { name: "Edit product" });
    fireEvent.click(within(edit).getByRole("button", { name: "Duplicate" }));
    const add = await screen.findByRole("dialog", { name: "Add product" });
    expect(within(add).getByRole("textbox", { name: /^Title/ })).toHaveValue(`${poster.title} (copy)`);
    expect(within(add).getByRole("textbox", { name: /^Price in QORT/ })).toHaveValue("0.1");
    fireEvent.click(within(add).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1));
    const [copy] = Object.values(store.getState().global.productsToSave) as unknown as Record<string, unknown>[];
    expect(copy.id).not.toBe(poster.id);
    // Its old category ("Art") gives way to the list's, as a new product's must.
    expect(copy).toMatchObject({ title: `${poster.title} (copy)`, status: "AVAILABLE", category: "Collectibles & Art" });
    expect(copy.isUpdate).toBeUndefined();
  });

  it("a counted product's copy asks for its own stock instead of taking the original's count", async () => {
    const { copyValues } = await import("../pages/ProductManager/NewProduct/NewProduct");
    const { formValuesFor } = await import("./productDraft");
    const counted = { ...poster, stock: { v: 1, quantity: 10, since: 1000, voided: ["ORDER1"] } };
    const copy = copyValues(formValuesFor(counted, ["QORT"]));
    expect(copy.stock).toEqual({ tracked: true, quantity: "" });
    const { stockFormProblem } = await import("../stock/catalog");
    expect(stockFormProblem(copy.stock)).not.toBeNull();
  });

  it("publishes a product's pictures past the third in a document of their own, first; the catalogue keeps 3", async () => {
    stubNode();
    const { q, store } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const images = ["QQ==", "Qg==", "Qw==", "RA==", "RQ=="].map((b) => `data:image/webp;base64,${b}`);
    store.dispatch(setProductsToSave({ ...draft(1), images }));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const picturesId = picturesIdentifier(draft(1).id);
    expect(call.resources.map((r: any) => r.identifier)).toEqual([picturesId, CATALOGUE_ID, DATA_CONTAINER_ID]);
    expect(call.resources[0]).toMatchObject({ service: "DOCUMENT", filename: "pictures.json", name: SELLER });
    expect(decodeData64(call.resources[0].data64)).toEqual({ productId: draft(1).id, images: images.slice(3) });
    const product = decodeData64(call.resources[1].data64).products[draft(1).id];
    expect(product.images).toEqual(images.slice(0, 3));
    expect(product.morePictures).toMatchObject({ id: picturesId, count: 2 });
  });

  it("an edit reads the product's other pictures first, only as published, then saves with all of them", async () => {
    installVisibleIntersectionObserver();
    const served = new Map<string, unknown>();
    stubNode({ served });
    const picturesId = picturesIdentifier(poster.id);
    const more = ["data:image/webp;base64,TU9SRTE=", "data:image/webp;base64,TU9SRTI="];
    const ref = { id: picturesId, count: 2, sig: picturesSig(more) };
    const withMore = structuredClone(catalogue) as any;
    withMore.products[poster.id] = { ...poster, morePictures: ref };
    // The node still serves the pictures from before the last publish: not taken.
    served.set(picturesId, { productId: poster.id, images: ["data:image/webp;base64,T0xE"] });
    const { store } = setup({ FETCH_QDN_RESOURCE: async () => structuredClone(withMore) }, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    expect(await within(dialog).findByText(/2 more pictures of this product couldn't be read/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^Add (images|another image)$/ })).toBeNull();
    // As published now: they join the pictures, and the product saves with all of them.
    served.set(picturesId, { productId: poster.id, images: more });
    fireEvent.click(within(dialog).getByRole("button", { name: "Try again" }));
    expect(await within(dialog).findByRole("list", { name: `Pictures (${poster.images.length + 2} of 10)` })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(store.getState().global.productsToSave[poster.id]).toBeDefined());
    const saved = store.getState().global.productsToSave[poster.id] as any;
    expect(saved.images).toEqual([...poster.images, ...more]);
  });

  it("an edit whose other pictures can't be read still saves, keeping its pictures as they are", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const ref = { id: picturesIdentifier(poster.id), count: 4, sig: "4-a-b" };
    const withMore = structuredClone(catalogue) as any;
    withMore.products[poster.id] = { ...poster, morePictures: ref };
    const { store } = setup({ FETCH_QDN_RESOURCE: async () => structuredClone(withMore) }, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    expect(await within(dialog).findByText(/4 more pictures of this product couldn't be read/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Big poster" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(store.getState().global.productsToSave[poster.id]).toBeDefined());
    const saved = store.getState().global.productsToSave[poster.id] as any;
    expect(saved).toMatchObject({ title: "Big poster", images: poster.images, morePictures: ref });
  });

  it("a product its catalogue lacks says so and opens from its index row; saving puts it back in the catalogue", async () => {
    // A publish where the catalogue failed and the index landed: the index names
    // the lamp in CATALOGUE_ID, which doesn't hold it.
    installVisibleIntersectionObserver();
    stubNode();
    const lamp = { id: `q-store-product-${SHORT_STORE_ID}-LAMPxxxxx4`, created: 1690000200000 };
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true }, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(
      setDataContainer({
        ...dataContainer,
        products: {
          ...dataContainer.products,
          [lamp.id]: { created: lamp.created, priceQort: 3, category: "Lighting", catalogueId: CATALOGUE_ID, status: "OUT_OF_STOCK" },
        },
        catalogues: [{ id: CATALOGUE_ID, products: { ...dataContainer.catalogues[0].products, [lamp.id]: true } }],
      })
    );
    const list = await screen.findByRole("list", { name: "Products" });
    expect(await within(list).findByText("Missing from its catalogue: open it to add its details again")).toBeInTheDocument();
    // Read once more, fresh, before it counts as missing; then never again.
    expect(q.callsFor("FETCH_QDN_RESOURCE").filter((c) => c.identifier === CATALOGUE_ID)).toHaveLength(2);

    fireEvent.click(within(list).getByRole("button", { name: /^Edit Missing from its catalogue/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    expect(screen.queryByText("Opening…")).toBeNull();
    expect(within(dialog).getByRole("textbox", { name: /^Price in QORT/ })).toHaveValue("3");
    expect(within(dialog).getByRole("combobox", { name: /^Category/ })).toHaveValue("Lighting");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Lamp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(store.getState().global.productsToSave[lamp.id]).toBeDefined());
    expect(store.getState().global.productsToSave[lamp.id]).toMatchObject({
      id: lamp.id,
      created: lamp.created,
      catalogueId: CATALOGUE_ID,
      storeId: STORE_ID,
      shortStoreId: SHORT_STORE_ID,
      version: 1,
      title: "Lamp",
      images: ["data:image/webp;base64,TkVX"],
      price: [{ currency: "qort", value: 3 }],
      category: "Lighting",
      status: "OUT_OF_STOCK",
      isUpdate: true,
      user: SELLER,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const cat = decodeData64(call.resources[0].data64);
    expect(call.resources[0].identifier).toBe(CATALOGUE_ID);
    expect(Object.keys(cat.products)).toEqual([mug.id, poster.id, chair.id, lamp.id]);
    expect(cat.products[lamp.id]).toMatchObject({ title: "Lamp", catalogueId: CATALOGUE_ID, price: [{ currency: "qort", value: 3 }] });
  });

  it("Add product puts a new product in Ready to publish, in the original's shape (physical by default)", async () => {
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    const types = within(within(dialog).getByRole("group", { name: "Type" })).getAllByRole("button");
    expect(types.map((b) => [b.textContent, b.getAttribute("aria-pressed")])).toEqual([
      ["Physical", "true"],
      ["Digital", "false"],
    ]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    expect(await within(dialog).findByText("Add at least one image")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Tea cup" } });
    await pickCategory(dialog, "home", "Home & Garden");
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
      type: "physical",
      price: [{ currency: "qort", value: 2.5 }],
      storeId: STORE_ID,
      shortStoreId: SHORT_STORE_ID,
      category: "Home & Garden",
      status: "AVAILABLE",
      user: SELLER,
    });
    expect(added.id).toMatch(new RegExp(`^q-store-product-${SHORT_STORE_ID}-.{10}$`));
    expect(within(screen.getByRole("region", { name: "Unpublished changes" })).getByText("1 product")).toBeInTheDocument();
  });

  it("counts stock when asked: off by default, its units required, and the count saved with the product", async () => {
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    const counting = within(dialog).getByRole("switch", { name: "Count stock" });
    expect(counting).not.toBeChecked();
    expect(within(dialog).getByText("Off: it stays in stock until you mark it out of stock.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Tea cup" } });
    await pickCategory(dialog, "home", "Home & Garden");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Price in QORT/ }), { target: { value: "2" } });
    fireEvent.click(counting);
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    expect(await within(dialog).findByText("Type the units in stock.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Units in stock" }), { target: { value: "12x" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1));
    const [added] = Object.values(store.getState().global.productsToSave) as any[];
    expect(added.stock).toEqual({ v: 1, quantity: 12, since: expect.any(Number) });
    // The original's keys first, the count after them.
    expect(Object.keys(added).slice(-1)).toEqual(["stock"]);
  });

  it("offers the categories every shop picks from, and nothing else for a new product", async () => {
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    expect(await categoryOptions(dialog, "")).toEqual([...SHOP_CATEGORIES]);
    fireEvent.keyDown(categoryInput(dialog), { key: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    // A title with no known word suggests nothing.
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Thingamajig" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Price in QORT/ }), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    expect(await within(dialog).findByText("Pick a category")).toBeInTheDocument();
    // Typed text that isn't a category is never saved: only a picked one.
    await pickCategory(dialog, "food", "Food & Drink");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1));
    const [added] = Object.values(store.getState().global.productsToSave) as any[];
    expect(added.category).toBe("Food & Drink");
  });

  it("suggests the category from the title, and finds one by what the product is", async () => {
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    const title = within(dialog).getByRole("textbox", { name: /^Title/ });
    fireEvent.change(title, { target: { value: "Blue Light Blocking Glasses | Night" } });
    expect(categoryInput(dialog)).toHaveValue("Health & Beauty");
    expect(within(dialog).getByText("Suggested from the title. Pick another if it doesn't fit.")).toBeInTheDocument();
    // It follows the title while the seller hasn't picked one…
    fireEvent.change(title, { target: { value: "Icelandic Grass-Fed Ghee | 800g" } });
    expect(categoryInput(dialog)).toHaveValue("Food & Drink");
    // …and typing finds categories by the things in them, with the word that matched.
    const found = await categoryOptions(dialog, "glasses");
    expect(found[0]).toBe("Health & Beauty“glasses”");
    expect(found.some((o) => o.startsWith("Clothing, Shoes & Accessories"))).toBe(true);
    fireEvent.click(screen.getByRole("option", { name: /^Clothing, Shoes & Accessories/ }));
    expect(categoryInput(dialog)).toHaveValue("Clothing, Shoes & Accessories");
    // Picked: the title no longer changes it.
    fireEvent.change(title, { target: { value: "Raw honey" } });
    expect(categoryInput(dialog)).toHaveValue("Clothing, Shoes & Accessories");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Price in QORT/ }), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1));
    expect((Object.values(store.getState().global.productsToSave)[0] as any).category).toBe("Clothing, Shoes & Accessories");
  });

  it("an old category saved with spaces around it shows, and saves, trimmed", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup(
      { FETCH_QDN_RESOURCE: async () => ({ ...structuredClone(catalogue), products: { ...catalogue.products, [poster.id]: { ...poster, category: "Art " } } }) },
      `/product-manager/${STORE_ID}?tab=products`
    );
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    expect(categoryInput(dialog)).toHaveValue("Art");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(store.getState().global.productsToSave[poster.id]?.category).toBe("Art"));
  });

  it("an edited product keeps its category from before the list until the seller picks one", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    // The fixture's "Art" isn't one of the list: it is offered as the product's own, and selected.
    expect(categoryInput(dialog)).toHaveValue("Art");
    expect(within(dialog).getByText(/“Art” isn't one of the categories every shop uses/)).toBeInTheDocument();
    // Saved as it is: it keeps "Art", and with nothing changed no draft waits to be published.
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit product" })).toBeNull());
    expect(store.getState().global.productsToSave[poster.id]).toBeUndefined();
    // Picking one of the list replaces it.
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const again = await screen.findByRole("dialog", { name: "Edit product" });
    // The title ("Poster") suggests one of the list: one tap.
    fireEvent.click(within(again).getByRole("button", { name: "Use Collectibles & Art (suggested from the title)" }));
    fireEvent.click(within(again).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(store.getState().global.productsToSave[poster.id].category).toBe("Collectibles & Art"));
  });
});

describe("the page's states", () => {
  it("another of the seller's shops loads as the current one; if the node can't read it, says so with Retry", async () => {
    stubNode({
      shops: [
        { identifier: STORE_ID, title: viewedStore.title },
        { identifier: "q-store-general-other", title: "Other shop" },
      ],
    });
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
    renderWithProviders(<SellerPage />, { store, initialEntries: ["/product-manager/q-store-general-other"] });
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

describe("publishing on the product list as QDN has it now", () => {
  const C2 = `q-store-catalogue-${SHORT_STORE_ID}-CAT2xxxxx2`;
  const vase = { ...mug, id: `q-store-product-${SHORT_STORE_ID}-VASExxxxx5`, title: "Vase", catalogueId: C2, created: 1700000000000 };
  /** The index after another device added a vase (in a new catalogue) and marked the mug out of stock. */
  const newer = {
    ...dataContainer,
    products: {
      ...dataContainer.products,
      [mug.id]: { ...dataContainer.products[mug.id], status: "OUT_OF_STOCK" },
      [vase.id]: { created: vase.created, priceQort: 4, category: "Kitchen", catalogueId: C2, status: "AVAILABLE" },
    },
    catalogues: [...dataContainer.catalogues, { id: C2, products: { [vase.id]: true } }],
  };
  const catalogues = {
    FETCH_QDN_RESOURCE: async (p: any) =>
      p.identifier === C2 ? { id: C2, products: { [vase.id]: vase } } : structuredClone(catalogue),
  };

  it("shows products published elsewhere since the page loaded, instead of dropping them, and publishes on them", async () => {
    // The page loaded the older index; the node now serves the newer one.
    stubNode({ index: newer });
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true, ...catalogues });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));

    // Nothing is published yet: the page shows the newer list and says so.
    expect(await screen.findByText(/Your product list on QDN changed since this page loaded/)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    const state = store.getState().global;
    expect(state.dataContainer?.products[vase.id]).toBeDefined();
    expect(state.dataContainer?.products[mug.id].status).toBe("OUT_OF_STOCK");
    expect(state.listProducts.products).toHaveLength(4);
    expect(Object.keys(state.productsToSave)).toEqual([draft(1).id]);

    // Publish again: built on the newer list, which keeps the vase and the mug's status.
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const dc = decodeData64(call.resources.at(-1).data64);
    expect(call.resources.at(-1).identifier).toBe(DATA_CONTAINER_ID);
    expect(Object.keys(dc.products).sort()).toEqual([mug.id, poster.id, chair.id, vase.id, draft(1).id].sort());
    expect(dc.products[mug.id].status).toBe("OUT_OF_STOCK");
    expect(dc.catalogues.map((c: any) => c.id)).toEqual([CATALOGUE_ID, C2]);
    // The new product topped up the last catalogue, the vase's.
    expect(dc.catalogues[1].products).toEqual({ [vase.id]: true, [draft(1).id]: true });
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}));
    expect(screen.queryByText(/Your product list on QDN changed/)).toBeNull();
  });

  it("publishes nothing when the node can't serve the product list, and says why", async () => {
    stubNode({ index: null });
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    expect(await screen.findByText(/Couldn't read your product list from your node, so nothing was published/)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(Object.keys(store.getState().global.productsToSave)).toEqual([draft(1).id]);
  });

  it("right after its own publish, a node still serving the list from before doesn't undo it", async () => {
    // The node keeps serving the original list: it hasn't caught up with this tab's publish.
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}));
    store.dispatch(setProductsToSave(draft(2)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(2));
    const second = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[])[1];
    const dc = decodeData64(second.resources.at(-1).data64);
    expect(Object.keys(dc.products)).toEqual(expect.arrayContaining([draft(1).id, draft(2).id]));
    // The catalogue builds on what this tab sent, not the node's older copy: the first product stays in it.
    const cat = decodeData64(second.resources[0].data64);
    expect(Object.keys(cat.products)).toEqual(expect.arrayContaining([draft(1).id, draft(2).id]));
    expect(screen.queryByText(/Your product list on QDN changed/)).toBeNull();
  });

  it("after Recreate shop data, a node still serving the old list doesn't bring the old products back", async () => {
    stubNode();
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
    store.dispatch(setDataContainer(dataContainer));
    const q = installQortalMock({
      PUBLISH_QDN_RESOURCE: async () => true,
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
    });
    function Recreate() {
      const { recreateProductList } = useShopPublish();
      return (
        <button type="button" onClick={() => void recreateProductList()}>
          Recreate now
        </button>
      );
    }
    renderWithProviders(
      <>
        <Recreate />
        <Routes>
          <Route path="/product-manager/:store" element={<ProductManager />} />
        </Routes>
      </>,
      { store, initialEntries: [`/product-manager/${STORE_ID}`] }
    );
    fireEvent.click(screen.getByRole("button", { name: "Recreate now" }));
    await waitFor(() => expect(store.getState().global.dataContainer?.products).toEqual({}));
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(Object.keys(decodeData64(call.resources.at(-1).data64).products)).toEqual([draft(1).id]);
    expect(screen.queryByText(/Your product list on QDN changed/)).toBeNull();
  });

  it("when the node can't be asked at all, builds on the page's copy, as the original did", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (String(input).includes("-datacontainer")) throw new TypeError("Failed to fetch");
        return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
      })
    );
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
  });
});

describe("publishing", () => {
  it("updates the shop's state as the original did once everything is on QDN", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    store.dispatch(setProductsToSave(draft(1)));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(store.getState().global.productsToSave).toEqual({}));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const dc = decodeData64(call.resources[1].data64);
    const state = store.getState().global;
    expect(state.dataContainer).toEqual({ ...dc, id: DATA_CONTAINER_ID });
    expect(state.listProducts.products).toHaveLength(4);
    expect(state.catalogueHashMap[CATALOGUE_ID].products[draft(1).id]).toEqual({ ...draft(1), catalogueId: CATALOGUE_ID });
    expect(screen.queryByRole("region", { name: "Unpublished changes" })).toBeNull();
  });

  it("publishes only this shop's drafts; another shop's stay in the list, untouched", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const other = { ...draft(2), storeId: "q-store-general-my-shop-2", shortStoreId: "my-shop-2", id: "q-store-product-my-shop-2-OTHERxxxx1" };
    store.dispatch(setProductsToSave(draft(1)));
    store.dispatch(setProductsToSave(other));
    expect(within(await screen.findByRole("region", { name: "Unpublished changes" })).getByText("1 product")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    const dialog = await screen.findByRole("dialog", { name: "Publish incomplete" });
    expect(within(dialog).getByText(/Hub may still be publishing them/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Check again" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry missing" })).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
    expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1);
  });
});

describe("sorting the products by their columns", () => {
  beforeEach(() => installVisibleIntersectionObserver());

  const names = (list: HTMLElement) =>
    within(list)
      .getAllByRole("listitem")
      .map((li) => within(li).queryByText(/^(Mug|Poster|Chair)$/)?.textContent);

  it("sorts by a column's name, and the other way with a second click; the Sort menu follows", async () => {
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    // Added in this order: the chair, the poster, the mug.
    const dated = (id: string, created: number) => ({ ...(dataContainer.products as Record<string, object>)[id], created });
    store.dispatch(setDataContainer({ ...dataContainer, products: { [mug.id]: dated(mug.id, 3000), [poster.id]: dated(poster.id, 2000), [chair.id]: dated(chair.id, 1000) } }));
    const list = await screen.findByRole("list", { name: "Products" });
    await waitFor(() => expect(names(list)).toEqual(["Mug", "Poster", "Chair"]));
    const columns = screen.getByRole("group", { name: "Sort by column" });
    // No shop order yet: no column for it.
    expect(within(columns).queryByRole("button", { name: /shop order/i })).toBeNull();
    fireEvent.click(within(columns).getByRole("button", { name: "Sort by price, low to high" }));
    expect(names(list)).toEqual(["Poster", "Mug", "Chair"]);
    expect(selectValue(selectField("Sort"))).toBe("price-asc");
    fireEvent.click(within(columns).getByRole("button", { name: "Price, low to high: sort high to low" }));
    expect(names(list)).toEqual(["Chair", "Mug", "Poster"]);
    fireEvent.click(within(columns).getByRole("button", { name: "Sort by product, A to Z" }));
    await waitFor(() => expect(names(list)).toEqual(["Chair", "Mug", "Poster"]));
    fireEvent.click(within(columns).getByRole("button", { name: "Product, A to Z: sort Z to A" }));
    expect(names(list)).toEqual(["Poster", "Mug", "Chair"]);
    fireEvent.click(within(columns).getByRole("button", { name: "Sort by added, newest first" }));
    expect(names(list)).toEqual(["Mug", "Poster", "Chair"]);
    fireEvent.click(within(columns).getByRole("button", { name: "Added, newest first: sort oldest first" }));
    expect(names(list)).toEqual(["Chair", "Poster", "Mug"]);
    expect(selectValue(selectField("Sort"))).toBe("oldest");
  });

  it("shows each product's place in the shop order, and sorts by it either way", async () => {
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer({ ...dataContainer, productOrder: [chair.id, mug.id] }));
    const list = await screen.findByRole("list", { name: "Products" });
    // The shop order is the list's sort now: the chair, the mug, then the rest newest first.
    await waitFor(() => expect(names(list)).toEqual(["Chair", "Mug", "Poster"]));
    expect(within(list).getAllByText(/in shop order/).map((el) => el.parentElement?.textContent)).toEqual(["1 in shop order", "2 in shop order", "3 in shop order"]);
    const columns = screen.getByRole("group", { name: "Sort by column" });
    fireEvent.click(within(columns).getByRole("button", { name: "Shop order, first to last: sort last to first" }));
    expect(names(list)).toEqual(["Poster", "Mug", "Chair"]);
    expect(selectValue(selectField("Sort"))).toBe("featured-desc");
  });

  it("puts the published collections' products first in the shop order, each under a line with its collection", async () => {
    const collectionsId = `q-store-collections-${SHORT_STORE_ID}`;
    stubNode({ served: new Map([[collectionsId, { storeId: STORE_ID, collections: [{ id: "MUGSxxxxx1", title: "Mugs", products: [mug.id] }] }]]) });
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer({ ...dataContainer, collectionsId, productOrder: [chair.id, mug.id] }));
    const list = await screen.findByRole("list", { name: "Products" });
    await waitFor(() => expect(within(list).getAllByRole("listitem").map((li) => li.querySelector("h2")?.textContent ?? within(li).queryByText(/^(Mug|Poster|Chair)$/)?.textContent)).toEqual(["Mugs", "Mug", "Not in a collection", "Chair", "Poster"]));
    expect(selectValue(selectField("Sort"))).toBe("featured");
    expect(within(list).getAllByText(/in shop order/).map((el) => el.parentElement?.textContent)).toEqual(["1 in shop order", "2 in shop order", "3 in shop order"]);
  });

  it("puts a product in collections from its form, and takes it out: the change waits with the unpublished collections", async () => {
    installVisibleIntersectionObserver();
    const collectionsId = `q-store-collections-${SHORT_STORE_ID}`;
    stubNode({
      served: new Map([
        [collectionsId, { storeId: STORE_ID, collections: [{ id: "MUGSxxxxx1", title: "Mugs", products: [mug.id, poster.id] }, { id: "ARTxxxxxx1", title: "Art", products: [] }] }],
      ]),
    });
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer({ ...dataContainer, collectionsId }));
    const list = await screen.findByRole("list", { name: "Products" });
    await waitFor(() => expect(within(list).getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toContain("Mugs"));
    fireEvent.click(within(list).getByRole("button", { name: /^Edit.*\bPoster\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    const field = await within(dialog).findByRole("combobox", { name: "Collections" });
    await waitFor(() => expect(field).not.toBeDisabled());
    // In Mugs now; out of Mugs, into Art.
    const chips = () => within(dialog).getAllByRole("button").map((b) => b.textContent).filter((t) => t === "Mugs" || t === "Art");
    await waitFor(() => expect(chips()).toEqual(["Mugs"]));
    fireEvent.keyDown(field, { key: "Backspace" });
    fireEvent.mouseDown(field);
    fireEvent.click(await screen.findByRole("option", { name: "Art" }));
    expect(chips()).toEqual(["Art"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Edit product" })).toBeNull());
    // Nothing else changed, so the product itself has no draft; the collections do.
    expect(store.getState().global.productsToSave[poster.id]).toBeUndefined();
    expect(collectionDrafts.get(collectionsDraftKey(SELLER, STORE_ID))?.map((c) => [c.title, c.products])).toEqual([
      ["Mugs", [mug.id]],
      ["Art", [poster.id]],
    ]);
  });

  it("arranges a collection from its line: the new order waits with the unpublished collections, and the list shows it", async () => {
    const collectionsId = `q-store-collections-${SHORT_STORE_ID}`;
    stubNode({ served: new Map([[collectionsId, { storeId: STORE_ID, collections: [{ id: "MUGSxxxxx1", title: "Mugs", products: [mug.id, poster.id, "gone-product"] }] }]]) });
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer({ ...dataContainer, collectionsId }));
    const list = await screen.findByRole("list", { name: "Products" });
    const lines = () => within(list).getAllByRole("listitem").map((li) => li.querySelector("h2")?.textContent ?? within(li).queryByText(/^(Mug|Poster|Chair)$/)?.textContent);
    await waitFor(() => expect(lines()).toEqual(["Mugs", "Mug", "Poster", "Not in a collection", "Chair"]));
    fireEvent.click(within(list).getByRole("button", { name: "Arrange Mugs" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange Mugs" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Move up: Poster" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save order" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Arrange Mugs" })).toBeNull());
    await waitFor(() => expect(lines()).toEqual(["Mugs", "Poster", "Mug", "Not in a collection", "Chair"]));
    // A product the list doesn't have keeps its place after the arranged ones.
    expect(collectionDrafts.get(collectionsDraftKey(SELLER, STORE_ID))?.[0].products).toEqual([poster.id, mug.id, "gone-product"]);
    expect(within(await screen.findByRole("region", { name: "Unpublished changes" })).getByText("Collections")).toBeInTheDocument();
    // The products in no collection open the shop's Arrange.
    fireEvent.click(within(list).getByRole("button", { name: "Arrange the products not in a collection" }));
    expect(await screen.findByRole("dialog", { name: "Arrange your shop" })).toBeInTheDocument();
  });

  it("closes and opens a collection from its title, remembers it on this device, and a search still finds its products", async () => {
    const collectionsId = `q-store-collections-${SHORT_STORE_ID}`;
    stubNode({ served: new Map([[collectionsId, { storeId: STORE_ID, collections: [{ id: "MUGSxxxxx1", title: "Mugs", products: [mug.id, poster.id] }] }]]) });
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer({ ...dataContainer, collectionsId }));
    const list = await screen.findByRole("list", { name: "Products" });
    const mugs = await within(list).findByRole("button", { name: "Mugs", expanded: true });
    expect(within(list).getByText("2 products")).toBeInTheDocument();
    fireEvent.click(mugs);
    await waitFor(() => expect(names(list).filter(Boolean)).toEqual(["Chair"]));
    expect(within(list).getByRole("button", { name: "Mugs", expanded: false })).toBeInTheDocument();
    // Select all takes what the list shows.
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(JSON.parse(localStorage.getItem("qshopplus-collapsed-sections") ?? "{}")).toEqual({ [STORE_ID]: ["MUGSxxxxx1"] });
    // A search shows every match.
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your products" }), { target: { value: "mug" } });
    await waitFor(() => expect(names(list).filter(Boolean)).toEqual(["Mug"]));
    fireEvent.change(screen.getByRole("searchbox", { name: "Search your products" }), { target: { value: "" } });
    // Collapse all, then Expand all.
    fireEvent.click(await screen.findByRole("button", { name: "Collapse all" }));
    await waitFor(() => expect(names(list).filter(Boolean)).toEqual([]));
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    await waitFor(() => expect(names(list).filter(Boolean)).toEqual(["Mug", "Poster", "Chair"]));
  });
});


describe("giving a saved product variants", () => {
  it("makes the product the first item, keeping its id, and the others new products in its group", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Poster\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    const variants = within(dialog).getByRole("region", { name: "Variants" });
    fireEvent.click(within(variants).getByRole("switch", { name: /It comes in variants/ }));
    expect(within(variants).getByText(/This product becomes the first item/)).toBeInTheDocument();
    fireEvent.change(within(variants).getByRole("textbox", { name: "Variant 1" }), { target: { value: "A3" } });
    fireEvent.click(within(variants).getByRole("button", { name: "Add another variant" }));
    fireEvent.change(within(variants).getByRole("textbox", { name: "Variant 2" }), { target: { value: "A2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));

    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(2));
    const drafts = Object.values(store.getState().global.productsToSave) as any[];
    const first = store.getState().global.productsToSave[poster.id] as any;
    expect(first).toMatchObject({ title: "Poster | A3", isUpdate: true, variant: { values: ["A3"], lead: poster.id } });
    const other = drafts.find((d) => d.id !== poster.id);
    expect(other).toMatchObject({ title: "Poster | A2", variant: { values: ["A2"], lead: poster.id, group: first.variant.group } });
    expect(other.isUpdate ?? false).toBe(false);
  });
});

describe("adding a product in variants", () => {
  it("makes a draft per item (each variant's own values), and publishes the group on the product list", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true }, `/product-manager/${STORE_ID}?tab=products`);
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Glasses" } });
    await pickCategory(dialog, "glasses", "Health & Beauty");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Price in QORT/ }), { target: { value: "10" } });

    const variants = within(dialog).getByRole("region", { name: "Variants" });
    fireEvent.click(within(variants).getByRole("switch", { name: /It comes in variants/ }));
    fireEvent.change(within(variants).getByRole("textbox", { name: "Variant 1" }), { target: { value: "Round" } });
    const round = within(variants).getByRole("textbox", { name: "Round: add values" });
    fireEvent.change(round, { target: { value: "Pale, Orange" } });
    fireEvent.keyDown(round, { key: "Enter" });
    // Orange first: Alt and the arrow keys move a value, as a drag does.
    fireEvent.keyDown(within(variants).getByLabelText("Orange: Alt and the arrow keys move it"), { key: "ArrowLeft", altKey: true });
    fireEvent.click(within(variants).getByRole("button", { name: "Add another variant" }));
    fireEvent.change(within(variants).getByRole("textbox", { name: "Variant 2" }), { target: { value: "Square" } });
    const items = within(variants).getByRole("list", { name: "Items" });
    expect(within(items).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Round / Orange"),
      expect.stringContaining("Round / Pale"),
      expect.stringContaining("Square"),
    ]);
    fireEvent.change(within(items).getByRole("textbox", { name: "Price of Square in QORT" }), { target: { value: "12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));

    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(3));
    const drafts = Object.values(store.getState().global.productsToSave) as any[];
    expect(drafts.map((d) => [d.title, d.price[0].value])).toEqual([
      ["Glasses | Round / Orange", 10],
      ["Glasses | Round / Pale", 10],
      ["Glasses | Square", 12],
    ]);
    expect(within(screen.getByRole("region", { name: "Unpublished changes" })).getByText("3 products")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [call] = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    const list_ = decodeData64(call.resources.at(-1).data64);
    const group = drafts[0].variant.group;
    expect(list_.variantGroups).toEqual({
      [group]: { title: "Glasses", options: [{ name: "Round", values: [{ name: "Orange" }, { name: "Pale" }] }, { name: "Square", values: [] }], display: "bundle", lead: drafts[0].id },
    });
    expect(list_.products[drafts[2].id]).toMatchObject({ priceQort: 12, status: "AVAILABLE", variant: { group, values: ["Square"] } });
    const catalogue = decodeData64(call.resources[0].data64);
    expect(catalogue.products[drafts[0].id]).toMatchObject({ title: "Glasses | Round / Orange", variant: { group, values: ["Round", "Orange"], lead: drafts[0].id } });
  });
});

describe("editing a product in variants", () => {
  /** Glasses as published: Round / Pale (the lead) and Round / Orange in the fixture's catalogue, Square / Pale in a second. */
  function glasses() {
    const CAT2 = `q-store-catalogue-${SHORT_STORE_ID}-CATxxxxxx2`;
    const options = [
      { name: "Round", values: [{ name: "Pale" }, { name: "Orange", color: "#f97316" }] },
      { name: "Square", values: [{ name: "Pale" }] },
    ];
    const id = (s: string) => `q-store-product-${SHORT_STORE_ID}-${s}`;
    const items = [
      { id: id("GLASSPALE1"), values: ["Round", "Pale"], images: ["data:image/webp;base64,UEFMRQ==", "data:image/webp;base64,UFJPRA=="], catalogueId: CATALOGUE_ID, price: 10 },
      { id: id("GLASSORNG2"), values: ["Round", "Orange"], images: ["data:image/webp;base64,T1JORw=="], catalogueId: CATALOGUE_ID, price: 12 },
      { id: id("GLASSSQRE3"), values: ["Square", "Pale"], images: ["data:image/webp;base64,U1FSRQ=="], catalogueId: CAT2, price: 10 },
    ];
    const lead = items[0].id;
    const products = items.map((it) => ({
      ...mug,
      id: it.id,
      title: `Glasses — ${it.values.join(" / ")}`,
      description: "Blue-light blocking",
      type: "physical",
      category: "Health & Beauty",
      images: it.images,
      price: [{ currency: "qort", value: it.price }],
      catalogueId: it.catalogueId,
      variant: { group: "GLASSES001", title: "Glasses", options, values: it.values, display: "separate", lead },
    }));
    const cat1 = structuredClone(catalogue) as any;
    const cat2 = { id: CAT2, products: {} as Record<string, unknown> };
    for (const p of products) (p.catalogueId === CATALOGUE_ID ? cat1 : cat2).products[p.id] = p;
    const index = structuredClone(dataContainer) as any;
    for (const p of products) {
      index.products[p.id] = { created: p.created, priceQort: p.price[0].value, category: p.category, catalogueId: p.catalogueId, status: "AVAILABLE", variant: { group: "GLASSES001", values: p.variant.values } };
    }
    index.catalogues.push({ id: CAT2, products: { [products[2].id]: true } });
    index.variantGroups = { GLASSES001: { title: "Glasses", options, display: "separate", lead } };
    return { products, cat1, cat2, index, CAT2 };
  }

  it("opens the whole group from any item, and saves each item: taken out, out of stock, renamed", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const g = glasses();
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
    store.dispatch(setDataContainer(g.index));
    const q = installQortalMock({ FETCH_QDN_RESOURCE: async (req: any) => structuredClone(req.identifier === g.CAT2 ? g.cat2 : g.cat1) });
    renderWithProviders(
      <Routes>
        <Route path="/product-manager/:store" element={<ProductManager />} />
      </Routes>,
      { store, initialEntries: [`/product-manager/${STORE_ID}?tab=products`] }
    );
    // Square / Pale, in the second catalogue: the form reads the first for its group.
    fireEvent.click(await screen.findByRole("button", { name: /^Edit Glasses — Square \/ Pale\b/ }));
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });
    const variants = await within(dialog).findByRole("region", { name: "Variants" });
    expect(q.callsFor("FETCH_QDN_RESOURCE").map((c: any) => c.identifier).sort()).toEqual([CATALOGUE_ID, g.CAT2].sort());
    expect(within(dialog).getByRole("textbox", { name: /^Title/ })).toHaveValue("Glasses");
    // The lead's pictures are the product's.
    expect(within(dialog).getByRole("list", { name: "Pictures (2 of 10)" })).toBeInTheDocument();
    const items = within(variants).getByRole("list", { name: "Items" });
    expect(within(items).getAllByRole("listitem").map((li) => li.textContent?.match(/^[^·]+?(?= ·|Price)/)?.[0].trim())).toEqual(["Round / Pale", "Round / Orange", "Square / Pale"]);
    expect(within(items).getByRole("textbox", { name: "Price of Round / Orange in QORT" })).toHaveValue("12");
    expect(within(dialog).queryByRole("group", { name: "Status" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Delete all 3" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Blue-light glasses" } });
    fireEvent.click(within(variants).getByRole("button", { name: "Remove Orange" }));
    expect(within(variants).getByRole("status")).toHaveTextContent("Taken out: Round / Orange");
    fireEvent.click(within(variants).getByRole("switch", { name: "In stock: Square / Pale" }));
    fireEvent.change(within(variants).getByRole("textbox", { name: "Variant 1" }), { target: { value: "Oval" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save to drafts" }));

    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(3));
    const saved = store.getState().global.productsToSave as Record<string, any>;
    const [pale, orange, square] = g.products.map((p) => saved[p.id]);
    expect([pale.title, pale.status, pale.isUpdate, pale.images]).toEqual(["Blue-light glasses | Oval / Pale", "AVAILABLE", true, g.products[0].images]);
    expect([square.title, square.status, square.images]).toEqual(["Blue-light glasses | Square / Pale", "OUT_OF_STOCK", g.products[2].images]);
    expect(square.variant).toMatchObject({ group: "GLASSES001", title: "Blue-light glasses", values: ["Square", "Pale"], display: "separate", lead: g.products[0].id });
    expect(square.variant.options).toEqual([
      { name: "Oval", values: [{ name: "Pale" }] },
      { name: "Square", values: [{ name: "Pale" }] },
    ]);
    // Taken out: retired, out of the group, as it was otherwise.
    expect([orange.title, orange.status, orange.isUpdate, orange.variant]).toEqual(["Glasses — Round / Orange", "RETIRED", true, undefined]);
  });
});

describe("variants in a shop that prices in a currency", () => {
  it("prices each item in USD with no product price, the QORT following the shop's rates", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer({ ...dataContainer, fiatPricing: { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } }));
    fireEvent.click(screen.getByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Glasses" } });
    await pickCategory(dialog, "glasses", "Health & Beauty");
    const variants = within(dialog).getByRole("region", { name: "Variants" });
    fireEvent.click(within(variants).getByRole("switch", { name: /It comes in variants/ }));
    fireEvent.change(within(variants).getByRole("textbox", { name: "Variant 1" }), { target: { value: "Round" } });
    const round = within(variants).getByRole("textbox", { name: "Round: add values" });
    fireEvent.change(round, { target: { value: "Pale, Orange" } });
    fireEvent.keyDown(round, { key: "Enter" });
    const items = within(variants).getByRole("list", { name: "Items" });
    // In USD although no price was typed for the product.
    fireEvent.change(within(items).getByRole("textbox", { name: "Price of Round / Pale in USD" }), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    expect(await within(dialog).findByText("Set a price for Round / Orange, or one for the product.")).toBeInTheDocument();
    fireEvent.change(within(items).getByRole("textbox", { name: "Price of Round / Orange in USD" }), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(2));
    const drafts = Object.values(store.getState().global.productsToSave) as any[];
    expect(drafts.map((d) => [d.title, d.fiatPrice?.value, d.price[0].value])).toEqual([
      ["Glasses | Round / Pale", 4, 20],
      ["Glasses | Round / Orange", 5, 25],
    ]);
  });
});

describe("auctions in the Products tab", () => {
  it("say when they start and end, in the past tense once passed", async () => {
    installVisibleIntersectionObserver();
    stubNode();
    const now = Date.now();
    const index = structuredClone(dataContainer) as any;
    index.products[mug.id].auction = { start: now + 2 * 86_400_000, end: now + 5 * 86_400_000 };
    index.products[poster.id].auction = { start: now - 5 * 86_400_000, end: now - 86_400_000 };
    const { store } = setup({}, `/product-manager/${STORE_ID}?tab=products`);
    store.dispatch(setDataContainer(index));
    const list = await screen.findByRole("list", { name: "Products" });
    const rowOf = (name: string) => within(list).getByRole("button", { name: new RegExp(`\\b${name}\\b`) });
    await waitFor(() => expect(rowOf("Mug")).toHaveTextContent(/Starts .+ · Ends /));
    expect(rowOf("Poster")).toHaveTextContent(/Started .+ · Ended /);
    expect(rowOf("Chair")).not.toHaveTextContent(/Starts|Started/);
  });
});

