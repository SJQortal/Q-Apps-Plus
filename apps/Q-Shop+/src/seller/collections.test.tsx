/**
 * The seller's Collections tab against the mocked Hub and node: making a
 * collection, the working copy (edit, move, remove, discard), what goes to
 * Hub (compared with qdn/collections.ts), and the guards that keep another
 * device's collections from being overwritten. Nothing reaches a real node.
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
import { COLLECTIONS_CHANGED_TEXT, resetSentCollections } from "./useCollections";
import { INDEX_CHANGED_TEXT } from "./freshIndex";

vi.mock("../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TkVX")}>
      {label}
    </button>
  ),
}));

const DOC_ID = "q-store-collections-my-shop";
const PIC = "data:image/webp;base64,UElD";
const gifts = { id: "GIFTSxxxx1", title: "Gifts", description: "For friends", image: PIC, products: [mug.id], created: 1, updated: 2 };
const home = { id: "HOMExxxxx2", title: "Home", description: "", products: [chair.id, poster.id], created: 3, updated: 4 };

/**
 * The node: the product list (the fixture's, `pointer` adds collectionsId),
 * and the collections document: the versions in `docs` are served one read
 * after another (the last one stays); none → not published (404); "unreadable"
 * → listed by search but its JSON can't be served.
 */
function stubNode(opts: { pointer?: boolean; docs?: unknown[]; unreadable?: boolean; index?: unknown } = {}) {
  const docs = [...(opts.docs ?? [])];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      const [path, qs] = url.split("?");
      const params = new URLSearchParams(qs ?? "");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      const missing = { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
      if (path.startsWith("/transactions/unconfirmed")) return ok([]);
      if (path.startsWith("/transactions/unitfee")) return ok("1000000");
      if (path === "/arbitrary/resources/search") {
        const listed = opts.unreadable && params.get("identifier") === DOC_ID;
        return ok(listed ? [{ name: SELLER, service: "DOCUMENT", identifier: DOC_ID }] : []);
      }
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) {
        if (opts.index) return ok(opts.index);
        return ok(opts.pointer ? { ...dataContainer, collectionsId: DOC_ID } : dataContainer);
      }
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DOC_ID}`) {
        if (opts.unreadable || docs.length === 0) return missing;
        return ok(docs.length > 1 ? docs.shift() : docs[0]);
      }
      return missing;
    })
  );
}

function setup(opts: { pointer?: boolean } = {}, handlers: Record<string, QortalHandler> = {}) {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(opts.pointer ? { ...dataContainer, collectionsId: DOC_ID } : dataContainer));
  const q = installQortalMock({ FETCH_QDN_RESOURCE: async () => structuredClone(catalogue), ...handlers });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=collections`] }
  );
  return { store, q };
}

const titles = () =>
  within(screen.getByRole("list", { name: "Collections" }))
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);

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

