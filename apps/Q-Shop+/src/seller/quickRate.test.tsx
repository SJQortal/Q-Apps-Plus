/**
 * The header's QORT rate (seller/QuickRateDialog.tsx) against the mocked Hub
 * and node: shown beside Manage Shop only to a seller whose shop prices in a
 * currency; a new rate reprices the products that follow the currency, after
 * the same review as Shop → Prices, in one publish. Nothing reaches a real node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer, setProductsToSave } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { installVisibleIntersectionObserver } from "../test/mockNode";
import { CATALOGUE_ID, DATA_CONTAINER_ID, SELLER, SELLER_ADDRESS, SELLER_PK, catalogue, dataContainer, decodeData64, mug, viewedStore } from "../test/fixtures/shop";
import NavBar from "../components/layout/Navbar/Navbar";
import { resetQdnCaches } from "../qdn/search";
import { roomTiming } from "../qdn/publishBatches";
import { resetPublishedIndexes } from "./productIndex";
import { resetSentCatalogues } from "./sentCatalogues";
import { PRICES_DRAFTS_TEXT } from "./useShopPricing";

const USD = { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 1 };
const priced = {
  ...catalogue,
  products: {
    ...catalogue.products,
    [mug.id]: { ...mug, price: [{ currency: "qort", value: 55.56 }, { currency: "ARRR", value: 40 }], fiatPrice: { currency: "USD", value: 10, qort: 55.56 } },
  },
};

function setup(index: Record<string, unknown>, owner = SELLER) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const [path] = String(input).split("?");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (path.startsWith("/transactions/unconfirmed")) return ok([]);
      if (path.startsWith("/transactions/unitfee")) return ok("1000000");
      if (path === "/arbitrary/resources/search") return ok([]);
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DATA_CONTAINER_ID}`) return ok(index);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner }));
  store.dispatch(setDataContainer(index));
  const q = installQortalMock({
    FETCH_QDN_RESOURCE: async () => structuredClone(priced),
    PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
  });
  renderWithProviders(<NavBar />, { store, initialEntries: ["/"] });
  return { store, q };
}

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

describe("the QORT rate beside Manage Shop", () => {
  it("shows only to the seller of a shop that prices in a currency", () => {
    setup({ ...dataContainer, fiatPricing: USD });
    expect(screen.getByRole("button", { name: "QORT rate: 1 QORT = 0.18 USD. Change it" })).toHaveTextContent("1 QORT = 0.18 USD");
  });

  it("isn't there without prices in a currency", () => {
    setup(dataContainer);
    expect(screen.queryByRole("button", { name: /QORT rate/ })).not.toBeInTheDocument();
  });

  it("isn't there for a shop of another name", () => {
    setup({ ...dataContainer, fiatPricing: USD }, "Someone Else");
    expect(screen.queryByRole("button", { name: /QORT rate/ })).not.toBeInTheDocument();
  });

  it("waits for the products in Ready to publish, as Shop → Prices does", async () => {
    const { store, q } = setup({ ...dataContainer, fiatPricing: USD });
    store.dispatch(setProductsToSave({ ...mug, title: "Mug (draft)", isUpdate: true }));
    fireEvent.click(screen.getByRole("button", { name: /QORT rate/ }));
    const dialog = await screen.findByRole("dialog", { name: "QORT rate" });
    await within(dialog).findByText("1 product is priced in USD.");
    fireEvent.change(within(dialog).getByRole("textbox", { name: /1 QORT is worth/ }), { target: { value: "0.2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update prices" }));
    expect(await within(dialog).findByText(PRICES_DRAFTS_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Publish new prices?" })).not.toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("changes the rate: the products priced in USD get their new QORT prices, after the review, in one publish", async () => {
    const { store, q } = setup({ ...dataContainer, fiatPricing: USD });
    fireEvent.click(screen.getByRole("button", { name: /QORT rate/ }));
    const dialog = await screen.findByRole("dialog", { name: "QORT rate" });
    const field = within(dialog).getByRole("textbox", { name: /1 QORT is worth/ });
    expect(field).toHaveValue("0.18");
    expect(await within(dialog).findByText("1 product is priced in USD.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Update prices" })).toBeDisabled();
    fireEvent.change(field, { target: { value: "0,2" } });
    expect(within(dialog).getByText("For example Mug: 10.00 USD = 50 QORT")).toBeInTheDocument();
    fireEvent.keyDown(field, { key: "Enter" });

    const review = await screen.findByRole("dialog", { name: "Publish new prices?" });
    expect(within(review).getByText(/1 product gets a new price, at 1 QORT = 0.2 USD and 1 ARRR = 0.25 USD/)).toBeInTheDocument();
    expect(within(within(review).getByRole("list", { name: "Price changes" })).getByRole("listitem")).toHaveTextContent("Mug55.56 QORT → 50.00 QORT");
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    fireEvent.click(within(review).getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const sent = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(sent.map((r: any) => r.identifier)).toEqual([CATALOGUE_ID, DATA_CONTAINER_ID]);
    const cat = decodeData64(sent[0].data64);
    // The mug's QORT price follows the rate; its ARRR price keeps the ARRR rate.
    expect(cat.products[mug.id].price).toEqual([
      { currency: "qort", value: 50 },
      { currency: "ARRR", value: 40 },
    ]);
    expect(cat.products[mug.id].fiatPrice).toEqual({ currency: "USD", value: 10, qort: 50 });
    const list = decodeData64(sent[1].data64);
    expect(list.fiatPricing).toEqual({ currency: "USD", rates: { QORT: 0.2, ARRR: 0.25 }, updated: expect.any(Number) });
    expect(list.products[mug.id].priceQort).toBe(50);
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Prices published"));
    expect(await screen.findByRole("button", { name: "QORT rate: 1 QORT = 0.2 USD. Change it" })).toBeInTheDocument();
  });
});
