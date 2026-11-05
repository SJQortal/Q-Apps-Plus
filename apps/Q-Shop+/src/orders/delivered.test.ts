/**
 * The buyer's "Delivered" (orders/delivered.ts): its identifier and publish,
 * how it shows over the seller's status, and how the lists read it (one
 * search each, matched to the order's own buyer and shop).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppStore } from "../state/store";
import { installMockNode, makeWorld, type World } from "../test/mockNode";
import { BUYER, SELLER } from "../test/fixtures/shop";
import { deliveredIdentifierForOrder, orderIdForDelivered, shopDeliveredPrefix } from "../qdn/identifiers";
import { buildDeliveredPublish, base64ToJson } from "../qdn/payloads";
import { loadOrders, type ListOwner } from "./loader";
import { fetchRetry, resetOrderReadCaches } from "./reads";
import { selectBuyerItems, selectSellerItems } from "./selectors";
import { shownStatus } from "./status";
import { markDelivered } from "./delivered";
import { addDelivered, addOrder, addStatus, orderId } from "./testing";

const BUYER_LIST: ListOwner = { kind: "buyer", name: BUYER };
const SHOP: ListOwner = { kind: "seller", storeId: "q-store-general-my-shop", shortStoreId: "my-shop", seller: SELLER };
const known = (status: string) => ({ state: "known" as const, status, note: "Tracking 1", updated: 5 });

vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  resetOrderReadCaches();
  fetchRetry.delaysMs = [0, 0, 0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRetry.delaysMs = [2000, 4000, 8000];
});

describe("the buyer's Delivered", () => {
  it("is a small public DOCUMENT under the buyer's name, beside the order's id", () => {
    const id = orderId("ORDERxxxx1");
    expect(deliveredIdentifierForOrder(id)).toBe("q-store-delivered-my-shop-ORDERxxxx1");
    expect(orderIdForDelivered("q-store-delivered-my-shop-ORDERxxxx1")).toBe(id);
    expect(shopDeliveredPrefix("my-shop")).toBe("q-store-delivered-my-shop-");
    const publish = buildDeliveredPublish({ orderId: id, buyer: BUYER, at: 1763000000000 });
    expect({ ...publish, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: BUYER,
      service: "DOCUMENT",
      identifier: "q-store-delivered-my-shop-ORDERxxxx1",
      filename: "delivered.json",
      title: "Delivered",
      data64: undefined,
    });
    expect(base64ToJson(publish.data64)).toEqual({ orderId: id, deliveredAt: 1763000000000 });
  });

  it("shows over Received and Shipped (the seller's note kept), never over Refunded, and waits for the seller's status", () => {
    const at = { at: 9 };
    expect(shownStatus(known("Shipped"), at)).toEqual({ ...known("Shipped"), status: "Delivered" });
    expect(shownStatus(known("Received"), at)?.status).toBe("Delivered");
    expect(shownStatus(known("Refunded"), at)?.status).toBe("Refunded");
    expect(shownStatus(known("Shipped"), null)?.status).toBe("Shipped");
    expect(shownStatus(null, at)).toBeNull();
  });

  it("the buyer's list reads them in one search, and only the order's own buyer's count", async () => {
    const world: World = makeWorld({ shops: 2 });
    addOrder(world, "O00", 1000);
    addOrder(world, "O01", 1001);
    addOrder(world, "O02", 1002);
    addStatus(world, "O00", "Shipped");
    addStatus(world, "O01", "Shipped");
    addStatus(world, "O02", "Refunded");
    addDelivered(world, "O00");
    // Someone else can publish the identifier: it isn't the buyer's word.
    addDelivered(world, "O01", { buyer: "Someone Else" });
    addDelivered(world, "O02");
    const node = installMockNode(world);
    const store = createAppStore();
    await loadOrders(store, BUYER_LIST, "first");
    const searches = node.fetchCalls.filter((u) => u.includes("q-store-delivered"));
    expect(searches).toHaveLength(1);
    const params = new URLSearchParams(searches[0].split("?")[1]);
    expect([params.get("service"), params.get("identifier"), params.getAll("name"), params.get("limit")]).toEqual(["DOCUMENT", "q-store-delivered-", [BUYER], "100"]);
    const shown = Object.fromEntries(selectBuyerItems(store.getState()).map((i) => [i.row.id, i.status?.status]));
    expect(shown).toEqual({ [orderId("O00")]: "Delivered", [orderId("O01")]: "Shipped", [orderId("O02")]: "Refunded" });
    expect(store.getState().order.delivered[orderId("O01")]).toBeNull();
    // The seller's own status is untouched.
    expect(store.getState().order.statuses[orderId("O00")].status).toBe("Shipped");
  });

  it("a shop's list reads every buyer's for the shop, not a shop whose id starts the same", async () => {
    const world: World = makeWorld({ shops: 2 });
    addOrder(world, "S0", 1000, { buyer: "Buyer 0" });
    addOrder(world, "S1", 1001, { buyer: "Buyer 1" });
    addStatus(world, "S0", "Shipped");
    addStatus(world, "S1", "Shipped");
    addDelivered(world, "S0", { buyer: "Buyer 0" });
    addDelivered(world, "S1", { buyer: "Buyer 1", short: "my-shop-2" });
    installMockNode(world);
    const store = createAppStore();
    await loadOrders(store, SHOP, "first");
    const items = selectSellerItems(store.getState());
    expect(Object.fromEntries(items.map((i) => [i.row.id, i.status?.status]))).toEqual({ [orderId("S0")]: "Delivered", [orderId("S1")]: "Shipped" });
  });

  it("marking one shows at once, publishes, and puts it back if Hub declines", async () => {
    const world: World = makeWorld({ shops: 2 });
    addOrder(world, "O00", 1000);
    addStatus(world, "O00", "Shipped");
    const node = installMockNode(world);
    const store = createAppStore();
    await loadOrders(store, BUYER_LIST, "first");
    const order = store.getState().order.hashMapOrders[orderId("O00")];

    node.q.on("PUBLISH_QDN_RESOURCE", async () => {
      throw new Error("User declined request");
    });
    expect(await markDelivered(store, order, 77)).toBe("declined");
    expect(store.getState().order.delivered[orderId("O00")]).toBeNull();

    let during: unknown;
    node.q.on("PUBLISH_QDN_RESOURCE", async () => {
      during = store.getState().order.delivered[orderId("O00")];
      return true;
    });
    expect(await markDelivered(store, order, 78)).toBe("sent");
    expect(during).toEqual({ at: 78, sending: true });
    expect(store.getState().order.delivered[orderId("O00")]).toEqual({ at: 78, sending: false });
    expect(node.q.callsFor("PUBLISH_QDN_RESOURCE").at(-1)).toMatchObject({ name: BUYER, service: "DOCUMENT", identifier: "q-store-delivered-my-shop-O00" });
    expect(selectBuyerItems(store.getState())[0].status?.status).toBe("Delivered");
  });
});
