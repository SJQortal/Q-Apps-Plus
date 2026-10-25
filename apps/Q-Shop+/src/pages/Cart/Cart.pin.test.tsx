/**
 * Pins what the original checkout sends, before any of it is touched:
 * the coin, the amount (as text), the recipient, the encrypted publish of the
 * order and the seller's mail, the public keys, the identifiers and the order
 * JSON. Written against the upstream Cart component (docs/apps/Q-Shop+.md →
 * Money code), and ported unchanged to the cart page and checkout dialog that
 * replaced it: only the clicks that reach Pay differ, never an expectation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../../state/store";
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
import { renderWithProviders } from "../../test/renderWithProviders";
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
import { CartPage } from "./CartPage";
import { resourcePath } from "../../qdn/search";
import { dataContainerIdentifier, deliveryIdentifier } from "../../qdn/identifiers";

vi.mock("short-unique-id", () => ({
  default: class {
    constructor(opts?: { length?: number }) {
      return () => (opts?.length === 10 ? "ORDERxxxx1" : "MAILx1");
    }
  },
}));

const NOW = 1761000000000;
const DELIVERY_ID = deliveryIdentifier(SHORT_STORE_ID);

function setup(opts: {
  coin?: "QORT" | "ARRR";
  items: { product: any; qty: number }[];
  rate?: string;
  shop?: Record<string, unknown>;
  /** The shop's delivery prices (delivery/model.ts), and its product list when they're in a currency. */
  delivery?: { doc: unknown; productList?: unknown };
  /** Holds the delivery prices' search until it resolves. */
  deliveryGate?: Promise<void>;
}) {
  const store = createAppStore();
  store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
  store.dispatch(setStoreId(STORE_ID));
  store.dispatch(setStoreOwner(SELLER));
  store.dispatch(setCurrentViewedStore(viewedStore));
  store.dispatch(addToHashMapStores({ ...viewedStore, ...opts.shop, owner: SELLER, isValid: true }));
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
      // The + app's delivery prices (delivery/deliveryDoc.ts): none unless the test gives some, as in the original.
      const json = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (String(url).startsWith("/arbitrary/resources/search?") && String(url).includes(`identifier=${DELIVERY_ID}`)) {
        await opts.deliveryGate;
        return json(opts.delivery ? [{ name: SELLER, service: "DOCUMENT", identifier: DELIVERY_ID }] : []);
      }
      if (opts.delivery && url === resourcePath("DOCUMENT", SELLER, DELIVERY_ID)) return json(opts.delivery.doc);
      if (opts.delivery?.productList && url === resourcePath("DOCUMENT", SELLER, dataContainerIdentifier(STORE_ID))) {
        return json(opts.delivery.productList);
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

  renderWithProviders(<CartPage />, { store, initialEntries: ["/cart"] });
  return { store, q };
}

/** Presses a dialog button once it is enabled (prices may wait for the coin's rate). */
async function press(name: string | RegExp) {
  const dialog = await screen.findByRole("dialog");
  const button = await within(dialog).findByRole("button", { name });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

async function openCheckout() {
  const button = await screen.findByRole("button", { name: `Check out ${STORE_TITLE}` });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

/** Digital orders: Check out → Review → Confirm → Pay (the original: Purchase → Confirm). */
async function purchaseDigital() {
  await openCheckout();
  await press("Continue");
  await press(/^Pay /);
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

describe("checkout (pinned)", () => {
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
      // Q-Shop+ (Simon, 2026-10-23): the subject names the shop and the buyer; the original's was "New order".
      subject: `New order at ${STORE_TITLE} from ${BUYER}`,
      createdAt: NOW,
      version: 1,
      attachments: [],
      textContent: "",
      generalData: { thread: [] },
      recipient: SELLER,
    });
    // Q-Shop+'s mail (Simon, 2026-10-23: "nicer, more easy to read, professional"): who, when, the items
    // with prices and the total, the payment, and the delivery. Typed text is HTML-escaped (night 1).
    expect(mail.htmlContent).toContain("New order · Seller&#39;s Shop");
    expect(mail.htmlContent).toContain(`${BUYER} ordered 3 items`);
    expect(mail.htmlContent).toContain("Order ORDERxxxx1");
    expect(mail.htmlContent).toMatch(/<strong>Mug<\/strong><\/td>\s*<td[^>]*>2<\/td>\s*<td[^>]*>1\.50 QORT<\/td>\s*<td[^>]*>3\.00 QORT<\/td>/);
    expect(mail.htmlContent).toContain("<strong>3.10 QORT</strong>");
    expect(mail.htmlContent).toContain("PAYMENTSIG");
    // Digital orders carry no address.
    expect(mail.htmlContent).toContain("Digital order: nothing to ship.");
    expect(mail.htmlContent).not.toContain("Ship to");

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
    await openCheckout();
    await press("Continue");

    const type = (label: RegExp, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    // The form loads on demand (digital orders never fetch it).
    await screen.findByLabelText(/Customer name/i);
    type(/Customer name/i, "Ann Buyer");
    type(/Street address/i, "1 Main St");
    type(/^City/, "Springfield");
    // Country, then State (both lists of the original's values).
    fireEvent.change(screen.getByRole("combobox", { name: /Country/ }), { target: { value: "United States" } });
    fireEvent.click(await screen.findByRole("option", { name: "United States" }));
    fireEvent.change(await screen.findByRole("combobox", { name: /State/ }), { target: { value: "Oregon" } });
    fireEvent.click(await screen.findByRole("option", { name: "Oregon" }));
    type(/Zip code/i, "97001");
    type(/Delivery note/i, "Leave at the door");
    await press("Continue");
    await press(/^Pay /);

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
    expect(html).toContain("Ship to");
    expect(html).toContain(`Qortal name: <strong>${BUYER}</strong>`);
    expect(html).toContain("Ann Buyer<br>1 Main St<br>Springfield, Oregon 97001<br>United States");
    expect(html).toContain("<strong>Note from the buyer:</strong> Leave at the door");
  });

  /** The delivery step filled in for Oregon, United States. */
  async function deliverToOregon() {
    const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await screen.findByLabelText(/Customer name/i);
    type(/Customer name/i, "Ann Buyer");
    type(/Street address/i, "1 Main St");
    type(/^City/, "Springfield");
    fireEvent.change(screen.getByRole("combobox", { name: /Country/ }), { target: { value: "United States" } });
    fireEvent.click(await screen.findByRole("option", { name: "United States" }));
    fireEvent.change(await screen.findByRole("combobox", { name: /State/ }), { target: { value: "Oregon" } });
    fireEvent.click(await screen.findByRole("option", { name: "Oregon" }));
    type(/Zip code/i, "97001");
  }

  const zone = (over: Record<string, unknown>) => ({ id: "zone1", countries: ["US"], first: 3, ...over });

  it("adds the shop's delivery fee for the address as one more line of the order, paid with it", async () => {
    const doc = { v: 1, storeId: STORE_ID, currency: "QORT", general: { zones: [zone({ states: ["OR"], extra: 1 })] }, profiles: [], updated: 1 };
    const { q } = setup({ items: [{ product: chair, qty: 2 }], delivery: { doc } });
    await openCheckout();
    await press("Continue");
    await deliverToOregon();
    await press("Continue");
    // Confirm names the fee: 3 for the first chair, 1 for the second.
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Delivery to United States (Oregon)")).toBeInTheDocument();
    await press(/^Pay /);

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(q.callsFor("SEND_COIN")[0]).toEqual({ action: "SEND_COIN", coin: "QORT", destinationAddress: SELLER_ADDRESS, amount: "28.00000000" });
    const [orderRes, mailRes] = (q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources;
    const order = decodeData64(orderRes.data64);
    // The chairs as before, then the fee, priced like a product so the original shows it as a line of the total.
    expect(Object.keys(order.details)).toEqual(["totalPrice", chair.id, "q-store-delivery"]);
    expect(order.details[chair.id].totalProductPrice).toBe(24);
    expect(order.details["q-store-delivery"]).toEqual({
      product: {
        id: "q-store-delivery",
        title: "Delivery to United States (Oregon)",
        type: "delivery",
        price: [{ currency: "qort", value: 4 }],
        delivery: { currency: "QORT", value: 4, parts: [{ profile: "Delivery", zone: "", items: 2, fee: 4 }] },
      },
      catalogueId: "",
      quantity: 1,
      pricePerUnit: 4,
      totalProductPrice: 4,
    });
    expect(order.details.totalPrice).toBe("28.00000000");
    const html = decodeData64(mailRes.data64).htmlContent;
    expect(html).toContain("ordered 2 items");
    expect(html).toContain("<strong>Delivery to United States (Oregon)</strong>");
  });

  it("lets the buyer pick the shop's delivery option at Confirm, and tells the seller which (+ app)", async () => {
    const doc = {
      v: 1,
      storeId: STORE_ID,
      currency: "QORT",
      general: { zones: [zone({ rates: { exp: { first: 9 }, pick: { first: 0 } } })] },
      profiles: [],
      updated: 1,
      options: [
        { id: "exp", name: "Express", note: "1–3 days" },
        { id: "pick", name: "Local pickup", note: "Portland, Saturdays" },
      ],
    };
    const { q } = setup({ items: [{ product: chair, qty: 1 }], delivery: { doc } });
    await openCheckout();
    await press("Continue");
    await deliverToOregon();
    await press("Continue");
    const dialog = await screen.findByRole("dialog");
    const options = await within(dialog).findByRole("radiogroup", { name: "Delivery" });
    expect(within(options).getByRole("radio", { name: /Standard/ })).toBeChecked();
    expect(within(dialog).getByText("Delivery to United States (Oregon), Standard")).toBeInTheDocument();
    fireEvent.click(within(options).getByRole("radio", { name: /Express/ }));
    expect(await within(dialog).findByText("Delivery to United States (Oregon), Express")).toBeInTheDocument();
    await press(/^Pay 21\.00 QORT$/);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(q.callsFor("SEND_COIN")[0]).toMatchObject({ amount: "21.00000000" });
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.details["q-store-delivery"].product).toMatchObject({ title: "Delivery to United States (Oregon), Express", delivery: { value: 9, option: { id: "exp", name: "Express" } } });
    expect(order.delivery.shippingAddress.deliveryNote).toBe("Delivery: Express.");
  });

  it("a free delivery option adds no line, and the seller still reads it in the order's note (+ app)", async () => {
    const doc = { v: 1, storeId: STORE_ID, currency: "QORT", general: { zones: [zone({ rates: { pick: { first: 0 } } })] }, profiles: [], updated: 1, options: [{ id: "pick", name: "Local pickup" }] };
    const { q } = setup({ items: [{ product: chair, qty: 1 }], delivery: { doc } });
    await openCheckout();
    await press("Continue");
    await deliverToOregon();
    await press("Continue");
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(await within(dialog).findByRole("radiogroup", { name: "Delivery" })).getByRole("radio", { name: /Local pickup/ }));
    expect(await within(dialog).findByText("Delivery, Local pickup")).toBeInTheDocument();
    await press(/^Pay 12\.00 QORT$/);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(Object.keys(order.details)).toEqual(["totalPrice", chair.id]);
    expect(order.delivery.shippingAddress.deliveryNote).toBe("Delivery: Local pickup.");
  });

  it("prices a delivery fee set in USD in QORT from the shop's rates", async () => {
    const doc = { v: 1, storeId: STORE_ID, currency: "USD", general: { zones: [zone({ first: 7 })] }, profiles: [], updated: 1 };
    const productList = { storeId: STORE_ID, products: {}, fiatPricing: { currency: "USD", rates: { QORT: 0.18 }, updated: 1 } };
    const { q } = setup({ items: [{ product: chair, qty: 1 }], delivery: { doc, productList } });
    await openCheckout();
    await press("Continue");
    await deliverToOregon();
    await press("Continue");
    expect(await within(await screen.findByRole("dialog")).findByText("$7.00")).toBeInTheDocument();
    await press(/^Pay /);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    // 7 USD at 0.18 USD a QORT: 38.89 QORT, on top of the chair's 12.
    expect(q.callsFor("SEND_COIN")[0]).toMatchObject({ coin: "QORT", amount: "50.89000000" });
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.details["q-store-delivery"].product.delivery).toMatchObject({ currency: "USD", value: 7, qort: 38.89 });
  });

  it("stops at the address when the shop doesn't deliver there", async () => {
    const doc = { v: 1, storeId: STORE_ID, currency: "QORT", general: { zones: [zone({ countries: ["PL"] })] }, profiles: [], updated: 1 };
    const { q } = setup({ items: [{ product: chair, qty: 1 }], delivery: { doc } });
    await openCheckout();
    await press("Continue");
    await deliverToOregon();
    await press("Continue");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      `${STORE_TITLE} doesn't deliver ${chair.title} to Oregon, United States. Remove it from your cart, pick another address, or ask the seller.`
    );
    expect(screen.queryByRole("button", { name: /^Pay / })).not.toBeInTheDocument();
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
  });

  it("drops delivery prices worked out for an address the buyer changed meanwhile", async () => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const doc = { v: 1, storeId: STORE_ID, currency: "QORT", general: { zones: [zone({ first: 3 })] }, profiles: [], updated: 1 };
    setup({ items: [{ product: chair, qty: 1 }], delivery: { doc }, deliveryGate: gate });
    await openCheckout();
    await press("Continue");
    await deliverToOregon();
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("button", { name: "Working out delivery…" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Zip code/i), { target: { value: "97002" } });
    await act(async () => open());
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled());
    expect(screen.queryByText("Confirm and pay")).not.toBeInTheDocument();
    await press("Continue");
    expect(await screen.findByText("Confirm and pay")).toBeInTheDocument();
  });

  it("stops a physical order to a US state the shop doesn't ship to, and lets one it does through", async () => {
    const { q } = setup({
      items: [{ product: chair, qty: 1 }],
      shop: { shippingCountries: ["US"], shippingStates: ["OR", "WA"], shipsTo: "the United States: Oregon and Washington" },
    });
    await openCheckout();
    await press("Continue");
    await screen.findByLabelText(/Customer name/i);
    fireEvent.change(screen.getByRole("combobox", { name: /Country/ }), { target: { value: "United States" } });
    fireEvent.click(await screen.findByRole("option", { name: "United States" }));
    fireEvent.change(await screen.findByRole("combobox", { name: /State/ }), { target: { value: "Alaska" } });
    fireEvent.click(await screen.findByRole("option", { name: "Alaska" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(`${STORE_TITLE} doesn't ship to Alaska, United States: it ships to the United States: Oregon and Washington.`);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue" })).toBeDisabled();
    const state = screen.getByRole("combobox", { name: /State/ });
    fireEvent.change(state, { target: { value: "" } });
    fireEvent.change(state, { target: { value: "Oreg" } });
    fireEvent.click(await screen.findByRole("option", { name: "Oregon" }));
    await waitFor(() => expect(screen.queryByText(/doesn't ship to/)).toBeNull());
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
  });

  it("stops a physical order to a country the shop doesn't ship to, before anything is paid (constants/shipping.ts)", async () => {
    const { q } = setup({ items: [{ product: chair, qty: 1 }], shop: { shippingCountries: ["IS", "NO"], shipsTo: "Iceland and Norway" } });
    await openCheckout();
    await press("Continue");
    await screen.findByLabelText(/Customer name/i);
    fireEvent.change(screen.getByRole("combobox", { name: /Country/ }), { target: { value: "Germany" } });
    fireEvent.click(await screen.findByRole("option", { name: "Germany" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(`${STORE_TITLE} doesn't ship to Germany: it ships to Iceland and Norway.`);
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue" })).toBeDisabled();
    const country = screen.getByRole("combobox", { name: /Country/ });
    fireEvent.change(country, { target: { value: "" } });
    fireEvent.change(country, { target: { value: "Icel" } });
    fireEvent.click(await screen.findByRole("option", { name: "Iceland" }));
    await waitFor(() => expect(screen.queryByText(/doesn't ship to/)).toBeNull());
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
  });
});
