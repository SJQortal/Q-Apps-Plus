/**
 * Arranging products against the mocked Hub and node: the shop's order
 * (Products tab → Arrange, published as the product list's `productOrder`)
 * and a collection's (its editor's Arrange). Nothing reaches a real node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock, type QortalHandler } from "../test/qortalMock";
import { installVisibleIntersectionObserver } from "../test/mockNode";
import {
  DATA_CONTAINER_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
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
import { resetQdnCaches } from "../qdn/search";
import { roomTiming } from "../qdn/publishBatches";
import { resetPublishedIndexes } from "./productIndex";
import { resetSentCollections } from "./useCollections";
import { INDEX_CHANGED_TEXT } from "./freshIndex";
import { moveItem } from "./ArrangeDialog";
import { selectField, selectValue } from "../test/select";

const DOC_ID = "q-store-collections-my-shop";

/** The node: the product list (`index`, else the page's), a collections document when given, room on the account. */
function stubNode(opts: { index?: unknown; collections?: unknown } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const [path] = String(input).split("?");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      const missing = { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
      if (path.startsWith("/transactions/unconfirmed")) return ok([]);
      if (path.startsWith("/transactions/unitfee")) return ok("1000000");
      if (path === "/arbitrary/resources/search") return ok([]);
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) return ok(opts.index ?? pageIndex);
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DOC_ID}` && opts.collections) return ok(opts.collections);
      return missing;
    })
  );
}

let pageIndex: Record<string, unknown> = dataContainer;

function setup(tab: string, index: Record<string, unknown> = dataContainer, handlers: Record<string, QortalHandler> = {}) {
  pageIndex = index;
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(index));
  const q = installQortalMock({ FETCH_QDN_RESOURCE: async () => structuredClone(catalogue), ...handlers });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=${tab}`] }
  );
  return { store, q };
}

const order = (dialog: HTMLElement) =>
  within(within(dialog).getByRole("list", { name: "Products in order" }))
    .getAllByRole("listitem")
    .map((li) => within(li).queryByText(/^(Mug|Poster|Chair)$/)?.textContent);

beforeEach(() => {
  installVisibleIntersectionObserver();
  resetQdnCaches();
  resetPublishedIndexes();
  resetSentCollections();
  roomTiming.visibleMs = 5;
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomTiming.visibleMs = 10_000;
});

describe("moveItem", () => {
  it("moves one item and leaves the rest in order", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 9)).toEqual(["b", "c", "a"]);
    const same = ["a", "b"];
    expect(moveItem(same, 1, 1)).toBe(same);
  });
});

