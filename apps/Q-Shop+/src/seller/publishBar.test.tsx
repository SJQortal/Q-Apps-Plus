/**
 * The seller page's unpublished changes (seller/PublishBar.tsx): the bar in
 * the warning colour whenever something waits, its list when several kinds
 * do, publishing a kind from another tab, leaving the page with changes
 * (keep as drafts, or discard), and product drafts kept on this device
 * coming back. Nothing reaches a real node.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Link, Route, Routes } from "react-router-dom";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer, setProductsToSave } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { DATA_CONTAINER_ID, SELLER, SELLER_ADDRESS, SELLER_PK, STORE_ID, catalogue, chair, dataContainer, decodeData64, viewedStore } from "../test/fixtures/shop";
import { ProductManager } from "../pages/ProductManager/ProductManager";
import { draftKey } from "./deviceDrafts";
import { deliveryDrafts } from "./sellerDrafts";
import { productDraftStore } from "./productDraftsDevice";

const KEY = draftKey(SELLER, STORE_ID);
const deliveryDraft = { v: 1 as const, storeId: STORE_ID, currency: "QORT", general: { zones: [{ id: "all", countries: ["PT"], first: 2 }] }, profiles: [], updated: 0 };

function setup(tab = "overview") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const [path] = String(input).split("?");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (path === "/arbitrary/resources/search") return ok([]);
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) return ok(dataContainer);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(dataContainer));
  const q = installQortalMock({ FETCH_QDN_RESOURCE: async () => structuredClone(catalogue), PUBLISH_QDN_RESOURCE: async () => true });
  renderWithProviders(
    <>
      <Link to="/">Leave the seller page</Link>
      <Routes>
        <Route path="/product-manager/:store" element={<ProductManager />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=${tab}`] }
  );
  return { store, q };
}

const bar = () => screen.findByRole("region", { name: "Unpublished changes" });

afterEach(() => vi.unstubAllGlobals());

describe("unpublished changes on the seller page", () => {
  it("shows the bar while anything waits, and lists the kinds to publish or discard each", async () => {
    deliveryDrafts.set(KEY, deliveryDraft);
    const { store } = setup();
    store.dispatch(setProductsToSave({ ...chair, storeId: STORE_ID, title: "Chair, new price" }));
    expect(within(await bar()).getByText("1 product · Delivery prices")).toBeInTheDocument();
    fireEvent.click(within(await bar()).getByRole("button", { name: "Publish changes" }));
    const list = within(await screen.findByRole("dialog", { name: "Publish changes" })).getByRole("list", { name: "Unpublished changes" });
    const delivery = within(list).getByText("Delivery prices").closest("li") as HTMLElement;
    fireEvent.click(within(delivery).getByRole("button", { name: "Discard" }));
    expect(deliveryDrafts.get(KEY)).toBeNull();
    // The list stays open with what's left.
    await waitFor(() => expect(within(list).queryByText("Delivery prices")).toBeNull());
    expect(within(list).getByText("1 product")).toBeInTheDocument();
  });

  it("publishes delivery prices from another tab: the bar opens the Delivery tab, which publishes them", async () => {
    deliveryDrafts.set(KEY, deliveryDraft);
    const { q } = setup("overview");
    fireEvent.click(within(await bar()).getByRole("button", { name: "Publish changes" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(decodeData64(String((q.callsFor("PUBLISH_QDN_RESOURCE")[0] as Record<string, unknown>).data64))).toMatchObject({ general: deliveryDraft.general });
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unpublished changes" })).toBeNull());
  });

  it("asks before leaving with changes: keeping them as drafts leaves, and they wait on this device", async () => {
    deliveryDrafts.set(KEY, deliveryDraft);
    setup();
    await bar();
    fireEvent.click(screen.getByRole("link", { name: "Leave the seller page" }));
    const ask = await screen.findByRole("dialog", { name: "Your changes aren't published" });
    fireEvent.click(within(ask).getByRole("button", { name: "Keep as drafts" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(deliveryDrafts.get(KEY)).toEqual(deliveryDraft);
  });

  it("discarding the changes on leaving drops them", async () => {
    deliveryDrafts.set(KEY, deliveryDraft);
    setup();
    await bar();
    fireEvent.click(screen.getByRole("link", { name: "Leave the seller page" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Your changes aren't published" })).getByRole("button", { name: "Discard" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
    expect(deliveryDrafts.get(KEY)).toBeNull();
  });

  it("brings back the product drafts this device kept for the shop", async () => {
    productDraftStore.set(KEY, { [chair.id]: { ...chair, storeId: STORE_ID, title: "Chair, kept" } as never });
    const { store } = setup();
    expect(within(await bar()).getByText("1 product")).toBeInTheDocument();
    expect(store.getState().global.productsToSave[chair.id]).toMatchObject({ title: "Chair, kept" });
  });
});
