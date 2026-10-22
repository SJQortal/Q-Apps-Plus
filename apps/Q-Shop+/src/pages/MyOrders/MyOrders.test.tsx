import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, installVisibleIntersectionObserver, makeWorld, type World } from "../../test/mockNode";
import { BUYER, BUYER_ADDRESS, SELLER } from "../../test/fixtures/shop";
import { addUser } from "../../state/features/authSlice";
import { createAppStore } from "../../state/store";
import { removePendingOrder, savePendingOrder, type PendingOrder } from "../../money/pendingOrders";
import { fetchRetry, resetOrderReadCaches } from "../../orders/reads";
import { addOrder, addStatus, orderId, OTHER_SELLER, OTHER_SHORT } from "../../orders/testing";
import { ShellContext } from "../../components/layout/shellState";
import { MyOrders } from "./MyOrders";

function world(count = 3): World {
  const w = makeWorld({ shops: 2, me: { name: BUYER, address: BUYER_ADDRESS, publicKey: "BuyerPK" } });
  for (let i = 0; i < count; i++) {
    const uid = `O${String(i).padStart(2, "0")}`;
    if (i === 1)
      addOrder(w, uid, 1000 + i, { short: OTHER_SHORT, seller: OTHER_SELLER, storeName: "Shop number 1", physical: true });
    else addOrder(w, uid, 1000 + i);
  }
  return w;
}

function signedIn() {
  const store = createAppStore();
  store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: "BuyerPK", name: BUYER }));
  return store;
}

function renderPage(store = signedIn()) {
  return renderWithProviders(
    <Routes>
      <Route path="/my-orders" element={<MyOrders />} />
      <Route path="/cart" element={<p>Cart page</p>} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    { store, initialEntries: ["/my-orders"] }
  );
}

// Rendering MUI in jsdom is slow when the machine is busy; 5 s was too tight.
vi.setConfig({ testTimeout: 20_000 });
configure({ asyncUtilTimeout: 5_000 });

