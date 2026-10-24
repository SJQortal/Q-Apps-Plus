/**
 * The order dialog beyond the pinned reads and writes: payment details per
 * coin, the transaction checked against the order, the delivery address,
 * status colours, and a quiet decline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { installQortalMock } from "../../../test/qortalMock";
import { installMockNode, makeWorld } from "../../../test/mockNode";
import { createAppStore } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { setCurrentStore } from "../../../state/features/globalSlice";
import { deliveredLoaded, statusesLoaded } from "../../../state/features/orderSlice";
import { resetAssetCache } from "../../../qdn/assets";
import { resetAssetNamesFromNode } from "../../../orders/useOrderCoin";
import { BUYER, BUYER_ADDRESS, SELLER, SELLER_ADDRESS, SELLER_PK, SHORT_STORE_ID, STORE_TITLE, poster } from "../../../test/fixtures/shop";
import { fetchRetry, resetOrderReadCaches } from "../../../orders/reads";
import { addStatus, orderId, orderJson } from "../../../orders/testing";
import { SENDER_NOTE } from "../../../orders/payment";
import { resetQdnCaches } from "../../../qdn/search";
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
  resetAssetCache();
  resetAssetNamesFromNode();
  fetchRetry.delaysMs = [0, 0, 0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRetry.delaysMs = [2000, 4000, 8000];
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
    // A different sender is a neutral note, not a warning (names can be sold).
    const note = screen.getByText(SENDER_NOTE);
    expect(note.closest(".MuiAlert-root")).toBeNull();
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

  it("a coin Q-Shop+ no longer takes (its test builds offered LTC): the address paid and the transaction id still show", () => {
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

describe("the seller's view of the coin an order names", () => {
  /** The seller's own shop (QORT only unless `shop` says more) and an order placed there. */
  function sellerView(json: any, shop: Record<string, unknown> = {}) {
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(
      setCurrentStore({
        id: "q-store-general-my-shop",
        owner: SELLER,
        title: "Seller's Shop",
        description: "",
        shortStoreId: "my-shop",
        created: 1,
        foreignCoins: {},
        supportedCoins: ["QORT"],
        ...shop,
      })
    );
    store.dispatch(statusesLoaded([{ orderId: ID, info: { state: "known", status: "Received", note: "", updated: 5 } }]));
    const order: any = { ...json, user: BUYER, id: ID, created: 1761000000000, updated: 2, isValid: true };
    renderWithProviders(<ShowOrder open onClose={() => {}} order={order} role="seller" />, { store });
  }

  /** The node: a transaction by signature, and assets by id (others unknown). */
  function stubNode(tx: object | null, assets: Record<number, string> = {}) {
    const reply = (status: number, body: unknown) => ({
      ok: status === 200,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/transactions/signature/")) return tx ? reply(200, tx) : reply(404, { error: 135 });
      const asset = url.match(/^\/assets\/info\?assetId=(\d+)$/);
      if (asset) {
        const name = assets[Number(asset[1])];
        // Core's shape: the asset's name is `name` (a transaction's is `assetName`).
        return name ? reply(200, { assetId: Number(asset[1]), name, isDivisible: true, isUnspendable: false }) : reply(400, { error: 601 });
      }
      return reply(200, []);
    });
    vi.stubGlobal("fetch", fetchMock);
    installQortalMock({ GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }) });
    return fetchMock;
  }

  it("names a worthless asset the buyer called “QORT” by its id and the node's name, and warns", async () => {
    stubNode(
      {
        type: "TRANSFER_ASSET",
        amount: "3.00000000",
        assetId: 9999,
        assetName: "FAKEQ",
        recipient: SELLER_ADDRESS,
        creatorAddress: BUYER_ADDRESS,
        blockHeight: 5,
      },
      { 9999: "FAKEQ" }
    );
    sellerView(orderJson({ currency: "ASSET:9999", payment: { assetId: 9999, assetName: "QORT" } }));
    // Until the node answers: its id only ("Paid in", and each amount).
    expect(screen.getAllByText("Asset #9999").length).toBeGreaterThan(1);
    expect(await screen.findByText("FAKEQ (asset #9999)")).toBeInTheDocument();
    expect(screen.queryByText(/QORT/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This order was paid in asset #9999, which your shop doesn't accept. Make sure you received what the order is worth before you ship."
      )
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Transaction details" }));
    expect(await screen.findByText("Confirmed in block 5")).toBeInTheDocument();
    expect(screen.queryByText(/QORT/)).not.toBeInTheDocument();
  });

  it("names an asset the shop accepts as the shop lists it, whatever the order calls it", async () => {
    const fetchMock = stubNode(null);
    sellerView(orderJson({ currency: "ASSET:42", payment: { assetId: 42, assetName: "Platinum" } }), {
      acceptedAssets: [{ id: 42, name: "Gold" }],
    });
    expect(screen.getByText("Gold (asset #42)")).toBeInTheDocument();
    expect(screen.queryByText(/Platinum/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith("/assets/"))).toBe(false);
  });

  it("ARRR: always says it can't be checked here, and flags it when the shop doesn't take it", () => {
    stubNode(null);
    sellerView(orderJson({ currency: "ARRR", signature: null, payment: { arrrAddressUsed: "zs1shop" } }));
    expect(screen.getByText("zs1shop")).toBeInTheDocument();
    expect(screen.getByText(/ARRR payments can't be checked here/)).toBeInTheDocument();
    expect(screen.getByText(/This order was paid in ARRR, which your shop doesn't accept/)).toBeInTheDocument();
  });

  it("a coin Q-Shop+ no longer takes is an unknown coin to the seller, even when the shop still names it", () => {
    stubNode(null);
    sellerView(orderJson({ currency: "BTC", signature: null, payment: { foreignAddressUsed: "bc1shop", foreignTxid: "TX1" } }), {
      supportedCoins: ["QORT", "BTC"],
      foreignCoins: { BTC: "bc1shop" },
    });
    expect(screen.getByText("TX1")).toBeInTheDocument();
    expect(screen.getAllByText("Unknown coin").length).toBeGreaterThan(0);
    expect(screen.getByText(/names a coin Q-Shop\+ doesn't know/)).toBeInTheDocument();
  });

  it("a coin the app doesn't know is shown as such, never in the buyer's words", () => {
    stubNode(null);
    sellerView(orderJson({ currency: "QORT2", signature: null, payment: { foreignTxid: "TX2" } }));
    expect(screen.getAllByText("Unknown coin").length).toBeGreaterThan(0);
    expect(screen.queryByText(/QORT2/)).not.toBeInTheDocument();
    expect(screen.getByText(/names a coin Q-Shop\+ doesn't know/)).toBeInTheDocument();
    expect(screen.getByText("This payment can't be checked here.")).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: `Message ${BUYER}` })).toHaveAttribute("href", "qortal://APP/Q-Mail/to/Buyer%2BOne");
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

  it("doesn't offer Received over a status it couldn't read: Retry, or an explicit choice", async () => {
    const world = makeWorld({ shops: 1, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
    addStatus(world, "ORDERxxxx1", "Shipped", "Tracking 7");
    const node = installMockNode(world);
    // The list's status read failed (not on the node after the retries, or not decryptable).
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(statusesLoaded([{ orderId: ID, info: { state: "error", status: "", note: "", updated: 0 } }]));
    const order: any = { ...orderJson(), user: BUYER, id: ID, created: 1761000000000, updated: 2, isValid: true };
    renderWithProviders(<ShowOrder open onClose={() => {}} order={order} role="seller" />, { store });

    expect(await screen.findByText(/Couldn't read this order's current status/)).toBeInTheDocument();
    const group = screen.getByRole("group", { name: "Order status" });
    for (const button of within(group).getAllByRole("button")) expect(button).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    // A note alone doesn't make an update: the seller has to choose a status.
    fireEvent.change(screen.getByLabelText("Note for the buyer"), { target: { value: "Posted" } });
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    fireEvent.click(within(group).getByRole("button", { name: "Refunded" }));
    expect(screen.getByRole("button", { name: "Update status" })).toBeEnabled();

    // Retry reads it again from the node, and the form starts from what it says.
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(group).getByRole("button", { name: "Shipped" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByLabelText("Note for the buyer")).toHaveValue("Tracking 7");
    expect(screen.queryByText(/Couldn't read this order's current status/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update status" })).toBeDisabled();
    expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(0);
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

describe("delivered", () => {
  it("the seller sees that the buyer says it arrived, and their status form stays the three", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
    installQortalMock({ GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }) });
    const store = createAppStore();
    store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
    store.dispatch(statusesLoaded([{ orderId: ID, info: { state: "known", status: "Shipped", note: "", updated: 5 } }]));
    store.dispatch(deliveredLoaded([{ orderId: ID, info: { at: 1762000000000 } }]));
    const order = { ...orderJson({ physical: true }), user: BUYER, id: ID, created: 1761000000000, updated: 2, isValid: true };
    renderWithProviders(<ShowOrder open onClose={() => {}} order={order as never} role="seller" />, { store });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(`${BUYER} says it arrived`)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Write a review" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Mark as delivered" })).toBeNull();
    // The chip shows Delivered; the form still holds the seller's own status.
    expect(within(dialog).getAllByText("Delivered").length).toBeGreaterThan(0);
    expect(within(within(dialog).getByRole("group", { name: "Order status" })).getByRole("button", { name: "Shipped" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a refund wins over the buyer's word", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => [] })));
    installQortalMock({});
    const { store } = setup("buyer", orderJson(), { status: "Refunded", note: "Sorry" });
    store.dispatch(deliveredLoaded([{ orderId: ID, info: { at: 1762000000000 } }]));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialog).queryByText("You marked it delivered")).toBeNull());
    expect(within(dialog).getByText("Refunded")).toBeInTheDocument();
  });

  it("the buyer's review shows as published at once, with View review", async () => {
    resetQdnCaches();
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => [] }));
    vi.stubGlobal("fetch", fetchMock);
    const q = installQortalMock({
      LIST_QDN_RESOURCES: async () => ({ resources: [] }),
      PUBLISH_QDN_RESOURCE: async () => ({ signature: "x" }),
    });
    const { store } = setup("buyer", orderJson(), { status: "Received" });
    store.dispatch(deliveredLoaded([{ orderId: ID, info: { at: 1762000000000 } }]));
    const dialog = screen.getByRole("dialog");
    // One search for the buyer's own review of this shop, under their name only.
    fireEvent.click(await within(dialog).findByRole("button", { name: "Write a review" }));
    expect(fetchMock.mock.calls.map(([url]) => url).filter((url) => url.includes("q-store-review-"))).toEqual([
      `/arbitrary/resources/search?mode=ALL&service=DOCUMENT&identifier=q-store-review-${SHORT_STORE_ID}-&name=${encodeURIComponent(BUYER)}&limit=20&offset=0&includemetadata=true&reverse=true&exactmatchnames=true&prefix=true`,
    ]);

    const form = screen.getByRole("dialog", { name: `Review ${STORE_TITLE}` });
    fireEvent.click(within(form).getByLabelText("4 Stars"));
    fireEvent.change(within(form).getByLabelText(/^Title/), { target: { value: "Lovely mug" } });
    fireEvent.change(within(form).getByLabelText(/^Your review/), { target: { value: "Arrived quickly." } });
    fireEvent.click(within(form).getByRole("button", { name: "Publish review" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));

    // Before the node lists it: published, and no second Write a review.
    expect(await within(dialog).findByText(/Your review of .+ is published\./)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Write a review" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "View review" }));
    const view = screen.getByRole("dialog", { name: `Your review of ${STORE_TITLE}` });
    expect(within(view).getByText("Lovely mug")).toBeInTheDocument();
    expect(within(view).getByText("Arrived quickly.")).toBeInTheDocument();
    expect(within(view).getByRole("button", { name: "Write a new review" })).toBeInTheDocument();
  });

  it("a review the buyer published earlier is found, and View review shows it", async () => {
    resetQdnCaches();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("q-store-review-")
            ? [
                // A longer shop id under the same prefix doesn't count.
                { name: BUYER, identifier: `q-store-review-${SHORT_STORE_ID}-2-REVIEWxxx9-10`, created: 9, metadata: { title: "Other shop" } },
                { name: BUYER, identifier: `q-store-review-${SHORT_STORE_ID}-REVIEWxxx1-50`, created: 8, metadata: { title: "Great", description: "Five stars" } },
              ]
            : [],
      }))
    );
    installQortalMock({});
    const { store } = setup("buyer", orderJson(), { status: "Received" });
    store.dispatch(deliveredLoaded([{ orderId: ID, info: { at: 1762000000000 } }]));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "View review" }));
    const view = screen.getByRole("dialog", { name: `Your review of ${STORE_TITLE}` });
    expect(within(view).getByText("Great")).toBeInTheDocument();
    expect(within(view).queryByText("Other shop")).toBeNull();
  });

  it("the seller sees the buyer's review of the shop, and opens it", async () => {
    resetQdnCaches();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.includes("q-store-review-")
            ? [
                { name: "Someone Else", identifier: `q-store-review-${SHORT_STORE_ID}-REVIEWxxx2-30`, created: 9, metadata: { title: "Meh" } },
                { name: BUYER, identifier: `q-store-review-${SHORT_STORE_ID}-REVIEWxxx1-45`, created: 8, metadata: { title: "Lovely mug", description: "Fast." } },
              ]
            : [],
      }))
    );
    installQortalMock({ GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }) });
    setup("seller", orderJson(), { status: "Shipped" });
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText(`${BUYER} reviewed your shop`)).toBeInTheDocument();
    expect(within(dialog).getByText(/“Lovely mug”/)).toBeInTheDocument();
    expect(within(dialog).getByRole("img", { name: "4.5 out of 5 stars" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "View review" }));
    const view = screen.getByRole("dialog", { name: `${BUYER}'s review` });
    expect(within(view).getByText("Fast.")).toBeInTheDocument();
    expect(within(view).queryByRole("button", { name: "Write a new review" })).toBeNull();
  });
});