describe("the Collections tab", () => {
  it("makes a collection, then publishes the document and (the first time) the product list pointing at it", async () => {
    stubNode();
    const { store, q } = setup({}, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    fireEvent.click(await screen.findByRole("button", { name: "New collection" }));
    const editor = await screen.findByRole("dialog", { name: "New collection" });
    fireEvent.change(within(editor).getByRole("textbox", { name: /^Title/ }), { target: { value: "Gifts" } });
    fireEvent.change(within(editor).getByRole("textbox", { name: /^Description/ }), { target: { value: "For friends" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Add a picture" }));
    fireEvent.click(await within(editor).findByRole("checkbox", { name: /Poster/ }));
    fireEvent.click(within(editor).getByRole("checkbox", { name: /Mug/ }));
    expect(within(editor).getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole("button", { name: "Done" }));

    await waitFor(() => expect(titles()).toEqual(["Gifts"]));
    expect(screen.getByText("2 products")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Unpublished changes" })).getByText("Collections")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(sent.map((r: any) => [r.service, r.identifier, r.filename])).toEqual([
      ["DOCUMENT", DOC_ID, "collections.json"],
      ["DOCUMENT", DATA_CONTAINER_ID, "datacontainer.json"],
    ]);
    expect(decodeData64(sent[0].data64)).toEqual({
      storeId: STORE_ID,
      collections: [
        {
          id: expect.any(String),
          title: "Gifts",
          description: "For friends",
          image: "data:image/webp;base64,TkVX",
          products: [poster.id, mug.id],
          created: expect.any(Number),
          updated: expect.any(Number),
        },
      ],
    });
    expect(decodeData64(sent[1].data64)).toEqual({ ...dataContainer, collectionsId: DOC_ID });
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Collections published"));
    expect((store.getState().global.dataContainer as any).collectionsId).toBe(DOC_ID);
    expect(screen.queryByRole("region", { name: "Unpublished changes" })).toBeNull();
  });

  it("edits, moves and removes only the working copy; Discard brings back what's published", async () => {
    stubNode({ pointer: true, docs: [{ storeId: STORE_ID, collections: [gifts, home] }] });
    const { q } = setup({ pointer: true });
    await waitFor(() => expect(titles()).toEqual(["Gifts", "Home"]));
    expect(screen.queryByRole("button", { name: /^Publish changes/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Move up: Gifts" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Move up: Home" }));
    expect(titles()).toEqual(["Home", "Gifts"]);
    expect(screen.getByText("Home moved to 1 of 2.")).toBeInTheDocument();
    // Focus stays on the moved collection (its Move up is now disabled, so its Edit).
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit: Home" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Remove: Gifts" }));
    expect(titles()).toEqual(["Home"]);
    // Undo puts it back where it was.
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(titles()).toEqual(["Home", "Gifts"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove: Gifts" }));
    expect(titles()).toEqual(["Home"]);
    fireEvent.click(screen.getByRole("button", { name: "Edit: Home" }));
    const editor = await screen.findByRole("dialog", { name: "Edit collection" });
    expect(within(editor).getByRole("textbox", { name: /^Title/ })).toHaveValue("Home");
    expect(await within(editor).findByRole("checkbox", { name: /Chair/ })).toBeChecked();
    fireEvent.change(within(editor).getByRole("textbox", { name: /^Title/ }), { target: { value: "Home and garden" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(titles()).toEqual(["Home and garden"]));
    // Discard (beside Publish changes) asks first.
    fireEvent.click(within(screen.getByRole("region", { name: "Unpublished changes" })).getByRole("button", { name: "Discard" }));
    const ask = await screen.findByRole("dialog", { name: "Discard your changes?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Discard all" }));
    await waitFor(() => expect(titles()).toEqual(["Gifts", "Home"]));
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("publishes only the document once the product list points at it, leaving out products no longer listed", async () => {
    const stale = { ...gifts, products: [mug.id, "q-store-product-my-shop-GONExxxxx9"] };
    stubNode({ pointer: true, docs: [{ storeId: STORE_ID, collections: [stale] }] });
    const { q } = setup({ pointer: true }, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    await waitFor(() => expect(titles()).toEqual(["Gifts"]));
    fireEvent.click(screen.getByRole("button", { name: "Edit: Gifts" }));
    const editor = await screen.findByRole("dialog", { name: "Edit collection" });
    fireEvent.change(within(editor).getByRole("textbox", { name: /^Description/ }), { target: { value: "For friends and family" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Done" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(sent.map((r: any) => r.identifier)).toEqual([DOC_ID]);
    expect(decodeData64(sent[0].data64).collections[0]).toMatchObject({ description: "For friends and family", products: [mug.id] });
  });

  it("shows collections changed on QDN since the page loaded, and publishes nothing", async () => {
    const theirs = { ...home, title: "Made on my phone" };
    stubNode({ pointer: true, docs: [{ storeId: STORE_ID, collections: [gifts] }, { storeId: STORE_ID, collections: [gifts, theirs] }] });
    const { q } = setup({ pointer: true }, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    await waitFor(() => expect(titles()).toEqual(["Gifts"]));
    fireEvent.click(screen.getByRole("button", { name: "Remove: Gifts" }));
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    expect(await screen.findByText(COLLECTIONS_CHANGED_TEXT)).toBeInTheDocument();
    expect(titles()).toEqual(["Gifts", "Made on my phone"]);
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("won't start over when collections exist but can't be read yet", async () => {
    stubNode({ pointer: true, unreadable: true });
    setup({ pointer: true });
    expect(await screen.findByText("Couldn't load your collections from your node")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New collection" })).toBeNull();
  });

  it("keeps unpublished changes when the seller goes to another tab and back", async () => {
    stubNode({ pointer: true, docs: [{ storeId: STORE_ID, collections: [gifts, home] }] });
    setup({ pointer: true });
    await waitFor(() => expect(titles()).toEqual(["Gifts", "Home"]));
    fireEvent.click(screen.getByRole("button", { name: "Remove: Gifts" }));
    expect(titles()).toEqual(["Home"]);
    fireEvent.click(screen.getByRole("tab", { name: "Products" }));
    await screen.findByRole("list", { name: "Products" });
    fireEvent.click(screen.getByRole("tab", { name: "Collections" }));
    await waitFor(() => expect(titles()).toEqual(["Home"]));
    expect(within(screen.getByRole("region", { name: "Unpublished changes" })).getByText("Collections")).toBeInTheDocument();
  });

  it("never drops a product another device added: the product list is read fresh before anything is left out", async () => {
    const lamp = `q-store-product-my-shop-LAMPxxxxx4`;
    const newer = {
      ...dataContainer,
      collectionsId: DOC_ID,
      products: { ...dataContainer.products, [lamp]: { created: 9, priceQort: 3, category: "Lighting", catalogueId: dataContainer.catalogues[0].id, status: "AVAILABLE" } },
      catalogues: [{ id: dataContainer.catalogues[0].id, products: { ...dataContainer.catalogues[0].products, [lamp]: true } }],
    };
    const withLamp = { ...gifts, products: [mug.id, lamp] };
    stubNode({ pointer: true, index: newer, docs: [{ storeId: STORE_ID, collections: [withLamp] }] });
    const { store, q } = setup({ pointer: true }, { PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    await waitFor(() => expect(titles()).toEqual(["Gifts"]));
    fireEvent.click(screen.getByRole("button", { name: "Edit: Gifts" }));
    const editor = await screen.findByRole("dialog", { name: "Edit collection" });
    fireEvent.change(within(editor).getByRole("textbox", { name: /^Description/ }), { target: { value: "New words" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Done" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Publish changes/ }));
    // The page's list lacked the lamp: it's shown first, and nothing went out.
    expect(await screen.findByText(INDEX_CHANGED_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(Object.keys(store.getState().global.dataContainer!.products)).toContain(lamp);
    // Publishing again keeps the lamp in the collection.
    fireEvent.click(screen.getByRole("button", { name: /^Publish changes/ }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(decodeData64(sent[0].data64).collections[0].products).toEqual([mug.id, lamp]);
  });

  it("asks before throwing away an edited collection, and puts a missing title on the field", async () => {
    stubNode();
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "New collection" }));
    const editor = await screen.findByRole("dialog", { name: "New collection" });
    fireEvent.click(within(editor).getByRole("button", { name: "Done" }));
    const title = within(editor).getByRole("textbox", { name: /^Title/ });
    expect(title).toHaveFocus();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(within(editor).getByText("Give the collection a title.")).toBeInTheDocument();
    fireEvent.change(title, { target: { value: "Gifts" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
    const ask = await screen.findByRole("dialog", { name: "Discard changes?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(await screen.findByRole("dialog", { name: "New collection" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Title/ })).toHaveValue("Gifts");
  });
});
