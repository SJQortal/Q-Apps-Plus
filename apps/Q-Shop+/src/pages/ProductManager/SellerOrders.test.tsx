import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within, configure } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installMockNode, installVisibleIntersectionObserver, makeWorld, type World } from "../../test/mockNode";
import { SELLER, SELLER_ADDRESS, SELLER_PK } from "../../test/fixtures/shop";
import { createAppStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../../state/features/globalSlice";
import { fetchRetry, resetOrderReadCaches } from "../../orders/reads";
import { addOrder, addStatus } from "../../orders/testing";
import { OrdersTab } from "./OrdersTab";
import { SellerOverview } from "./SellerOverview";
import { buildFavoritePublish, favoriteProduct, favoriteShop, type Favorite } from "../../favorites/model";
import { resetQdnCaches } from "../../qdn/search";

const STORE_ID = "q-store-general-my-shop";

function world(): World {
  const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
  addOrder(w, "S0", 2000, { buyer: "Alice" });
  addOrder(w, "S1", 2001, { buyer: "Bob", physical: true });
  addOrder(w, "S2", 2002, { buyer: "Carol" });
  addOrder(w, "S3", 2003, { buyer: "Dave" });
  addOrder(w, "S4", 2004, { buyer: "Erin" });
  addOrder(w, "S5", 2005, { buyer: "Frank" });
  addStatus(w, "S5", "Shipped");
  addStatus(w, "S4", "Refunded");
  addStatus(w, "S2", "Shipped");
  return w;
}

/**
 * Two newer rows the shop's search also finds that aren't this seller's orders: one from
 * another owner's shop with the same id (it opens, and names that owner), and one that
 * can't be read (spam, or encrypted to someone else).
 */
function withUncounted(w: World): World {
  addOrder(w, "F0", 2010, { buyer: "Gina", seller: "Other Owner", storeName: "Other shop" });
  addOrder(w, "U0", 2011, { buyer: "Hank" });
  w.orders.find((o) => o.identifier === "q-store-order-my-shop-U0")!.json = { not: "an order" };
  return w;
}

function sellerStore() {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(
    setCurrentStore({
      id: STORE_ID,
      owner: SELLER,
      title: "Seller's Shop",
      description: "",
      shortStoreId: "my-shop",
      created: 1,
      foreignCoins: {},
      supportedCoins: ["QORT"],
    })
  );
  store.dispatch(
    setDataContainer({
      storeId: STORE_ID,
      shortStoreId: "my-shop",
      owner: SELLER,
      products: {
        a: { created: 1, priceQort: 1, category: "Art", catalogueId: "c", status: "AVAILABLE" },
        b: { created: 2, priceQort: 2, category: "Art", catalogueId: "c", status: "AVAILABLE" },
      },
      catalogues: [],
      id: `${STORE_ID}-datacontainer`,
    })
  );
  return store;
}

/** The tab opens on To handle while there are orders to handle; these tests look at All. */
async function showAll(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: /^All · / }));
}

