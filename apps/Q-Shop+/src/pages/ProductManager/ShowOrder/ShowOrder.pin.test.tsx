/**
 * Pins how the original app reads an order and the seller's status note, and
 * how the seller publishes a status update (docs/apps/Q-Shop+.md → Money
 * code). Written against the upstream code before any change.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { createAppStore } from "../../../state/store";
import { HubThemeProvider } from "../../../hub-theme";
import { THEME_STORAGE_KEY, themeConfig } from "../../../theme/qplus-theme";
import { addUser } from "../../../state/features/authSlice";
import { installQortalMock } from "../../../test/qortalMock";
import { fetchAndEvaluateOrders } from "../../../utils/fetchOrders";
import {
  BUYER,
  BUYER_ADDRESS,
  BUYER_PK,
  CATALOGUE_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_TITLE,
  decodeData64,
  encodeData64,
  mug,
} from "../../../test/fixtures/shop";
import { ShowOrder } from "./ShowOrder";

const ORDER_ID = `q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`;
const STATUS_ID = `q-store-status-order-${SHORT_STORE_ID}-ORDERxxxx1`;

const orderJson = {
  created: 1761000000000,
  version: 1,
  details: {
    totalPrice: "3.00000000",
    [mug.id]: { product: mug, catalogueId: CATALOGUE_ID, quantity: 2, pricePerUnit: 1.5, totalProductPrice: 3 },
  },
  storeName: STORE_TITLE,
  sellerName: SELLER,
  delivery: {
    customerName: BUYER,
    shippingAddress: { streetAddress: "", city: "", region: "", country: "", zipCode: "", deliveryNote: "" },
  },
  payment: { total: "3.00000000", currency: "QORT", transactionSignature: "PAYMENTSIG", arrrAddressUsed: "" },
  communicationMethod: ["Q-Mail"],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reading an order (pinned)", () => {
  it("fetches the DOCUMENT_PRIVATE as base64, decrypts it and marks it Received", async () => {
    const q = installQortalMock({
      FETCH_QDN_RESOURCE: async () => "ENCRYPTED64",
      DECRYPT_DATA: async () => encodeData64(orderJson),
    });
    const row = { created: 1, updated: 2, user: BUYER, id: ORDER_ID };
    const res = await fetchAndEvaluateOrders({ user: BUYER, orderId: ORDER_ID, content: row });

    expect(q.calls).toEqual([
      { action: "FETCH_QDN_RESOURCE", name: BUYER, service: "DOCUMENT_PRIVATE", identifier: ORDER_ID, encoding: "base64" },
      { action: "DECRYPT_DATA", encryptedData: "ENCRYPTED64" },
    ]);
    expect(res).toEqual({
      ...orderJson,
      ...row,
      status: "Received",
      note: "",
      user: BUYER,
      id: ORDER_ID,
      isValid: true,
    });
  });
});

function renderShowOrder(from: "ProductManager" | "myOrders", me: { name: string; address: string; pk: string }) {
  const store = createAppStore();
  store.dispatch(addUser({ address: me.address, publicKey: me.pk, name: me.name }));
  const order = { ...orderJson, user: BUYER, id: ORDER_ID, updated: 2, isValid: true, status: "Received", note: "" };
  render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ShowOrder isOpen setIsOpen={() => {}} order={order as any} from={from} />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  return store;
}

describe("order status (pinned)", () => {
  it("reads the seller's status document by searching its identifier, then decrypts it with the buyer's key", async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => [{ name: SELLER, identifier: STATUS_ID }] }));
    vi.stubGlobal("fetch", fetchMock);
    const q = installQortalMock({
      FETCH_QDN_RESOURCE: async () => "ENCSTATUS",
      GET_NAME_DATA: async () => ({ name: BUYER, owner: BUYER_ADDRESS }),
      GET_ACCOUNT_DATA: async () => ({ address: BUYER_ADDRESS, publicKey: BUYER_PK }),
      DECRYPT_DATA: async () => encodeData64({ status: "Shipped", note: "Tracking 123" }),
    });
    const store = renderShowOrder("myOrders", { name: BUYER, address: BUYER_ADDRESS, pk: BUYER_PK });

    await waitFor(() => expect(q.callsFor("DECRYPT_DATA")).toHaveLength(1));
    expect(fetchMock.mock.calls[0][0]).toBe(
      `/arbitrary/resources/search?service=DOCUMENT_PRIVATE&query=${STATUS_ID}&limit=1&includemetadata=false&mode=ALL&reverse=true`
    );
    expect(q.calls).toEqual([
      { action: "FETCH_QDN_RESOURCE", name: SELLER, service: "DOCUMENT_PRIVATE", identifier: STATUS_ID, encoding: "base64" },
      { action: "GET_NAME_DATA", name: BUYER },
      { action: "GET_ACCOUNT_DATA", address: BUYER_ADDRESS },
      { action: "DECRYPT_DATA", encryptedData: "ENCSTATUS", publicKey: BUYER_PK },
    ]);
    await waitFor(() => expect(store.getState().order.hashMapOrders[ORDER_ID]?.status).toBe("Shipped"));
    expect(store.getState().order.hashMapOrders[ORDER_ID]?.note).toBe("Tracking 123");
  });

  it("publishes the seller's status encrypted to the buyer and the seller, under q-store-status-order-…", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
    const q = installQortalMock({
      GET_NAME_DATA: async () => ({ name: BUYER, owner: BUYER_ADDRESS }),
      GET_ACCOUNT_DATA: async () => ({ address: BUYER_ADDRESS, publicKey: BUYER_PK }),
      PUBLISH_QDN_RESOURCE: async () => ({ signature: "x" }),
    });
    renderShowOrder("ProductManager", { name: SELLER, address: SELLER_ADDRESS, pk: SELLER_PK });

    fireEvent.change(await screen.findByLabelText(/Note/), { target: { value: "Sent today" } });
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByRole("option", { name: "Shipped" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const pub = q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any;
    expect({ ...pub, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      identifier: STATUS_ID,
      name: SELLER,
      service: "DOCUMENT_PRIVATE",
      filename: `${ORDER_ID}_status.json`,
      data64: undefined,
      encrypt: true,
      publicKeys: [BUYER_PK, SELLER_PK],
    });
    expect(decodeData64(pub.data64)).toEqual({ status: "Shipped", note: "Sent today" });
  });
});
