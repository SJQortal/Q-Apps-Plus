/**
 * Prices in a currency against the mocked Hub and node (money/fiatPricing.ts):
 * the Shop tab's Prices dialog (rates, prices, Fill from QORT prices, what
 * goes to Hub, the guards), and the product form when the shop uses them.
 * Nothing reaches a real node.
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
import { resetSentCatalogues } from "./sentCatalogues";
import { PRICES_DRAFTS_TEXT } from "./useShopPricing";

vi.mock("../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TkVX")}>
      {label}
    </button>
  ),
}));

let served: Record<string, unknown> = dataContainer;

function stubNode() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const [path] = String(input).split("?");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (path.startsWith("/transactions/unconfirmed")) return ok([]);
      if (path.startsWith("/transactions/unitfee")) return ok("1000000");
      if (path === "/arbitrary/resources/search") return ok([]);
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) return ok(served);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
}

function setup(opts: { index?: Record<string, unknown>; tab?: string; catalogue?: unknown } = {}, handlers: Record<string, QortalHandler> = {}) {
  served = opts.index ?? dataContainer;
  stubNode();
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(served));
  const q = installQortalMock({
    FETCH_QDN_RESOURCE: async () => structuredClone(opts.catalogue ?? catalogue),
    PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
    ...handlers,
  });
  renderWithProviders(
    <Routes>
      <Route path="/product-manager/:store" element={<ProductManager />} />
    </Routes>,
    { store, initialEntries: [`/product-manager/${STORE_ID}?tab=${opts.tab ?? "shop"}`] }
  );
  return { store, q };
}

const priceField = (dialog: HTMLElement, title: string) => within(dialog).getByRole("textbox", { name: `Price of ${title} in USD` });

beforeEach(() => {
  installVisibleIntersectionObserver();
  resetQdnCaches();
  resetPublishedIndexes();
  resetSentCatalogues();
  roomTiming.visibleMs = 5;
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomTiming.visibleMs = 10_000;
});

describe("prices in a currency", () => {
  it("sets rates and prices, fills the rest from QORT prices, and publishes the catalogue and the list", async () => {
    const { store, q } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Price in a currency" }));
    const dialog = await screen.findByRole("dialog", { name: "Prices in a currency" });
    expect(within(dialog).getByRole("combobox", { name: "Currency" })).toHaveValue("USD");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /1 QORT is worth/ }), { target: { value: "0,18" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /1 ARRR is worth/ }), { target: { value: "0.25" } });
    await waitFor(() => expect(priceField(dialog, "Mug")).toBeEnabled());
    fireEvent.change(priceField(dialog, "Mug"), { target: { value: "10" } });
    expect(within(dialog).getByText("= 55.56 QORT · 40 ARRR")).toBeInTheDocument();
    // The poster (0.1 QORT) and the chair (12 QORT) get their QORT price in USD at the rate.
    fireEvent.click(within(dialog).getByRole("button", { name: "Fill from QORT prices" }));
    expect(priceField(dialog, "Poster")).toHaveValue("0.02");
    expect(priceField(dialog, "Chair")).toHaveValue("2.16");
    expect(priceField(dialog, "Mug")).toHaveValue("10");
    expect(within(dialog).getByText("3 of 3 priced in USD")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Publish prices" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(sent.map((r: any) => [r.identifier, r.filename])).toEqual([
      [CATALOGUE_ID, "catalogue.json"],
      [DATA_CONTAINER_ID, "datacontainer.json"],
    ]);
    const cat = decodeData64(sent[0].data64);
    expect(cat.products[mug.id].price).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ARRR", value: 40 },
    ]);
    expect(cat.products[mug.id].fiatPrice).toEqual({ currency: "USD", value: 10, qort: 55.56 });
    expect(cat.products[poster.id].price).toEqual([
      { currency: "qort", value: 0.1111 },
      { currency: "ARRR", value: 0.08 },
    ]);
    expect(cat.products[chair.id].price[0]).toEqual({ currency: "qort", value: 12 });
    const list = decodeData64(sent[1].data64);
    expect(list.fiatPricing).toEqual({ currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: expect.any(Number) });
    expect(list.products[mug.id].priceQort).toBe(55.56);
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Prices published"));
    expect((store.getState().global.dataContainer as any).fiatPricing.rates.QORT).toBe(0.18);
    // The Shop tab shows the rates now.
    expect(await screen.findByText("1 QORT = 0.18 USD")).toBeInTheDocument();
  });

  it("a new rate reprices every product that follows it, and only those", async () => {
    const usd = { currency: "USD", rates: { QORT: 0.18 }, updated: 1 };
    const priced = {
      ...catalogue,
      products: {
        ...catalogue.products,
        [mug.id]: { ...mug, price: [{ currency: "qort", value: 55.56 }], fiatPrice: { currency: "USD", value: 10, qort: 55.56 } },
        // Repriced in QORT elsewhere since: it no longer follows.
        [chair.id]: { ...chair, price: [{ currency: "qort", value: 99 }], fiatPrice: { currency: "USD", value: 2, qort: 11.11 } },
      },
    };
    const index = { ...dataContainer, fiatPricing: usd };
    const { q } = setup({ index, catalogue: priced });
    fireEvent.click(await screen.findByRole("button", { name: "Change rates and prices" }));
    const dialog = await screen.findByRole("dialog", { name: "Prices in USD" });
    await waitFor(() => expect(priceField(dialog, "Mug")).toHaveValue("10.00"));
    expect(priceField(dialog, "Chair")).toHaveValue("");
    expect(within(dialog).getByText("Was 2.00 USD until its QORT price was changed elsewhere.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByRole("textbox", { name: /1 QORT is worth/ }), { target: { value: "0.20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish prices" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    const cat = decodeData64(sent[0].data64);
    expect(cat.products[mug.id].price).toEqual([{ currency: "qort", value: 50 }]);
    // The chair stops following (its stale fiatPrice goes), its QORT price stays; the poster is untouched.
    expect(cat.products[chair.id].price).toEqual([{ currency: "qort", value: 99 }]);
    expect(cat.products[chair.id].fiatPrice).toBeUndefined();
    expect(cat.products[poster.id]).toEqual(priced.products[poster.id]);
  });

  it("reads and sends no catalogue when no product's price changes (new rates for products not priced yet)", async () => {
    const { q } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Price in a currency" }));
    const dialog = await screen.findByRole("dialog", { name: "Prices in a currency" });
    await waitFor(() => expect(priceField(dialog, "Mug")).toBeEnabled());
    const reads = q.callsFor("FETCH_QDN_RESOURCE").length;
    fireEvent.change(within(dialog).getByRole("textbox", { name: /1 QORT is worth/ }), { target: { value: "0.18" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish prices" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(sent.map((r: any) => r.identifier)).toEqual([DATA_CONTAINER_ID]);
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(reads);
  });

  it("closes untouched without asking, and offers Publish only once something is typed", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Price in a currency" }));
    const dialog = await screen.findByRole("dialog", { name: "Prices in a currency" });
    await waitFor(() => expect(priceField(dialog, "Mug")).toBeEnabled());
    expect(within(dialog).getByRole("button", { name: "Publish prices" })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Prices in a currency" })).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Discard your changes?" })).toBeNull();
  });

  it("publishes nothing while the shop has drafts, and says why", async () => {
    const { store, q } = setup();
    store.dispatch(setProductsToSave({ ...mug, title: "Mug (draft)", isUpdate: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Price in a currency" }));
    const dialog = await screen.findByRole("dialog", { name: "Prices in a currency" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /1 QORT is worth/ }), { target: { value: "0.18" } });
    await waitFor(() => expect(priceField(dialog, "Mug")).toBeEnabled());
    fireEvent.change(priceField(dialog, "Mug"), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish prices" }));
    expect(await within(dialog).findByText(PRICES_DRAFTS_TEXT)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("Stop using publishes the list with the pricing stopped, and no catalogue", async () => {
    const index = { ...dataContainer, fiatPricing: { currency: "USD", rates: { QORT: 0.18 }, updated: 1 } };
    const { q } = setup({ index });
    fireEvent.click(await screen.findByRole("button", { name: "Change rates and prices" }));
    const dialog = await screen.findByRole("dialog", { name: "Prices in USD" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Stop using USD" }));
    const ask = await screen.findByRole("dialog", { name: "Stop using USD?" });
    fireEvent.click(within(ask).getByRole("button", { name: "Stop" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(sent.map((r: any) => r.identifier)).toEqual([DATA_CONTAINER_ID]);
    expect(decodeData64(sent[0].data64).fiatPricing).toBeNull();
  });
});

describe("the product form with prices in a currency", () => {
  it("offers the price in USD first; QORT and ARRR follow from it", async () => {
    const index = { ...dataContainer, fiatPricing: { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 1 } };
    const { store } = setup({ index, tab: "products" });
    fireEvent.click(await screen.findByRole("button", { name: "Add product" }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add images" }));
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Title/ }), { target: { value: "Jam" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: /^Category/ }), { target: { value: "Food & Drink" } });
    fireEvent.change(within(dialog).getByRole("textbox", { name: /^Price in USD/ }), { target: { value: "10" } });
    expect(within(dialog).getByText(/^= 55\.56 QORT · 40 ARRR at your rates/)).toBeInTheDocument();
    // Its QORT and ARRR prices come from the USD price: no fields for them.
    expect(within(dialog).queryByRole("textbox", { name: /^Price in QORT/ })).toBeNull();
    expect(within(dialog).queryByRole("textbox", { name: /^Price in Pirate Chain/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add to drafts" }));
    await waitFor(() => expect(Object.keys(store.getState().global.productsToSave)).toHaveLength(1));
    const [added] = Object.values(store.getState().global.productsToSave) as any[];
    expect(added.price).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ARRR", value: 40 },
    ]);
    expect(added.fiatPrice).toEqual({ currency: "USD", value: 10, qort: 55.56 });
  });
});

describe("prices with a product that can't be read", () => {
  it("publishes nothing until every product is read, and says why", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setup({}, { FETCH_QDN_RESOURCE: async () => ({ error: 1401 }) });
      fireEvent.click(await screen.findByRole("button", { name: "Price in a currency" }));
      const dialog = await screen.findByRole("dialog", { name: "Prices in a currency" });
      fireEvent.change(within(dialog).getByRole("textbox", { name: /1 QORT is worth/ }), { target: { value: "0.18" } });
      // The catalogue is asked for again after 2, 4 and 8 s, then counts as failed.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(await within(dialog).findByText(/nothing can be\s+published until they are/)).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "Publish prices" })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