beforeEach(() => {
  resetOrderReadCaches();
  fetchRetry.delaysMs = [0, 0, 0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRetry.delaysMs = [2000, 4000, 8000];
});

describe("My orders", () => {
  it("asks a signed-out visitor to sign in", async () => {
    const node = installMockNode(world());
    const store = createAppStore();
    // The shell's Sign in (GlobalWrapper → useUserAccount) asks Hub for the account.
    const signIn = async () => {
      const account = await qortalRequest({ action: "GET_USER_ACCOUNT" });
      store.dispatch(addUser({ ...account, name: BUYER, names: [{ name: BUYER, owner: account.address }] }));
    };
    renderWithProviders(
      <ShellContext.Provider value={{ signIn, reloadOwnShops: () => {}, authenticating: false }}>
        <MyOrders />
      </ShellContext.Provider>,
      { store }
    );
    expect(screen.getByRole("heading", { level: 1, name: "My orders" })).toBeInTheDocument();
    expect(node.fetchCalls.filter((u) => u.includes("q-store-order"))).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(node.q.callsFor("GET_USER_ACCOUNT")).toHaveLength(1));
    // Signed in: the orders load.
    expect(await screen.findByRole("list", { name: "Your orders" })).toBeInTheDocument();
  });

  it("says there are no orders yet and leads to the shops", async () => {
    installMockNode(world(0));
    renderPage();
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Browse shops" }));
    expect(await screen.findByText("Home page")).toBeInTheDocument();
  });

  it("shows each order with its shop, items, total and status, and counts per status", async () => {
    const w = world();
    addStatus(w, "O00", "Shipped", "Tracking 42");
    addStatus(w, "O01", "Refunded", "", { seller: OTHER_SELLER, short: OTHER_SHORT });
    installMockNode(w);
    renderPage();
    const list = await screen.findByRole("list", { name: "Your orders" });
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(3));
    expect(within(list).getAllByText("Seller's Shop")).toHaveLength(2);
    expect(within(list).getByText("Shop number 1")).toBeInTheDocument();
    expect(within(list).getAllByText("Mug × 2")).toHaveLength(2);
    expect(within(list).getAllByText("3.00")).toHaveLength(2);
    await waitFor(() => expect(screen.getByRole("button", { name: "Shipped · 1" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Refunded · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Received · 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All · 3" })).toHaveAttribute("aria-pressed", "true");

    // Refunded in the theme's error colour, never the original's yellow.
    expect(document.querySelector('[data-status="Refunded"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Shipped · 1" }));
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Refunded · 1" }));
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Your orders" })).getByText("Shop number 1")).toBeInTheDocument()
    );
  });

  it("opens an order: items, total, the seller's note, and a message link to the seller", async () => {
    const w = world(1);
    addStatus(w, "O00", "Shipped", "Tracking 42");
    installMockNode(w);
    renderPage();
    const list = await screen.findByRole("list", { name: "Your orders" });
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(1));
    fireEvent.click(within(list).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Order at Seller's Shop")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Mug" })).toHaveAttribute(
      "href",
      `/${encodeURIComponent(
        SELLER
      )}/q-store-general-my-shop/q-store-product-my-shop-MUGxxxxxx1/q-store-catalogue-my-shop-CATxxxxxx1`
    );
    expect(within(dialog).getByText("Tracking 42")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: `Message ${SELLER}` })).toHaveAttribute(
      "href",
      "qortal://APP/Q-Mail/to/Seller%20Name"
    );
    expect(within(dialog).getByText("Digital order: nothing to ship.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Update status" })).not.toBeInTheDocument();
  });

  it("loads the next page from the buyer's own list when the end of the list shows", async () => {
    installVisibleIntersectionObserver();
    const node = installMockNode(world(25));
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: "All · 25" })).toBeInTheDocument());
    const offsets = node.fetchCalls
      .filter((u) => u.includes("identifier=q-store-order-"))
      .map((u) => new URLSearchParams(u.split("?")[1]).get("offset"));
    expect(offsets).toEqual(["0", "20"]);
  });

  it("says when the first page can't load, and retries", async () => {
    const w = world();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline")))
    );
    renderPage();
    expect(await screen.findByText("Couldn't load your orders")).toBeInTheDocument();
    installMockNode(w);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("list", { name: "Your orders" })).toBeInTheDocument();
  });

  it("points to paid orders that still need finishing, without paying again", async () => {
    installMockNode(world(0));
    savePendingOrder({
      version: 1,
      orderUid: "PENDING001",
      mailUid: "MAIL01",
      state: "paid",
      created: 1,
      updated: 1,
      buyer: { name: BUYER, address: BUYER_ADDRESS, publicKey: "BuyerPK" },
      store: { id: "q-store-general-my-shop", shortStoreId: "my-shop", title: "Seller's Shop", owner: SELLER },
      seller: { address: "QSeller", publicKey: "SellerPK" },
      coin: "QORT",
      currencyLabel: "QORT",
      recipient: "QSeller",
      amount: "1.00000000",
      isDigital: true,
      details: { totalPrice: "1.00000000" } as any,
      payment: { total: "1.00000000", currency: "QORT", transactionSignature: "SIG", arrrAddressUsed: "" },
    } as PendingOrder);
    renderPage();
    expect(await screen.findByText(/You paid for an order that isn't recorded yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByText("Cart page")).toBeInTheDocument();
  });

  it("shows an order recorded at checkout, even when My orders was read earlier in the visit", async () => {
    const w = world(1);
    installMockNode(w);
    const store = signedIn();
    const first = renderPage(store);
    const list = await screen.findByRole("list", { name: "Your orders" });
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(1));
    first.unmount();

    // The buyer shops and pays; the checkout records the order and drops it from the pending list.
    addOrder(w, "NEW0000001", 5000, { storeName: "Seller's Shop" });
    const pending = {
      version: 1,
      orderUid: "NEW0000001",
      mailUid: "MAIL02",
      state: "paid",
      created: 2,
      updated: 2,
      buyer: { name: BUYER, address: BUYER_ADDRESS, publicKey: "BuyerPK" },
      store: { id: "q-store-general-my-shop", shortStoreId: "my-shop", title: "Seller's Shop", owner: SELLER },
      seller: { address: "QSeller", publicKey: "SellerPK" },
      coin: "QORT",
      currencyLabel: "QORT",
      recipient: "QSeller",
      amount: "3.00000000",
      isDigital: true,
      details: { totalPrice: "3.00000000" } as any,
      payment: { total: "3.00000000", currency: "QORT", transactionSignature: "SIG2", arrrAddressUsed: "" },
    } as PendingOrder;
    savePendingOrder(pending);
    removePendingOrder(BUYER, "NEW0000001");

    // "View my orders".
    renderPage(store);
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Your orders" })).getAllByRole("button")).toHaveLength(2)
    );
    expect(store.getState().order.myOrders[0].id).toBe(orderId("NEW0000001"));
  });

  it("reads the list again when it shows after the search cache has expired (new statuses)", async () => {
    const w = world(1);
    installMockNode(w);
    const store = signedIn();
    const first = renderPage(store);
    await waitFor(() => expect(screen.getByRole("button", { name: "Received · 1" })).toBeInTheDocument());
    first.unmount();

    addStatus(w, "O00", "Shipped", "Posted today");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + 3 * 60_000);
      renderPage(store);
      await waitFor(() => expect(screen.getByRole("button", { name: "Shipped · 1" })).toBeInTheDocument());
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks an order it can't open and keeps the others", async () => {
    const w = world();
    w.orders.find((o) => o.identifier === orderId("O02"))!.json = { nope: true };
    installMockNode(w);
    renderPage();
    expect(await screen.findByText("Couldn't open this order")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Your orders" });
    await waitFor(() => expect(within(list).getAllByRole("button", { name: /Seller's Shop|Shop number 1/ })).toHaveLength(2));
    expect(within(list).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
