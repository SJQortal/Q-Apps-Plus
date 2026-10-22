import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppStore } from "../state/store";
import { installMockNode, makeWorld, type World } from "../test/mockNode";
import { BUYER, SELLER } from "../test/fixtures/shop";
import { loadOrders, retryOrder, type ListOwner } from "./loader";
import { fetchRetry, resetOrderReadCaches } from "./reads";
import { sendOrderStatus } from "./statusUpdate";
import { selectBuyerItems, selectSellerItems } from "./selectors";
import { addOrder, addStatus, orderId, OTHER_SELLER, OTHER_SHORT, statusId } from "./testing";
import { statusesLoaded } from "../state/features/orderSlice";

const BUYER_LIST: ListOwner = { kind: "buyer", name: BUYER };
const SHOP: ListOwner = { kind: "seller", storeId: "q-store-general-my-shop", shortStoreId: "my-shop", seller: SELLER };

function buyerWorld(): World {
  const world = makeWorld({ shops: 2 });
  for (let i = 0; i < 25; i++) {
    const uid = `O${String(i).padStart(2, "0")}`;
    if (i % 2) addOrder(world, uid, 1000 + i, { short: OTHER_SHORT, seller: OTHER_SELLER, storeName: "Shop number 1" });
    else addOrder(world, uid, 1000 + i);
  }
  addStatus(world, "O24", "Shipped", "Tracking 1");
  addStatus(world, "O23", "Refunded", "Sorry", { seller: OTHER_SELLER, short: OTHER_SHORT });
  // Another seller can't set the status of Seller Name's order.
  addStatus(world, "O22", "Shipped", "", { seller: OTHER_SELLER });
  return world;
}

function searchUrls(node: ReturnType<typeof installMockNode>) {
  return node.fetchCalls.filter((u) => u.startsWith("/arbitrary/resources/search"));
}

// Rendering MUI in jsdom is slow when the machine is busy; 5 s was too tight.
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  resetOrderReadCaches();
  fetchRetry.delaysMs = [0, 0, 0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRetry.delaysMs = [2000, 4000, 8000];
});

