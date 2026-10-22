/**
 * The order dialog beyond the pinned reads and writes: payment details per
 * coin, the transaction checked against the order, the delivery address,
 * status colours, and a quiet decline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { installQortalMock } from "../../../test/qortalMock";
import { createAppStore } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { statusesLoaded } from "../../../state/features/orderSlice";
import { BUYER, BUYER_ADDRESS, SELLER, SELLER_ADDRESS, SELLER_PK, poster } from "../../../test/fixtures/shop";
import { resetOrderReadCaches } from "../../../orders/reads";
import { orderId, orderJson } from "../../../orders/testing";
import { ShowOrder } from "./ShowOrder";

const ID = orderId("ORDERxxxx1");

function setup(role: "buyer" | "seller", json: any, status?: { status: string; note?: string }) {
  const store = createAppStore();
  if (role === "seller") store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  else store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: "BuyerPK", name: BUYER }));
  if (status) {
    store.dispatch(
      statusesLoaded([{ orderId: ID, info: { state: "known", status: status.status, note: status.note ?? "", updated: 5 } }])
    );
  }
  const order = { ...json, user: BUYER, id: ID, created: 1761000000000, updated: 2, isValid: true };
  renderWithProviders(<ShowOrder open onClose={() => {}} order={order} role={role} />, { store });
  return { store, order };
}

// Rendering MUI in jsdom is slow when the machine is busy; 5 s was too tight.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

beforeEach(() => {
  resetOrderReadCaches();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("payment details", () => {
  it("QORT: reads the transaction on demand and checks it against the order", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.startsWith("/transactions/signature/")
          ? {
              type: "PAYMENT",
              amount: "2.50000000",
              recipient: "QSomeoneElse",
              creatorAddress: "QOther",
              timestamp: 1761000000000,
              blockHeight: 1234567,
              fee: "0.001",
            }
          : [],
    }));
    vi.stubGlobal("fetch", fetchMock);
    installQortalMock({ GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }) });
    setup("seller", orderJson(), { status: "Received" });

    expect(screen.getByText("PAYMENTSIG")).toBeInTheDocument();
    // Nothing is read until asked.
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("/transactions/"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Transaction details" }));
    expect(await screen.findByText("Confirmed in block 1,234,567")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => u === "/transactions/signature/PAYMENTSIG")).toBe(true);
    expect(screen.getByText("QSomeoneElse")).toBeInTheDocument();
    expect(screen.getByText("The amount sent is not the order total.")).toBeInTheDocument();
    expect(screen.getByText("It was sent to another address than the shop owner's.")).toBeInTheDocument();
    expect(screen.getByText("It was sent by another account than the buyer's.")).toBeInTheDocument();
  });

  it("QORT: a transaction that matches shows no warning", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.startsWith("/transactions/")
            ? { type: "PAYMENT", amount: "3.00000000", recipient: SELLER_ADDRESS, creatorAddress: BUYER_ADDRESS, blockHeight: 9 }
            : [],
      }))
    );
    installQortalMock({ GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }) });
    setup("seller", orderJson(), { status: "Received" });
    fireEvent.click(screen.getByRole("button", { name: "Transaction details" }));
    expect(await screen.findByText("Confirmed in block 9")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("QORT: says when the node doesn't have the transaction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: 135 }) }))
    );
    setup("buyer", orderJson(), { status: "Received" });
    fireEvent.click(screen.getByRole("button", { name: "Transaction details" }));
    expect(await screen.findByText(/isn't on your node/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("ARRR: the address paid, and no signature to look up", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    setup(
      "buyer",
      orderJson({
        currency: "ARRR",
        signature: null,
        lines: [{ product: poster, quantity: 1, unit: 0.25 }],
        payment: { arrrAddressUsed: "zs1payout" },
      }),
      { status: "Received" }
    );
    expect(screen.getByText("zs1payout")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the address paid" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transaction details" })).not.toBeInTheDocument();
    expect(screen.getAllByText("ARRR").length).toBeGreaterThan(0);
  });

  it("another coin: the address paid and the transaction id", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    setup(
      "buyer",
      orderJson({ currency: "LTC", signature: null, payment: { foreignAddressUsed: "ltc1abc", foreignTxid: "TXID9" } }),
      {
        status: "Received",
      }
    );
    expect(screen.getByText("ltc1abc")).toBeInTheDocument();
    expect(screen.getByText("TXID9")).toBeInTheDocument();
  });

  it("a Qortal asset: its name and id, in the order's amounts too", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    setup("buyer", orderJson({ currency: "ASSET:42", payment: { assetId: 42, assetName: "Gold" } }), { status: "Received" });
    expect(screen.getByText("Gold (asset #42)")).toBeInTheDocument();
    expect(screen.getAllByText("Gold").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "Transaction details" })).toBeInTheDocument();
  });
});

describe("the rest of the order", () => {
  it("shows a physical order's delivery address to the seller, with a message link to the buyer", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    setup("seller", orderJson({ physical: true }), { status: "Shipped" });
    expect(screen.getByText("Rua 1")).toBeInTheDocument();
    expect(screen.getByText("Ring twice")).toBeInTheDocument();
    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Message ${BUYER}` })).toHaveAttribute("href", "qortal://APP/Q-Mail+/to/Buyer%2BOne");
    // The seller's form starts from the current status.
    expect(screen.getByRole("button", { name: "Shipped" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
  });

  it("shows Refunded with the theme's error colour (the original never did: Bugs 10)", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    setup("buyer", orderJson(), { status: " Refunded", note: "Out of stock, refunded" });
    const chip = document.querySelector('[data-status="Refunded"]');
    expect(chip).toBeInTheDocument();
    expect(chip?.textContent).toBe("Refunded");
    expect(screen.getByText("Out of stock, refunded")).toBeInTheDocument();
  });

  it("stays quiet and keeps the old status when the seller declines in Hub", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [] }))
    );
    installQortalMock({
      GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }),
      GET_ACCOUNT_DATA: async () => ({ publicKey: "BuyerPK" }),
      PUBLISH_QDN_RESOURCE: async () => {
        throw { error: "User declined request" };
      },
    });
    const { store } = setup("seller", orderJson(), { status: "Received" });
    fireEvent.click(screen.getByRole("button", { name: "Refunded" }));
    fireEvent.click(screen.getByRole("button", { name: "Update status" }));
    await waitFor(() => expect(store.getState().order.statuses[ID]?.sending).toBeUndefined());
    expect(store.getState().order.statuses[ID].status).toBe("Received");
    expect(store.getState().notifications.alertTypes.alertError).toBe("");
    // The draft stays, so the seller can try again.
    expect(within(screen.getByRole("group", { name: "Order status" })).getByRole("button", { name: "Refunded" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