describe("arranging the shop", () => {
  it("moves products and publishes the product list with the order, its shape otherwise unchanged", async () => {
    stubNode();
    const { store, q } = setup("products", dataContainer, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    fireEvent.click(await screen.findByRole("button", { name: "Arrange" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange your shop" });
    await waitFor(() => expect(order(dialog)).toEqual(["Mug", "Poster", "Chair"]));
    expect(within(dialog).getByRole("button", { name: "Publish order" })).toBeDisabled();
    // No "Newest first" while the shop has no order yet.
    expect(within(dialog).queryByRole("button", { name: "Newest first" })).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "More moves: Chair" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move to top" }));
    await waitFor(() => expect(order(dialog)).toEqual(["Chair", "Mug", "Poster"]));
    expect(within(dialog).getByText("Chair moved to 1 of 3.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Move down: Mug" }));
    expect(order(dialog)).toEqual(["Chair", "Poster", "Mug"]);
    // The focus stays on the product that moved (now last, so on its Move up).
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Move up: Mug" })).toHaveFocus());

    fireEvent.click(within(dialog).getByRole("button", { name: "Publish order" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [resource] = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(resource).toMatchObject({ name: SELLER, service: "DOCUMENT", identifier: DATA_CONTAINER_ID, filename: "datacontainer.json" });
    expect(decodeData64(resource.data64)).toEqual({ ...dataContainer, productOrder: [chair.id, poster.id, mug.id] });
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Your shop's order is published"));
    expect((store.getState().global.dataContainer as any).productOrder).toEqual([chair.id, poster.id, mug.id]);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Arrange your shop" })).toBeNull());
    // The Products list shows the new order at once (Simon: it stayed newest first), sorted Featured.
    expect(selectValue(selectField("Sort"))).toBe("featured");
    const list = within(screen.getByRole("list", { name: "Products" }));
    await waitFor(() =>
      expect(list.getAllByRole("listitem").map((li) => within(li).queryByText(/^(Mug|Poster|Chair)$/)?.textContent)).toEqual(["Chair", "Poster", "Mug"])
    );
  });

  it("with collections, arranges only the products in none, and keeps the collections' products in the saved order after them", async () => {
    const index = { ...dataContainer, collectionsId: DOC_ID, productOrder: [mug.id, chair.id, poster.id] };
    stubNode({ index, collections: { storeId: STORE_ID, collections: [{ id: "MUGSxxxxx1", title: "Mugs", products: [mug.id] }] } });
    const { q } = setup("products", index, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    // The list: the collection first, under its line, then the rest in the shop's order.
    const list = await screen.findByRole("list", { name: "Products" });
    await waitFor(() => expect(within(list).getByRole("heading", { level: 2, name: "Mugs" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Arrange" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange your shop" });
    await waitFor(() => expect(order(dialog)).toEqual(["Chair", "Poster"]));
    expect(within(dialog).getByText(/Your collections' products come first/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Move up: Poster" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish order" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [resource] = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(decodeData64(resource.data64).productOrder).toEqual([poster.id, chair.id, mug.id]);
  });

  it("starts from the shop's order, products added since at the end; Newest first publishes an empty order", async () => {
    const ordered = { ...dataContainer, productOrder: [chair.id, mug.id] };
    stubNode();
    const { q } = setup("products", ordered, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    fireEvent.click(await screen.findByRole("button", { name: "Arrange" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange your shop" });
    await waitFor(() => expect(order(dialog)).toEqual(["Chair", "Mug", "Poster"]));
    fireEvent.click(within(dialog).getByRole("button", { name: "Newest first" }));
    expect(order(dialog)).toEqual(["Mug", "Poster", "Chair"]);
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish order" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const [resource] = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(decodeData64(resource.data64).productOrder).toEqual([]);
  });

  it("publishes nothing when the product list on QDN changed, and shows it first", async () => {
    const elsewhere = {
      ...dataContainer,
      products: { ...dataContainer.products, "q-store-product-my-shop-NEWxxxxxx9": { ...dataContainer.products[mug.id], created: 1790000000000 } },
    };
    stubNode({ index: elsewhere });
    const { q } = setup("products");
    fireEvent.click(await screen.findByRole("button", { name: "Arrange" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange your shop" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move up: Poster" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish order" }));
    expect(await screen.findByText(INDEX_CHANGED_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    // It starts again from the product list as it is now: four products.
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Products in order" })).getAllByRole("listitem")).toHaveLength(4)
    );
  });

  it("asks before dropping a new order", async () => {
    stubNode();
    setup("products");
    fireEvent.click(await screen.findByRole("button", { name: "Arrange" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange your shop" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move up: Poster" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const ask = await screen.findByRole("dialog", { name: "Discard the new order?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Arrange your shop" })).toBeNull());
  });
});

describe("arranging a collection", () => {
  it("keeps the picked order and changes it with Arrange", async () => {
    const home = { id: "HOMExxxxx2", title: "Home", description: "", products: [chair.id, poster.id, mug.id], created: 3, updated: 4 };
    stubNode({ collections: { storeId: STORE_ID, collections: [home] } });
    setup("collections", { ...dataContainer, collectionsId: DOC_ID });
    fireEvent.click(await screen.findByRole("button", { name: "Edit: Home" }));
    const editor = await screen.findByRole("dialog", { name: "Edit collection" });
    expect(within(editor).getByText(/Buyers see them in the order you picked them/)).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole("button", { name: "Arrange" }));
    const dialog = await screen.findByRole("dialog", { name: "Arrange this collection" });
    await waitFor(() => expect(order(dialog)).toEqual(["Chair", "Poster", "Mug"]));
    fireEvent.click(within(dialog).getByRole("button", { name: "Move up: Mug" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Arrange this collection" })).toBeNull());
    fireEvent.click(within(editor).getByRole("button", { name: "Done" }));
    // The working copy has the new order; Publish sends it.
    expect(await screen.findByText(/Your changes aren't published yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit: Home" }));
    const again = await screen.findByRole("dialog", { name: "Edit collection" });
    fireEvent.click(within(again).getByRole("button", { name: "Arrange" }));
    const second = await screen.findByRole("dialog", { name: "Arrange this collection" });
    await waitFor(() => expect(order(second)).toEqual(["Chair", "Mug", "Poster"]));
  });
});