function names(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("button")
    .map((b) => ["Alice", "Bob", "Carol", "Dave", "Erin", "Frank"].find((n) => b.textContent?.includes(n)) ?? "?");
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

describe("the seller's Orders tab", () => {
  it("opens on To handle while there are orders to handle, and All lists them first, then the handled ones", async () => {
    installMockNode(world());
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    // Simon, 2026-10-22: the tab opens on To handle when there are any.
    await waitFor(() => expect(screen.getByRole("button", { name: "To handle · 3" })).toHaveAttribute("aria-pressed", "true"));
    await waitFor(() => expect(names(list)).toEqual(["Dave", "Bob", "Alice"]));
    fireEvent.click(screen.getByRole("button", { name: /^All · / }));
    await waitFor(() => expect(names(list)).toEqual(["Dave", "Bob", "Alice", "Frank", "Erin", "Carol"]));
    expect(screen.getByRole("button", { name: "Shipped · 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refunded · 1" })).toBeInTheDocument();
    expect(within(list).getAllByText("To handle")).toHaveLength(3);
  });

  it("shows the stars of a buyer's review of the shop on their orders", async () => {
    resetQdnCaches();
    const w = world();
    w.reviews.push({ name: "Alice", shortStoreId: "my-shop", uid: "REVIEWALIC", rating: 4, title: "Nice", description: "Good.", created: 1700000600000 });
    installMockNode(w);
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    const alice = await within(list).findByRole("button", { name: /Alice/ });
    await waitFor(() => expect(within(alice).getByText(/Reviewed/)).toHaveTextContent("Reviewed 4 out of 5 stars"));
    expect(within(within(list).getByRole("button", { name: /Bob/ })).queryByText(/Reviewed/)).toBeNull();
  });

  it("survives an order written to break the list, and opens it", async () => {
    const w = world();
    const hostile = w.orders.find((o) => o.identifier === "q-store-order-my-shop-S3")!;
    hostile.json = {
      ...hostile.json,
      storeName: { evil: true },
      payment: { total: { x: 1 }, currency: 7, transactionSignature: ["s"], arrrAddressUsed: 9, foreignTxid: {} },
      details: { totalPrice: [], junk: "text", [`p`]: { product: { title: { t: 1 }, images: [{}] }, quantity: "2", pricePerUnit: "x" } },
    };
    // Its seller's name isn't text either: it doesn't name this seller, so it isn't counted as theirs.
    const nameless = w.orders.find((o) => o.identifier === "q-store-order-my-shop-S0")!;
    nameless.json = { ...hostile.json, sellerName: 42 };
    installMockNode(w);
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(names(list)).toContain("Dave"));
    expect(await screen.findByText("Orders not counted (1)")).toBeInTheDocument();
    const dave = within(list)
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Dave"))!;
    expect(dave.textContent).toContain("Product × 2");
    fireEvent.click(dave);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Order from Dave")).toBeInTheDocument();
    expect(within(dialog).getByText("Not recorded in this order.")).toBeInTheDocument();
  });

  it("keeps orders it can't open, and orders naming another seller, out of To handle and the filters", async () => {
    const w = withUncounted(world());
    installMockNode(w);
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await showAll();
    await waitFor(() => expect(screen.getByRole("button", { name: "To handle · 3" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "All · 6" })).toBeInTheDocument();
    await waitFor(() => expect(names(list)).toEqual(["Dave", "Bob", "Alice", "Frank", "Erin", "Carol"]));
    fireEvent.click(screen.getByRole("button", { name: "To handle · 3" }));
    await waitFor(() => expect(names(screen.getByRole("list", { name: "Orders received" }))).toEqual(["Dave", "Bob", "Alice"]));

    // Shown apart, folded.
    expect(screen.getByText("Orders not counted (2)")).toBeInTheDocument();
    expect(screen.queryByText("Gina")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    const apart = screen.getByRole("list", { name: "Orders not counted" });
    expect(within(apart).getByText("Gina")).toBeInTheDocument();
    expect(within(apart).getByText(/This order names another seller/)).toBeInTheDocument();
    expect(within(apart).getByText("Hank")).toBeInTheDocument();
    expect(within(apart).getByText("Couldn't open this order")).toBeInTheDocument();
    expect(within(apart).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("never names an asset payment from the buyer's own text on the order cards", async () => {
    const w = world();
    // A worthless asset the buyer issued, called "QORT" in the order; the node doesn't know it here.
    addOrder(w, "A0", 2010, { buyer: "Ivy", currency: "ASSET:9999", payment: { assetId: 9999, assetName: "QORT" } });
    installMockNode(w);
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(within(list).getAllByRole("button").some((b) => b.textContent?.includes("Ivy"))).toBe(true));
    const ivy = within(list)
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Ivy"))!;
    expect(ivy.textContent).toContain("Asset #9999");
    expect(ivy.textContent).not.toContain("QORT");
  });

  it("loads again when the list is reset while it shows (another shop picked)", async () => {
    const node = installMockNode(world());
    const store = sellerStore();
    renderWithProviders(<OrdersTab />, { store });
    await screen.findByRole("list", { name: "Orders received" });
    const searches = () => node.fetchCalls.filter((u) => u.includes("identifier=q-store-order-my-shop-")).length;
    expect(searches()).toBe(1);
    store.dispatch({ type: "order/resetOrders" });
    await waitFor(() => expect(store.getState().order.orders).toHaveLength(6));
    expect(searches()).toBe(1); // the search result is still in the session cache
    expect(store.getState().order.seller.phase).toBe("ready");
  });

  it("finds orders by buyer among the loaded ones", async () => {
    installMockNode(world());
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await showAll();
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(6));
    fireEvent.change(screen.getByLabelText("Search by buyer"), { target: { value: "car" } });
    await waitFor(() => expect(names(screen.getByRole("list", { name: "Orders received" }))).toEqual(["Carol"]));
    fireEvent.change(screen.getByLabelText("Search by buyer"), { target: { value: "zed" } });
    expect(await screen.findByText("No orders from “zed”")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Orders received" })).getAllByRole("button")).toHaveLength(6)
    );
  });

  it("looks further, instead of saying there are no orders, when other shops' orders fill the first pages", async () => {
    installVisibleIntersectionObserver();
    const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
    addOrder(w, "S0", 2000, { buyer: "Alice" });
    // 105 newer orders of shop my-shop-2 (q-store-order-my-shop- matches them too).
    for (let i = 0; i < 105; i++) addOrder(w, `T${String(i).padStart(3, "0")}`, 3000 + i, { short: "my-shop-2", buyer: "Zed" });
    installMockNode(w);
    renderWithProviders(<OrdersTab />, { store: sellerStore() });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(names(list)).toEqual(["Alice"]));
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();
  });

  it("updates an order's status from the dialog, at once", async () => {
    const node = installMockNode(world());
    let finish: (v: unknown) => void = () => {};
    node.q.on("PUBLISH_QDN_RESOURCE", () => new Promise((r) => (finish = r)));
    const store = sellerStore();
    renderWithProviders(<OrdersTab />, { store });
    const list = await screen.findByRole("list", { name: "Orders received" });
    await waitFor(() => expect(names(list)[0]).toBe("Dave"));
    fireEvent.click(within(list).getAllByRole("button")[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Shipped" }));
    fireEvent.change(within(dialog).getByLabelText("Note for the buyer"), { target: { value: "Posted" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Update status" }));
    // The list behind the dialog counts it as shipped before Hub answers.
    await waitFor(() => expect(screen.getByRole("button", { name: "Shipped · 3", hidden: true })).toBeInTheDocument());
    expect(within(dialog).getByRole("button", { name: "Updating…" })).toBeDisabled();
    expect(within(dialog).getByText("Shipped", { selector: ".MuiChip-label" })).toBeInTheDocument();
    finish({ signature: "ok" });
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Status updated"));
    const pub = node.q.callsFor("PUBLISH_QDN_RESOURCE")[0];
    expect(pub).toMatchObject({
      identifier: "q-store-status-order-my-shop-S3",
      name: SELLER,
      filename: "q-store-order-my-shop-S3_status.json",
    });
  });
});

describe("the seller overview", () => {
  it("counts orders by status and products, lists the latest orders, and opens their tabs", async () => {
    installMockNode(world());
    const onOpenTab = vi.fn();
    renderWithProviders(<SellerOverview storeId={STORE_ID} onOpenTab={onOpenTab} />, { store: sellerStore() });
    await waitFor(() => expect(screen.getByRole("button", { name: /3\s*To handle/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /2\s*Shipped/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\s*Refunded/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2\s*Products/ })).toBeInTheDocument();
    const latest = screen.getByRole("list", { name: "Latest orders" });
    await waitFor(() => expect(within(latest).getAllByRole("button")).toHaveLength(5));
    fireEvent.click(screen.getByRole("button", { name: /3\s*To handle/ }));
    expect(onOpenTab).toHaveBeenLastCalledWith("orders");
    fireEvent.click(screen.getByRole("button", { name: /2\s*Products/ }));
    expect(onOpenTab).toHaveBeenLastCalledWith("products");
    fireEvent.click(screen.getByRole("button", { name: /All orders/ }));
    expect(onOpenTab).toHaveBeenLastCalledWith("orders");
    // No links at its foot: the tab bar above leads to the rest (Simon, 2026-10-23).
    expect(screen.queryByRole("navigation", { name: "Manage your shop" })).not.toBeInTheDocument();
  });

  it("shows recent activity: favourites, reviews and orders, newest first, and opens a review", async () => {
    resetQdnCaches();
    const w = world();
    const fav = (name: string, f: Favorite, created: number) => {
      const pub = buildFavoritePublish({ name, fav: f, now: created });
      return { name, identifier: pub.identifier, title: pub.title, description: pub.description, created };
    };
    const product = "q-store-product-my-shop-PRODxxxxx1";
    w.favorites = [
      fav("Fan", favoriteShop(SELLER, STORE_ID)!, 1700000900000),
      fav("Fan Two", favoriteProduct(SELLER, STORE_ID, product, "q-store-catalogue-my-shop-CATxxxxxx1")!, 1700000800000),
      // The owner's own, and another owner's shop with the same id, aren't activity.
      fav(SELLER, favoriteShop(SELLER, STORE_ID)!, 1700000950000),
      fav("Someone", favoriteShop("Other Owner", STORE_ID)!, 1700000960000),
    ];
    installMockNode(w);
    renderWithProviders(<SellerOverview storeId={STORE_ID} onOpenTab={vi.fn()} />, { store: sellerStore() });
    const feed = await screen.findByRole("list", { name: "Recent activity" });
    await waitFor(() =>
      expect(within(feed).getAllByRole("listitem").slice(0, 3).map((li) => li.textContent)).toEqual([
        expect.stringContaining("Fan added your shop to their favourites"),
        expect.stringContaining("Fan Two added a product to their favourites"),
        expect.stringContaining("Reviewer 5 reviewed your shop"),
      ])
    );
    expect(within(feed).queryByText(/Someone/)).toBeNull();
    expect(within(feed).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: /Show more/ }));
    // 6 reviews, 2 favourites, 6 orders.
    await waitFor(() => expect(within(feed).getAllByRole("listitem")).toHaveLength(14));
    expect(within(feed).getByText("Frank placed an order")).toBeInTheDocument();
    fireEvent.click(within(feed).getByText("Reviewer 5 reviewed your shop"));
    const dialog = await screen.findByRole("dialog", { name: "Reviewer 5's review" });
    expect(within(dialog).getByText("Review 5")).toBeInTheDocument();
  });

  it("opens only the latest orders and the ones it needs to count, and Orders opens the rest", async () => {
    const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
    for (let i = 0; i < 12; i++) addOrder(w, `S${String(i).padStart(2, "0")}`, 2000 + i, { buyer: `Buyer ${i}` });
    // The seller shipped the older ones, except S03.
    for (const uid of ["S00", "S01", "S02", "S04", "S05", "S06"]) addStatus(w, uid, "Shipped");
    const node = installMockNode(w);
    const store = sellerStore();
    const overview = renderWithProviders(<SellerOverview storeId={STORE_ID} onOpenTab={vi.fn()} />, { store });
    await waitFor(() => expect(screen.getByRole("button", { name: /6\s*To handle/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /6\s*Shipped/ })).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Latest orders" })).getAllByRole("button")).toHaveLength(5));
    await new Promise((r) => setTimeout(r, 200));
    // The 5 shown, and S03 (it may be To handle, so it must be opened to count): not the 6 already shipped.
    expect(node.summary().hub["FETCH q-store-order"]).toBe(6);
    overview.unmount();

    renderWithProviders(<OrdersTab />, { store });
    const list = await screen.findByRole("list", { name: "Orders received" });
    // It opens on To handle (S07–S11 and S03), so the shipped ones wait until All is picked.
    await showAll();
    await waitFor(() => expect(node.summary().hub["FETCH q-store-order"]).toBe(12));
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(12));
  });

  it("doesn't count orders it can't open, or orders naming another seller", async () => {
    installMockNode(withUncounted(world()));
    renderWithProviders(<SellerOverview storeId={STORE_ID} onOpenTab={vi.fn()} />, { store: sellerStore() });
    await waitFor(() => expect(screen.getByRole("button", { name: /3\s*To handle/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /2\s*Shipped/ })).toBeInTheDocument();
    expect(
      await screen.findByText("2 orders under your shop's id couldn't be opened or name another seller. They aren't counted.")
    ).toBeInTheDocument();
    const latest = screen.getByRole("list", { name: "Latest orders" });
    await waitFor(() => expect(within(latest).getAllByRole("button")).toHaveLength(5));
    expect(within(latest).queryByText("Gina")).not.toBeInTheDocument();
    expect(within(latest).queryByText("Hank")).not.toBeInTheDocument();
  });

  it("doesn't say there are no orders when other shops' orders filled the pages it read", async () => {
    const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
    addOrder(w, "S0", 2000, { buyer: "Alice" });
    for (let i = 0; i < 105; i++) addOrder(w, `T${String(i).padStart(3, "0")}`, 3000 + i, { short: "my-shop-2", buyer: "Zed" });
    installMockNode(w);
    const onOpenTab = vi.fn();
    renderWithProviders(<SellerOverview storeId={STORE_ID} onOpenTab={onOpenTab} />, { store: sellerStore() });
    expect(await screen.findByText("No orders found yet")).toBeInTheDocument();
    expect(screen.queryByText("No orders yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open orders" }));
    expect(onOpenTab).toHaveBeenLastCalledWith("orders");
  });

  it("works without tab links, and says when there are no orders", async () => {
    const w = makeWorld({ shops: 2, me: { name: SELLER, address: SELLER_ADDRESS, publicKey: SELLER_PK } });
    installMockNode(w);
    renderWithProviders(<SellerOverview storeId={STORE_ID} />, { store: sellerStore() });
    expect(await screen.findByText("No orders yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reviews" })).not.toBeInTheDocument();
  });
});