describe("the buyer's orders", () => {
  it("loads a page of 20 with one order search and one status search, and pages from the buyer's own list", async () => {
    const node = installMockNode(buyerWorld());
    const store = createAppStore();
    expect(await loadOrders(store, BUYER_LIST, "first")).toBe(true);

    const state = store.getState().order;
    expect(state.myOrders).toHaveLength(20);
    expect(state.myOrders[0].id).toBe(orderId("O24"));
    expect(Object.keys(state.hashMapOrders)).toHaveLength(20);
    expect(state.statuses[orderId("O24")]).toMatchObject({ status: "Shipped", note: "Tracking 1" });
    expect(state.statuses[orderId("O23", OTHER_SHORT)]).toMatchObject({ status: "Refunded", note: "Sorry" });
    expect(state.statuses[orderId("O22")]).toMatchObject({ status: "Received" });
    expect(state.buyer).toMatchObject({ offset: 20, hasMore: true, phase: "ready" });

    const s = node.summary();
    expect(s.searches).toEqual({ DOCUMENT_PRIVATE: 2 });
    expect(s.unlimitedSearches).toBe(0);
    expect(s.hub["FETCH q-store-order"]).toBe(20);
    // Only the statuses that exist are fetched; the buyer's key is looked up once.
    expect(s.hub["FETCH q-store-status"]).toBe(2);
    expect(s.hub.GET_NAME_DATA).toBe(1);
    expect(s.hub.GET_ACCOUNT_DATA).toBe(1);

    // Page two starts after the buyer's 20 rows (the original used the seller's list: Bugs 5).
    expect(await loadOrders(store, BUYER_LIST, "more")).toBe(true);
    const urls = searchUrls(node).filter((u) => u.includes("identifier=q-store-order-"));
    expect(new URLSearchParams(urls[1].split("?")[1]).get("offset")).toBe("20");
    expect(store.getState().order.myOrders).toHaveLength(25);
    expect(store.getState().order.buyer).toMatchObject({ offset: 25, hasMore: false });
    expect(await loadOrders(store, BUYER_LIST, "more")).toBe(false);
  });

  it("a refresh searches the node again but only opens orders and statuses that changed", async () => {
    const node = installMockNode(buyerWorld());
    const store = createAppStore();
    await loadOrders(store, BUYER_LIST, "first");
    node.reset();
    expect(await loadOrders(store, BUYER_LIST, "refresh")).toBe(true);
    const s = node.summary();
    expect(s.searches).toEqual({ DOCUMENT_PRIVATE: 2 });
    expect(s.hub["FETCH q-store-order"]).toBeUndefined();
    expect(s.hub["FETCH q-store-status"]).toBeUndefined();
    expect(store.getState().order.myOrders).toHaveLength(20);
    expect(store.getState().order.buyer.refreshing).toBe(false);
  });

  it("doesn't load the same list twice at once, and keeps a loaded list for the next visit", async () => {
    const node = installMockNode(buyerWorld());
    const store = createAppStore();
    await Promise.all([loadOrders(store, BUYER_LIST, "first"), loadOrders(store, BUYER_LIST, "first")]);
    await loadOrders(store, BUYER_LIST, "first");
    expect(searchUrls(node).filter((u) => u.includes("identifier=q-store-order-"))).toHaveLength(1);
  });

  it("keeps going past an order that can't be read, and marks it (Bugs 4)", async () => {
    const world = buyerWorld();
    world.orders.find((o) => o.identifier === orderId("O20"))!.json = { not: "an order" };
    installMockNode(world);
    const store = createAppStore();
    await loadOrders(store, BUYER_LIST, "first");
    const state = store.getState().order;
    expect(state.openState[orderId("O20")]).toBe("unreadable");
    expect(Object.keys(state.hashMapOrders)).toHaveLength(19);
    const item = selectBuyerItems(store.getState()).find((i) => i.row.id === orderId("O20"));
    expect(item).toMatchObject({ order: null, openState: "unreadable" });
  });

  it("asks peers again for an order the node doesn't have yet, then offers a retry", async () => {
    const node = installMockNode(buyerWorld());
    let misses = 0;
    node.q.on("FETCH_QDN_RESOURCE", async (p) => {
      const id = String(p.identifier);
      if (id === orderId("O24") && misses < 2) {
        misses++;
        throw { error: 1401, message: "Not found" };
      }
      if (id === orderId("O22")) throw { error: 1401, message: "Not found" };
      return `ENC:${id}`;
    });
    const store = createAppStore();
    await loadOrders(store, BUYER_LIST, "first");
    await vi.waitFor(() => expect(store.getState().order.hashMapOrders[orderId("O24")]).toBeDefined());
    await vi.waitFor(() => expect(store.getState().order.openState[orderId("O22")]).toBe("unavailable"));
    // The late order still gets its status.
    await vi.waitFor(() => expect(store.getState().order.statuses[orderId("O24")]?.status).toBe("Shipped"));

    node.q.on("FETCH_QDN_RESOURCE", async (p) => `ENC:${p.identifier}`);
    const row = store.getState().order.myOrders.find((r) => r.id === orderId("O22"))!;
    expect(await retryOrder(store, BUYER_LIST, row)).toBe(true);
    expect(store.getState().order.hashMapOrders[orderId("O22")]).toBeDefined();
    expect(store.getState().order.openState[orderId("O22")]).toBeUndefined();
  });

  it("shows a first-page error, then loads on retry", async () => {
    const world = buyerWorld();
    installMockNode(world);
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", failing);
    const store = createAppStore();
    expect(await loadOrders(store, BUYER_LIST, "first")).toBe(false);
    expect(store.getState().order.buyer.phase).toBe("error");
    installMockNode(world);
    expect(await loadOrders(store, BUYER_LIST, "first")).toBe(true);
    expect(store.getState().order.myOrders).toHaveLength(20);
  });

  it("starts over for another name, and drops answers meant for the old one", async () => {
    installMockNode(buyerWorld());
    const store = createAppStore();
    const first = loadOrders(store, BUYER_LIST, "first");
    const other = loadOrders(store, { kind: "buyer", name: "Somebody" }, "first");
    await Promise.all([first, other]);
    expect(store.getState().order.buyer.owner).toBe("Somebody");
    expect(store.getState().order.myOrders).toHaveLength(0);
  });
});

