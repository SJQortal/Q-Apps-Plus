/**
 * Deleting a whole shop from the seller page's Shop tab, against the mocked
 * Hub and node: the confirmation, what goes to Hub (compared with
 * qdn/payloads.ts buildDeleteShopPublish), what the app does after, and how
 * lists leave a deleted shop out. Nothing reaches a real node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer, setProductsToSave } from "../state/features/globalSlice";
import { setAllMyStores } from "../state/features/storeSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock, type QortalHandler } from "../test/qortalMock";
import {
  CATALOGUE_ID,
  DATA_CONTAINER_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  STORE_ID,
  dataContainer,
  mug,
  viewedStore,
} from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { buildDeleteShopPublish } from "../qdn/payloads";
import { resetQdnCaches } from "../qdn/search";
import { roomTiming } from "../qdn/publishBatches";
import { isRecentlyDeletedShop, noteDeletedShop, resetDeletedShops } from "../qdn/deleted";
import { getShopDetails, resetShopDetails } from "../discovery/shopDetails";
import { shopEntryFromRow, shopKey } from "../discovery/shopIndex";
import { findOwnShops } from "../hooks/useOwnShops";
import { DELETE_SHOP_SEARCH_FAILED_TEXT } from "./useDeleteShop";

const OTHER_ID = "q-store-general-other";
const ORPHAN = "q-store-catalogue-my-shop-ORPHANxxx1";
const GONE = "q-store-catalogue-my-shop-GONExxxxx1";
const NEIGHBOUR = "q-store-catalogue-my-shop-2-OTHERxxxx1";
const MARK = { title: "deleted", description: "deleted", tags: ["deleted"] };

/**
 * The node: the product list, a catalogue search by prefix (the list's
 * catalogue, one it doesn't name, one already deleted, and a shop whose id
 * starts the same), and the seller's two shops.
 */
function stubNode(opts: { searchFails?: boolean } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      const [path, qs] = url.split("?");
      const params = new URLSearchParams(qs ?? "");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (path === "/transactions/unconfirmed") return ok([]);
      if (path.startsWith("/transactions/unitfee")) return ok("1000000");
      if (path === "/arbitrary/resources/search" && params.get("service") === "DOCUMENT") {
        if (opts.searchFails) return { ok: false, status: 500, text: async () => "{}", json: async () => ({}) };
        const all = [
          { name: SELLER, service: "DOCUMENT", identifier: CATALOGUE_ID },
          { name: SELLER, service: "DOCUMENT", identifier: ORPHAN },
          { name: SELLER, service: "DOCUMENT", identifier: GONE, metadata: MARK },
          { name: SELLER, service: "DOCUMENT", identifier: NEIGHBOUR },
        ];
        return ok(Number(params.get("offset")) > 0 ? [] : all);
      }
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) return ok(dataContainer);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
}

