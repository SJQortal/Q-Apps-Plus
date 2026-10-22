/**
 * Pins how the original app reads an order and the seller's status note, and
 * how the seller publishes a status update (docs/apps/Q-Shop+.md → Money
 * code). Written against the upstream code before any change, then ported to
 * the redesigned dialog with the same Hub requests and payloads.
 *
 * One expectation changed, on purpose: the status search. The original
 * searched `query=<status id>` with no name, so any name publishing that
 * identifier answered "exists" (Bugs 11); the + app searches the exact
 * identifier under the seller's name. The FETCH, the key lookup, the
 * DECRYPT_DATA and the publish are unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, configure } from "@testing-library/react";
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
import { resetOrderReadCaches } from "../../../orders/reads";

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

// Rendering MUI in jsdom is slow when the machine is busy; 5 s was too tight.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

beforeEach(() => {
  resetOrderReadCaches();
});

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

function renderShowOrder(role: "seller" | "buyer", me: { name: string; address: string; pk: string }) {
  const store = createAppStore();
  store.dispatch(addUser({ address: me.address, publicKey: me.pk, name: me.name }));
  const order = { ...orderJson, user: BUYER, id: ORDER_ID, updated: 2, isValid: true, status: "Received", note: "" };
  render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ShowOrder open onClose={() => {}} order={order as any} role={role} />
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
    const store = renderShowOrder("buyer", { name: BUYER, address: BUYER_ADDRESS, pk: BUYER_PK });

    await waitFor(() => expect(q.callsFor("DECRYPT_DATA")).toHaveLength(1));
    // Was `/arbitrary/resources/search?service=DOCUMENT_PRIVATE&query=${STATUS_ID}&limit=1&includemetadata=false&mode=ALL&reverse=true`:
    // now the exact identifier, published by the seller (Bugs 11).
    expect(fetchMock.mock.calls[0][0]).toBe(
      `/arbitrary/resources/search?mode=ALL&service=DOCUMENT_PRIVATE&identifier=${STATUS_ID}&name=Seller+Name&limit=1&offset=0&includemetadata=false&reverse=true&exactmatchnames=true`
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(q.calls).toEqual([
      { action: "FETCH_QDN_RESOURCE", name: SELLER, service: "DOCUMENT_PRIVATE", identifier: STATUS_ID, encoding: "base64" },
      { action: "GET_NAME_DATA", name: BUYER },
      { action: "GET_ACCOUNT_DATA", address: BUYER_ADDRESS },
      { action: "DECRYPT_DATA", encryptedData: "ENCSTATUS", publicKey: BUYER_PK },
    ]);
    // The status lives beside the order now (state.order.statuses), so a list can read it before the order opens.
    await waitFor(() => expect(store.getState().order.statuses[ORDER_ID]?.status).toBe("Shipped"));
    expect(store.getState().order.statuses[ORDER_ID]?.note).toBe("Tracking 123");
    expect(await screen.findByText("Tracking 123")).toBeInTheDocument();
  });

  it("publishes the seller's status encrypted to the buyer and the seller, under q-store-status-order-…", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
    const q = installQortalMock({
      GET_NAME_DATA: async () => ({ name: BUYER, owner: BUYER_ADDRESS }),
      GET_ACCOUNT_DATA: async () => ({ address: BUYER_ADDRESS, publicKey: BUYER_PK }),
      PUBLISH_QDN_RESOURCE: async () => ({ signature: "x" }),
    });
    renderShowOrder("seller", { name: SELLER, address: SELLER_ADDRESS, pk: SELLER_PK });

    fireEvent.change(await screen.findByLabelText(/Note/), { target: { value: "Sent today" } });
    fireEvent.click(screen.getByRole("button", { name: "Shipped" }));
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));

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
    // The buyer's key is looked up for the publish, as the original does.
    expect(q.calls.map((c) => c.action)).toEqual(["GET_NAME_DATA", "GET_ACCOUNT_DATA", "PUBLISH_QDN_RESOURCE"]);
    expect(q.callsFor("GET_NAME_DATA")[0]).toEqual({ action: "GET_NAME_DATA", name: BUYER });
    expect(q.callsFor("GET_ACCOUNT_DATA")[0]).toEqual({ action: "GET_ACCOUNT_DATA", address: BUYER_ADDRESS });
  });
});
