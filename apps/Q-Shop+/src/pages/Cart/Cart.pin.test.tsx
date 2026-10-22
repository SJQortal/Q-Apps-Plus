/**
 * Pins what the original checkout sends today, before any of it is touched:
 * the coin, the amount (as text), the recipient, the encrypted publish of the
 * order and the seller's mail, the public keys, the identifiers and the order
 * JSON. Written against the upstream Cart component (docs/apps/Q-Shop+.md →
 * Money code). The same expectations are checked again against the new
 * checkout code, so a refactor can't change a payment by accident.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { createAppStore } from "../../state/store";
import { HubThemeProvider } from "../../hub-theme";
import { THEME_STORAGE_KEY, themeConfig } from "../../theme/qplus-theme";
import { addUser } from "../../state/features/authSlice";
import {
  addToHashMapStores,
  setCurrentViewedStore,
  setPreferredCoin,
  setStoreId,
  setStoreOwner,
} from "../../state/features/storeSlice";
import { setCatalogueHashMap } from "../../state/features/globalSlice";
import { setIsOpen, setProductToCart } from "../../state/features/cartSlice";
import { installQortalMock, type QortalMock } from "../../test/qortalMock";
import {
  ARRR_ADDRESS,
  BUYER,
  BUYER_ADDRESS,
  BUYER_PK,
  CATALOGUE_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_ID,
  STORE_TITLE,
  catalogue,
  chair,
  decodeData64,
  mug,
  poster,
  viewedStore,
} from "../../test/fixtures/shop";
import { Cart } from "./Cart";

vi.mock("short-unique-id", () => ({
  default: class {
    constructor(opts?: { length?: number }) {
      return () => (opts?.length === 10 ? "ORDERxxxx1" : "MAILx1");
    }
  },
}));

const NOW = 1761000000000;

function setup(opts: { coin?: "QORT" | "ARRR"; items: { product: any; qty: number }[]; rate?: string }) {
  const store = createAppStore();
  store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
  store.dispatch(setStoreId(STORE_ID));
  store.dispatch(setStoreOwner(SELLER));
  store.dispatch(setCurrentViewedStore(viewedStore));
  store.dispatch(addToHashMapStores({ ...viewedStore, owner: SELLER, isValid: true }));
  store.dispatch(setCatalogueHashMap({ ...catalogue, user: SELLER, isValid: true }));
  for (const { product, qty } of opts.items) {
    for (let i = 0; i < qty; i++) {
      store.dispatch(
        setProductToCart({ productId: product.id, catalogueId: CATALOGUE_ID, storeId: STORE_ID, storeOwner: SELLER })
      );
    }
  }
  store.dispatch(setPreferredCoin(opts.coin ?? "QORT"));
  store.dispatch(setIsOpen(true));

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).startsWith("/crosschain/price/PIRATECHAIN")) {
        return { ok: true, status: 200, text: async () => opts.rate ?? "0", json: async () => Number(opts.rate) };
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );

  const q: QortalMock = installQortalMock({
    GET_NAME_DATA: async (p) => {
      expect(p.name).toBe(SELLER);
      return { name: SELLER, owner: SELLER_ADDRESS };
    },
    GET_ACCOUNT_DATA: async (p) => {
      expect(p.address).toBe(SELLER_ADDRESS);
      return { address: SELLER_ADDRESS, publicKey: SELLER_PK };
    },
    SEND_COIN: async (p) => (p.coin === "QORT" ? { signature: "PAYMENTSIG" } : "arrr-txid"),
    PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
  });

  render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <Cart />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  return { store, q };
}

async function purchaseDigital() {
  fireEvent.click(await screen.findByRole("button", { name: "Purchase" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
}

function mailIdentifier() {
  return `qortal_qmail_${SELLER.slice(0, 20)}_${SELLER_ADDRESS.slice(-6)}_mail_MAILx1`;
}

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checkout today (pinned)", () => {
  it("pays a QORT digital order to the seller's address and publishes the order and mail encrypted", async () => {
    const { q, store } = setup({ items: [{ product: mug, qty: 2 }, { product: poster, qty: 1 }] });
    await purchaseDigital();
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));

    // Seller lookup, then exactly one payment.
    expect(q.calls.map((c) => c.action).slice(0, 3)).toEqual(["GET_NAME_DATA", "GET_ACCOUNT_DATA", "SEND_COIN"]);
    expect(q.callsFor("SEND_COIN")).toEqual([
      { action: "SEND_COIN", coin: "QORT", destinationAddress: SELLER_ADDRESS, amount: "3.10000000" },
    ]);

    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(pub.encrypt).toBe(true);
    expect(pub.publicKeys).toEqual([SELLER_PK, BUYER_PK]);
    expect(pub.resources).toHaveLength(2);
    const [orderRes, mailRes] = pub.resources;
    expect(orderRes).toMatchObject({
      action: "PUBLISH_QDN_RESOURCE",
      identifier: `q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`,
      name: BUYER,
      service: "DOCUMENT_PRIVATE",
    });
    expect(Object.keys(orderRes).sort()).toEqual(["action", "data64", "identifier", "name", "service"]);
    expect(mailRes).toMatchObject({
      action: "PUBLISH_QDN_RESOURCE",
      name: BUYER,
      service: "MAIL_PRIVATE",
      identifier: mailIdentifier(),
    });

    const order = decodeData64(orderRes.data64);
    expect(order).toEqual({
      created: NOW,
      version: 1,
      details: {
        totalPrice: "3.10000000",
        [mug.id]: { product: mug, catalogueId: CATALOGUE_ID, quantity: 2, pricePerUnit: 1.5, totalProductPrice: 3 },
        [poster.id]: { product: poster, catalogueId: CATALOGUE_ID, quantity: 1, pricePerUnit: 0.1, totalProductPrice: 0.1 },
      },
      storeName: STORE_TITLE,
      sellerName: SELLER,
      delivery: {
        customerName: BUYER,
        shippingAddress: { streetAddress: "", city: "", region: "", country: "", zipCode: "", deliveryNote: "" },
      },
      payment: { total: "3.10000000", currency: "QORT", transactionSignature: "PAYMENTSIG", arrrAddressUsed: "" },
      communicationMethod: ["Q-Mail"],
    });
    // Key order of the details as the original writes them: total first, then the cart's order.
    expect(Object.keys(order.details)).toEqual(["totalPrice", mug.id, poster.id]);

    const mail = decodeData64(mailRes.data64);
    expect(mail).toMatchObject({
      title: `Order for shop ${SHORT_STORE_ID} from ${BUYER}`,
      subject: "New order",
      createdAt: NOW,
      version: 1,
      attachments: [],
      textContent: "",
      generalData: { thread: [] },
      recipient: SELLER,
    });
    expect(mail.htmlContent).toContain("You have sold a product for your shop!");
    // Typed text is HTML-escaped in the mail since night 1 (a fix: the original
    // wrote it raw); it reads the same in Q-Mail.
    expect(mail.htmlContent).toContain("Shop: Seller&#39;s Shop");
    expect(mail.htmlContent).toContain("Product: Mug");
    expect(mail.htmlContent).toContain("x 2");
    // Digital orders carry no delivery block.
    expect(mail.htmlContent).not.toContain("Delivery Information");

    // Success empties this store's cart.
    await waitFor(() => expect(store.getState().cart.carts[STORE_ID]).toBeUndefined());
  });

  it("pays in ARRR with the product's own ARRR price, to the store's trimmed ARRR address", async () => {
    const { q } = setup({ coin: "ARRR", items: [{ product: poster, qty: 3 }], rate: "250000000" });
    await purchaseDigital();
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));

    expect(q.callsFor("SEND_COIN")).toEqual([
      { action: "SEND_COIN", coin: "ARRR", destinationAddress: ARRR_ADDRESS, amount: "0.75000000" },
    ]);
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.details[poster.id]).toEqual({
      product: poster,
      catalogueId: CATALOGUE_ID,
      quantity: 3,
      pricePerUnit: 0.25,
      totalProductPrice: 0.75,
    });
    // ARRR payments keep no signature; the address paid is recorded instead.
    expect(order.payment).toEqual({
      total: "0.75000000",
      currency: "ARRR",
      transactionSignature: null,
      arrrAddressUsed: ARRR_ADDRESS,
    });
  });

  it("converts a QORT-only price to ARRR with the node's rate (raw float per unit, total rounded to 8 places)", async () => {
    // inverse=true price 0.3 ARRR per QORT; 1.5 * 0.3 = 0.44999999999999996 in floating point.
    const { q } = setup({ coin: "ARRR", items: [{ product: mug, qty: 3 }], rate: "30000000" });
    await waitFor(() => expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(0));
    await act(async () => {});
    await purchaseDigital();
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));

    expect((globalThis.fetch as any).mock.calls[0][0]).toBe("/crosschain/price/PIRATECHAIN?maxtrades=10&inverse=true");
    expect(q.callsFor("SEND_COIN")).toEqual([
      { action: "SEND_COIN", coin: "ARRR", destinationAddress: ARRR_ADDRESS, amount: "1.35000000" },
    ]);
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.details[mug.id].pricePerUnit).toBe(1.5 * 0.3);
    expect(order.details[mug.id].totalProductPrice).toBe(1.5 * 0.3 * 3);
    expect(order.details.totalPrice).toBe("1.35000000");
  });

  it("asks for the delivery address on physical orders and writes `state` for the United States", async () => {
    const { q } = setup({ items: [{ product: chair, qty: 1 }] });
    fireEvent.click(await screen.findByRole("button", { name: "Checkout" }));

    const type = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type(/Customer Name/, "Ann Buyer");
    type(/Street Address/, "1 Main St");
    type(/^City/, "Springfield");
    // Country, then State (both MUI selects).
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: "United States" }));
    fireEvent.mouseDown(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "Oregon" }));
    type(/Zip Code/, "97001");
    type(/Delivery Note/, "Leave at the door");
    fireEvent.click(screen.getByRole("button", { name: "Purchase" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(q.callsFor("SEND_COIN")[0]).toEqual({
      action: "SEND_COIN",
      coin: "QORT",
      destinationAddress: SELLER_ADDRESS,
      amount: "12.00000000",
    });
    const [orderRes, mailRes] = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    expect(decodeData64(orderRes.data64).delivery).toEqual({
      customerName: "Ann Buyer",
      shippingAddress: {
        streetAddress: "1 Main St",
        city: "Springfield",
        state: "Oregon",
        country: "United States",
        zipCode: "97001",
        deliveryNote: "Leave at the door",
      },
    });
    const html = decodeData64(mailRes.data64).htmlContent;
    expect(html).toContain("Delivery Information");
    expect(html).toContain(`Qortal Username: ${BUYER}`);
    expect(html).toContain("State: Oregon");
  });
});