function setup(handlers: Record<string, QortalHandler> = {}) {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(
    setAllMyStores([
      { id: STORE_ID, owner: SELLER, title: viewedStore.title, created: 1 },
      { id: OTHER_ID, owner: SELLER, title: "Other shop", created: 2 },
    ])
  );
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(dataContainer));
  store.dispatch(setProductsToSave({ ...mug, title: "Mug v2", isUpdate: true }));
  store.dispatch(setProductsToSave({ ...mug, id: "q-store-product-other-NEWxxxxxx1", storeId: OTHER_ID }));
  const q = installQortalMock({ ...handlers });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=shop`] }
  );
  return { store, q };
}

async function confirmDelete(id = "my-shop") {
  fireEvent.click(await screen.findByRole("button", { name: "Delete shop" }));
  const dialog = await screen.findByRole("dialog", { name: "Delete shop?" });
  const go = within(dialog).getByRole("button", { name: "Delete shop" });
  expect(go).toBeDisabled();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Shop id" }), { target: { value: id } });
  return { dialog, go };
}

beforeEach(() => {
  resetQdnCaches();
  resetDeletedShops();
  resetShopDetails();
  roomTiming.visibleMs = 5;
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomTiming.visibleMs = 10_000;
});

describe("deleting a shop", () => {
  it("deletes the shop first, then its product list and every catalogue of it, and leaves it everywhere", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const { dialog, go } = await confirmDelete();
    expect(within(dialog).getByText(/This deletes Seller's Shop and its 3 products/)).toBeInTheDocument();
    expect(within(dialog).getByText(/handle open orders first/)).toBeInTheDocument();
    fireEvent.click(go);

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    // The list's catalogue and the one only the search found; not the deleted one, nor my-shop-2's.
    expect(sent).toEqual(buildDeleteShopPublish({ name: SELLER, storeId: STORE_ID, catalogueIds: [CATALOGUE_ID, ORPHAN] }).resources);
    expect(sent.map((r: any) => [r.service, r.identifier, r.data64])).toEqual([
      ["STORE", STORE_ID, "RA=="],
      ["DOCUMENT", DATA_CONTAINER_ID, "RA=="],
      ["DOCUMENT", CATALOGUE_ID, "RA=="],
      ["DOCUMENT", ORPHAN, "RA=="],
    ]);

    expect(await screen.findByText("Home page")).toBeInTheDocument();
    const state = store.getState();
    expect(state.store.myStores.map((s) => s.id)).toEqual([OTHER_ID]);
    expect(state.global.currentStore).toBeNull();
    expect(state.global.recentlyVisitedStoreId).toBe(OTHER_ID);
    expect(Object.keys(state.global.productsToSave)).toEqual(["q-store-product-other-NEWxxxxxx1"]);
    expect(state.notifications.alertTypes.alertSuccess).toBe("Shop deleted");
    expect(isRecentlyDeletedShop(SELLER, STORE_ID)).toBe(true);
    expect(getShopDetails(shopKey(SELLER, STORE_ID))).toMatchObject({ valid: false, deleted: true });
  });

  it("needs the shop id typed exactly; Cancel deletes nothing", async () => {
    stubNode();
    const { store, q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const { dialog, go } = await confirmDelete("my-shop-2");
    expect(go).toBeDisabled();
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Shop id" }), { target: { value: " my-shop " } });
    expect(go).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(store.getState().store.myStores).toHaveLength(2);
  });

  it("a decline in Hub changes nothing", async () => {
    stubNode();
    const { store, q } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: "User declined request" };
      },
    });
    const { go } = await confirmDelete();
    fireEvent.click(go);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(store.getState().global.currentStore?.id).toBe(STORE_ID);
    expect(store.getState().store.myStores).toHaveLength(2);
    expect(isRecentlyDeletedShop(SELLER, STORE_ID)).toBe(false);
    expect(screen.queryByText("Home page")).toBeNull();
  });

  it("once the shop itself landed, closing early still deletes it here, and says what wasn't cleared", async () => {
    stubNode();
    const { store } = setup({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: { unsuccessfulPublishes: [{ identifier: ORPHAN }] } };
      },
    });
    const { go } = await confirmDelete();
    fireEvent.click(go);
    const result = await screen.findByRole("dialog", { name: "Delete incomplete" });
    fireEvent.click(within(result).getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(store.getState().store.myStores.map((s) => s.id)).toEqual([OTHER_ID]);
    expect(store.getState().notifications.alertTypes.alertInfo).toBe("Shop deleted. Some of its products' details weren't cleared from QDN.");
  });

  it("stops before sending anything when the shop's catalogues can't be listed", async () => {
    stubNode({ searchFails: true });
    const { q } = setup({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const { dialog, go } = await confirmDelete();
    fireEvent.click(go);
    expect(await within(dialog).findByText(DELETE_SHOP_SEARCH_FAILED_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });
});

describe("lists and a deleted shop", () => {
  const row = (extra: object = {}) => ({ name: SELLER, service: "STORE", identifier: STORE_ID, created: 1, updated: 2, ...extra });

  it("home leaves out a shop whose metadata says deleted, or that this browser deleted within the hour", () => {
    expect(shopEntryFromRow(row({ metadata: { title: "Seller's Shop" } }))).not.toBeNull();
    expect(shopEntryFromRow(row({ metadata: MARK }))).toBeNull();
    noteDeletedShop(SELLER, STORE_ID);
    expect(shopEntryFromRow(row({ metadata: { title: "Seller's Shop" } }))).toBeNull();
  });

  it("the seller's shops leave it out too", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [row({ metadata: MARK }), row({ identifier: OTHER_ID, metadata: { title: "Other shop" } })],
        text: async () => "",
      }))
    );
    expect((await findOwnShops(SELLER)).map((s) => s.id)).toEqual([OTHER_ID]);
  });
});