describe("the seller's orders", () => {
  function sellerWorld(): World {
    const world = makeWorld({ shops: 2, me: { name: SELLER, address: "QSeller", publicKey: "SellerPK" } });
    for (let i = 0; i < 6; i++) addOrder(world, `S${i}`, 2000 + i, { buyer: `Buyer ${i % 3}` });
    // my-shop-2 shares the prefix q-store-order-my-shop-.
    addOrder(world, "T0", 3000, { short: "my-shop-2", buyer: "Buyer 9" });
    addStatus(world, "S5", "Shipped");
    addStatus(world, "S4", "Refunded");
    addStatus(world, "S3", "Shipped", "", { seller: "Impostor" });
    return world;
  }

  it("lists only this shop's orders, with every status from one search", async () => {
    const node = installMockNode(sellerWorld());
    const store = createAppStore();
    await loadOrders(store, SHOP, "first");
    const state = store.getState().order;
    expect(state.orders.map((r) => r.id)).toEqual(["S5", "S4", "S3", "S2", "S1", "S0"].map((u) => orderId(u)));
    expect(state.orders.map((r) => r.user)).toContain("Buyer 0");
    expect(state.statuses[orderId("S5")].status).toBe("Shipped");
    expect(state.statuses[orderId("S4")].status).toBe("Refunded");
    expect(state.statuses[orderId("S3")].status).toBe("Received");

    const urls = searchUrls(node);
    expect(urls).toHaveLength(2);
    const statusSearch = new URLSearchParams(urls.find((u) => u.includes("status"))!.split("?")[1]);
    expect(statusSearch.get("identifier")).toBe("q-store-status-order-my-shop-");
    expect(statusSearch.getAll("name")).toEqual([SELLER]);
    const s = node.summary();
    expect(s.hub["FETCH q-store-status"]).toBe(2);
    expect(s.unlimitedSearches).toBe(0);
    expect(selectSellerItems(store.getState())).toHaveLength(6);
  });

  it("reads on when a whole search page holds another shop's orders whose id starts the same", async () => {
    const world = makeWorld({ shops: 2, me: { name: SELLER, address: "QSeller", publicKey: "SellerPK" } });
    addOrder(world, "S0", 2000, { buyer: "Buyer 0" });
    addOrder(world, "S1", 2001, { buyer: "Buyer 1" });
    // 25 newer orders of shop my-shop-2: the first 20 rows of q-store-order-my-shop- are all theirs.
    for (let i = 0; i < 25; i++) addOrder(world, `T${String(i).padStart(2, "0")}`, 3000 + i, { short: "my-shop-2", buyer: "Buyer 9" });
    const node = installMockNode(world);
    const store = createAppStore();
    expect(await loadOrders(store, SHOP, "first")).toBe(true);
    expect(store.getState().order.orders.map((r) => r.id)).toEqual([orderId("S1"), orderId("S0")]);
    expect(store.getState().order.seller).toMatchObject({ offset: 27, hasMore: false, phase: "ready" });
    const offsets = searchUrls(node)
      .filter((u) => u.includes("identifier=q-store-order-my-shop-"))
      .map((u) => new URLSearchParams(u.split("?")[1]).get("offset"));
    expect(offsets).toEqual(["0", "20"]);
  });

  it("stops after 5 search pages of other shops' orders and leaves the rest to Load more", async () => {
    const world = makeWorld({ shops: 2, me: { name: SELLER, address: "QSeller", publicKey: "SellerPK" } });
    addOrder(world, "S0", 2000, { buyer: "Buyer 0" });
    for (let i = 0; i < 105; i++) addOrder(world, `T${String(i).padStart(3, "0")}`, 3000 + i, { short: "my-shop-2", buyer: "Buyer 9" });
    installMockNode(world);
    const store = createAppStore();
    await loadOrders(store, SHOP, "first");
    expect(store.getState().order.orders).toHaveLength(0);
    expect(store.getState().order.seller).toMatchObject({ offset: 100, hasMore: true, phase: "ready" });
    expect(await loadOrders(store, SHOP, "more")).toBe(true);
    expect(store.getState().order.orders.map((r) => r.id)).toEqual([orderId("S0")]);
  });

  it("forgets the list when another shop is picked (resetOrders)", async () => {
    installMockNode(sellerWorld());
    const store = createAppStore();
    await loadOrders(store, SHOP, "first");
    store.dispatch({ type: "order/resetOrders" });
    expect(store.getState().order.orders).toHaveLength(0);
    expect(store.getState().order.seller.phase).toBe("idle");
  });
});

