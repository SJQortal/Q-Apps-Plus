/**
 * The cart page's "Orders to finish": orders paid (or maybe paid) but not
 * on QDN yet. Every action finishes the order with the payment already
 * made: no test here may see a second SEND_COIN or TRANSFER_ASSET.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { cartFor, setProductToCart } from "../../state/features/cartSlice";
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
  chair,
  decodeData64,
  mug,
  poster,
} from "../../test/fixtures/shop";
import { buildOrderDetails } from "../../money/order";
import { orderMailIdentifier } from "../../qdn/identifiers";
import { listPendingOrders, resetPendingOrders, savePendingOrder, type PendingOrder } from "../../money/pendingOrders";
import { CartPage } from "./CartPage";
import { PendingOrderCard } from "./PendingOrders";

const NOW = 1761000000000;
const ORDER_ID = `q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`;
const MAIL_ID = orderMailIdentifier(SELLER, SELLER_ADDRESS, "MAILx1");

function pendingOrder(over: Partial<PendingOrder> = {}): PendingOrder {
  const lines = over.isDigital === false
    ? [{ productId: chair.id, catalogueId: CATALOGUE_ID, quantity: 1, product: chair }]
    : [
        { productId: mug.id, catalogueId: CATALOGUE_ID, quantity: 2, product: mug },
        { productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 1, product: poster },
      ];
  const coin = over.coin ?? "QORT";
  const details = buildOrderDetails(lines, coin, coin === "ARRR" ? 2 : null);
  return {
    version: 1,
    orderUid: "ORDERxxxx1",
    mailUid: "MAILx1",
    state: "paid",
    created: NOW,
    updated: NOW,
    buyer: { name: BUYER, address: BUYER_ADDRESS, publicKey: BUYER_PK },
    store: { id: STORE_ID, shortStoreId: SHORT_STORE_ID, title: STORE_TITLE, owner: SELLER },
    seller: { address: SELLER_ADDRESS, publicKey: SELLER_PK },
    coin,
    currencyLabel: coin,
    recipient: SELLER_ADDRESS,
    amount: details.totalPrice,
    isDigital: true,
    details,
    payment: { total: details.totalPrice, currency: "QORT", transactionSignature: "PAYSIG", arrrAddressUsed: "" },
    ...over,
  };
}

let q: QortalMock;
let transactions: unknown[] = [];
let orderOnQdn = false;

function render() {
  const store = createAppStore();
  store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
  renderWithProviders(<CartPage />, { store, initialEntries: ["/cart"] });
  return store;
}

function fetchUrls(): string[] {
  return (globalThis.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
}

function published() {
  const call = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
  return { call, order: decodeData64(call.resources[0].data64), mail: decodeData64(call.resources[1].data64) };
}

beforeEach(() => {
  transactions = [];
  orderOnQdn = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.startsWith("/arbitrary/resources/search")) {
        const rows = orderOnQdn
          ? [
              { name: BUYER, service: "DOCUMENT_PRIVATE", identifier: ORDER_ID },
              { name: BUYER, service: "MAIL_PRIVATE", identifier: MAIL_ID },
            ]
          : [];
        return { ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) };
      }
      if (u.startsWith("/transactions/search")) {
        return { ok: true, status: 200, json: async () => transactions, text: async () => JSON.stringify(transactions) };
      }
      throw new Error(`unexpected fetch ${u}`);
    })
  );
  q = installQortalMock({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetPendingOrders();
});

describe("orders to finish", () => {
  it("finishes a paid order without paying again: checks QDN, then publishes the same order", async () => {
    savePendingOrder(pendingOrder());
    render();
    expect(await screen.findByText("Payment sent — the order isn't recorded yet")).toBeInTheDocument();
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish order" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));

    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
    expect(q.callsFor("TRANSFER_ASSET")).toHaveLength(0);
    // Looked for the order on QDN first (a timed-out publish may have landed).
    expect(fetchUrls().some((u) => u.includes(`identifier=${ORDER_ID}`))).toBe(true);
    const { call, order } = published();
    expect(call.encrypt).toBe(true);
    expect(call.publicKeys).toEqual([SELLER_PK, BUYER_PK]);
    expect(call.resources[0].identifier).toBe(ORDER_ID);
    expect(order.payment).toEqual({ total: "3.10000000", currency: "QORT", transactionSignature: "PAYSIG", arrrAddressUsed: "" });
    expect(order.delivery.customerName).toBe(BUYER);

    expect(await screen.findByText(`Order recorded for ${STORE_TITLE}.`)).toBeInTheDocument();
    expect(screen.queryByText("Orders to finish")).not.toBeInTheDocument();
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("doesn't publish again when the order is on QDN already", async () => {
    savePendingOrder(pendingOrder());
    orderOnQdn = true;
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Finish order" }));
    expect(await screen.findByText(`Order recorded for ${STORE_TITLE}.`)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("sends only the seller's Q-Mail when the order itself was recorded", async () => {
    savePendingOrder(
      pendingOrder({
        published: ["order"],
        lastError: "Your order was recorded, but the seller's Q-Mail about it wasn't sent. Finish the order to send it; you won't pay again.",
      })
    );
    render();
    expect(await screen.findByText(/the seller's Q-Mail about it wasn't sent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish order" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    const call = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(call.resources.map((r: any) => [r.service, r.identifier])).toEqual([["MAIL_PRIVATE", MAIL_ID]]);
    expect(decodeData64(call.resources[0].data64).recipient).toBe(SELLER);
    expect(await screen.findByText(`Order recorded for ${STORE_TITLE}.`)).toBeInTheDocument();
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("asks for the address again after a reload (addresses are never stored), then records it", async () => {
    savePendingOrder(pendingOrder({ isDigital: false }));
    resetPendingOrders(); // a reload: the order comes back from storage, the address doesn't
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Finish order" }));
    const dialog = await screen.findByRole("dialog", { name: "Delivery address" });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);

    // Nothing typed yet: says what's missing and publishes nothing.
    await within(dialog).findByLabelText(/Street address/i);
    fireEvent.change(within(dialog).getByLabelText(/Customer name/i), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record order" }));
    expect(await within(dialog).findByText("Enter the name to deliver to")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose a country")).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);

    const type = (label: RegExp, value: string) => fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    type(/Customer name/i, "Ann Buyer");
    type(/Street address/i, "5 Rua Augusta");
    type(/^City/, "Lisbon");
    fireEvent.change(within(dialog).getByRole("combobox", { name: /Country/ }), { target: { value: "Portugal" } });
    fireEvent.click(await screen.findByRole("option", { name: "Portugal" }));
    type(/^Region/, "Lisboa");
    type(/Zip code/i, "1100-048");
    fireEvent.click(within(dialog).getByRole("button", { name: "Record order" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
    expect(published().order.delivery).toEqual({
      customerName: "Ann Buyer",
      shippingAddress: {
        streetAddress: "5 Rua Augusta",
        city: "Lisbon",
        region: "Lisboa",
        country: "Portugal",
        zipCode: "1100-048",
        deliveryNote: "",
      },
    });
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("shows an order another card is recording as recording, and offers no second Finish", async () => {
    const order = pendingOrder();
    savePendingOrder(order);
    let answer: (value: unknown) => void = () => {};
    q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise((resolve) => (answer = resolve)));
    const onRecorded = vi.fn();
    // Two cards for one order: the checkout dialog's and the cart page's.
    renderWithProviders(
      <>
        <PendingOrderCard order={order} onRecorded={onRecorded} />
        <PendingOrderCard order={order} onRecorded={onRecorded} />
      </>
    );
    const [first, second] = screen.getAllByRole("button", { name: "Finish order" });
    fireEvent.click(first);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    // Both cards say it is being recorded; neither offers Finish meanwhile.
    expect(screen.getAllByText("Recording your order: confirm in Hub…")).toHaveLength(2);
    expect(second).toBeDisabled();
    fireEvent.click(second);
    fireEvent.click(first);

    answer(true);
    await waitFor(() => expect(onRecorded).toHaveBeenCalled());
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("keeps the order when recording is declined, and says the payment went through", async () => {
    savePendingOrder(pendingOrder());
    q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", async () => {
      throw { error: "User declined request" };
    });
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Finish order" }));
    expect(await screen.findByText(/You declined recording the order\. Your payment went through/)).toBeInTheDocument();
    expect(listPendingOrders(BUYER)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Finish order" })).toBeEnabled();
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
  });

  it("checks an unconfirmed QORT payment among the buyer's payments and records the order with it", async () => {
    savePendingOrder(pendingOrder({ state: "unconfirmed", payment: null }));
    transactions = [
      { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW + 3_000, signature: "FOUNDSIG" },
    ];
    render();
    expect(await screen.findByText("Payment not confirmed")).toBeInTheDocument();
    // Never "pay again": only check, or remove.
    expect(screen.queryByRole("button", { name: /pay/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(fetchUrls()).toContain(
      `/transactions/search?txType=PAYMENT&address=${BUYER_ADDRESS}&confirmationStatus=BOTH&limit=20&reverse=true`
    );
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
    expect(published().order.payment).toEqual({
      total: "3.10000000",
      currency: "QORT",
      transactionSignature: "FOUNDSIG",
      arrrAddressUsed: "",
    });
    expect(await screen.findByText(`Order recorded for ${STORE_TITLE}.`)).toBeInTheDocument();
  });

  it("lets the buyer pick when several payments fit, and never takes one on its own", async () => {
    savePendingOrder(pendingOrder({ state: "unconfirmed", payment: null }));
    transactions = [
      { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW + 9_000, signature: "SECONDSIGxxxxxxxxxxxxxxxxxxxxxxx" },
      { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW + 3_000, signature: "FIRSTSIGxxxxxxxxxxxxxxxxxxxxxxxx" },
      // Signed before the checkout started: not a candidate.
      { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW - 1_000, signature: "EARLIERxxxxxxxxxxxxxxxxxxxxxxxxx" },
    ];
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
    expect(await screen.findByText(/More than one payment of/)).toBeInTheDocument();
    const picks = screen.getAllByRole("button", { name: /^Paid / });
    expect(picks).toHaveLength(2);
    expect(picks[0]).toHaveTextContent("FIRSTSIG…xxxxxx");
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);

    fireEvent.click(picks[1]);
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(published().order.payment.transactionSignature).toBe("SECONDSIGxxxxxxxxxxxxxxxxxxxxxxx");
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
  });

  it("puts the items back in the cart when the buyer wasn't charged", async () => {
    savePendingOrder(pendingOrder({ state: "unconfirmed", payment: null }));
    const store = createAppStore();
    store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
    // Checkout emptied the cart; the buyer has since added the poster again.
    store.dispatch(setProductToCart({ storeId: STORE_ID, storeOwner: SELLER, productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 3 }));
    renderWithProviders(<CartPage />, { store, initialEntries: ["/cart"] });

    fireEvent.click(await screen.findByRole("button", { name: "I wasn't charged — remove" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove this order?" });
    expect(within(dialog).getByText(/Its items go back in your cart/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(listPendingOrders(BUYER)).toEqual([]));
    const cart = cartFor(store.getState().cart.carts, SELLER, STORE_ID);
    expect(cart?.orders).toEqual({
      [poster.id]: { productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 3 },
      [mug.id]: { productId: mug.id, catalogueId: CATALOGUE_ID, quantity: 2 },
    });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("says so when no payment is found, and removes the order only after asking", async () => {
    savePendingOrder(pendingOrder({ state: "unconfirmed", payment: null }));
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Check again" }));
    expect(await screen.findByText(/No matching payment yet/)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "I wasn't charged — remove" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove this order?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(listPendingOrders(BUYER)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "I wasn't charged — remove" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Remove this order?" })).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(listPendingOrders(BUYER)).toEqual([]));
    expect(screen.queryByText("Payment not confirmed")).not.toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
  });

  it("records an unconfirmed ARRR payment the buyer confirms, after a confirmation", async () => {
    savePendingOrder(
      pendingOrder({ state: "unconfirmed", payment: null, coin: "ARRR", currencyLabel: "ARRR", recipient: ARRR_ADDRESS })
    );
    render();
    // The node can't see ARRR payments: no "Check again".
    expect(await screen.findByText(/Your node can't see ARRR payments/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check again" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I paid — record the order" }));
    const dialog = await screen.findByRole("dialog", { name: "Record the order?" });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Record the order" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
    expect(published().order.payment).toEqual({
      total: pendingOrder({ coin: "ARRR" }).amount,
      currency: "ARRR",
      transactionSignature: null,
      arrrAddressUsed: ARRR_ADDRESS,
    });
  });

  it("shows only the signed-in name's orders", async () => {
    savePendingOrder(pendingOrder({ buyer: { name: "Someone Else", address: "Qx", publicKey: "pk" } }));
    render();
    expect(await screen.findByText("Your cart is empty")).toBeInTheDocument();
    expect(screen.queryByText("Orders to finish")).not.toBeInTheDocument();
  });
});