describe("the seller's status update", () => {
  async function loaded() {
    const world = makeWorld({ shops: 2, me: { name: SELLER, address: "QSeller", publicKey: "SellerPK" } });
    addOrder(world, "S1", 2001, { buyer: "Buyer 1" });
    const node = installMockNode(world);
    const store = createAppStore();
    await loadOrders(store, SHOP, "first");
    const order = store.getState().order.hashMapOrders[orderId("S1")];
    return { node, store, order };
  }

  it("shows the new status at once and keeps it when the publish goes through", async () => {
    const { node, store, order } = await loaded();
    let resolvePublish: (v: unknown) => void = () => {};
    node.q.on("PUBLISH_QDN_RESOURCE", () => new Promise((r) => (resolvePublish = r)));
    const sending = sendOrderStatus(store, {
      order,
      seller: SELLER,
      sellerPublicKey: "SellerPK",
      status: "Shipped",
      note: "Sent",
    });
    await vi.waitFor(() => expect(node.q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(store.getState().order.statuses[order.id]).toMatchObject({ status: "Shipped", note: "Sent", sending: true });
    // A refresh that still reads the old (missing) document doesn't undo it.
    store.dispatch(statusesLoaded([{ orderId: order.id, info: { state: "known", status: "Received", note: "", updated: 0 } }]));
    expect(store.getState().order.statuses[order.id].status).toBe("Shipped");
    resolvePublish({ signature: "x" });
    expect(await sending).toBe("sent");
    expect(store.getState().order.statuses[order.id]).toMatchObject({ status: "Shipped", sending: false });
    const pub = node.q.callsFor("PUBLISH_QDN_RESOURCE")[0];
    expect(pub).toMatchObject({ identifier: statusId("S1"), name: SELLER, service: "DOCUMENT_PRIVATE", encrypt: true });
    expect(pub.publicKeys).toEqual(["QBuyer1Address-pk", "SellerPK"]);
  });

  it("puts the old status back, quietly, when the seller declines in Hub", async () => {
    const { node, store, order } = await loaded();
    node.q.on("PUBLISH_QDN_RESOURCE", async () => {
      throw { error: "User declined request" };
    });
    const before = store.getState().order.statuses[order.id];
    expect(
      await sendOrderStatus(store, { order, seller: SELLER, sellerPublicKey: "SellerPK", status: "Refunded", note: "" })
    ).toBe("declined");
    expect(store.getState().order.statuses[order.id]).toEqual(before);
  });

  it("puts the old status back when the publish fails", async () => {
    const { node, store, order } = await loaded();
    node.q.on("PUBLISH_QDN_RESOURCE", async () => {
      throw new Error("Insufficient balance");
    });
    expect(
      await sendOrderStatus(store, { order, seller: SELLER, sellerPublicKey: "SellerPK", status: "Shipped", note: "" })
    ).toBe("failed");
    expect(store.getState().order.statuses[order.id].status).toBe("Received");
  });
});
