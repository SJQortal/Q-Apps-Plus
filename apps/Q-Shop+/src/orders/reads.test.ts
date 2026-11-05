import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installQortalMock } from "../test/qortalMock";
import { BUYER, BUYER_ADDRESS, BUYER_PK, SELLER, encodeData64 } from "../test/fixtures/shop";
import {
  buyerStatusIndex,
  fetchPaymentTransaction,
  fetchRetry,
  findStatusRow,
  openOrderOnce,
  readStatus,
  resetOrderReadCaches,
  resolveStatuses,
  searchBuyerOrders,
  searchShopOrders,
  shopStatusIndex,
} from "./reads";
import { orderId, orderJson, statusId } from "./testing";

function stubSearch(rows: any[] | ((url: string) => any[])) {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () => (typeof rows === "function" ? rows(url) : rows),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function params(url: string) {
  return new URLSearchParams(url.split("?")[1]);
}

const row = (identifier: string, name: string, created = 1, updated = created) => ({
  identifier,
  name,
  service: "DOCUMENT_PRIVATE",
  created,
  updated,
});

beforeEach(() => {
  resetOrderReadCaches();
  fetchRetry.delaysMs = [0, 0, 0];
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchRetry.delaysMs = [2000, 4000, 8000];
});

describe("order searches", () => {
  it("pages the buyer's own orders by identifier prefix and name, never query=", async () => {
    const fetchMock = stubSearch([row(orderId("A"), BUYER), row(orderId("B"), "Someone Else"), row("q-store-order-", BUYER)]);
    const page = await searchBuyerOrders(BUYER, 40);
    const p = params(fetchMock.mock.calls[0][0]);
    expect(Object.fromEntries(p)).toEqual({
      mode: "ALL",
      service: "DOCUMENT_PRIVATE",
      identifier: "q-store-order-",
      name: BUYER,
      limit: "20",
      offset: "40",
      includemetadata: "false",
      reverse: "true",
      exactmatchnames: "true",
      prefix: "true",
    });
    expect(p.has("query")).toBe(false);
    // Another name's row and a malformed id are dropped; the offset moves by what the node returned.
    expect(page.rows.map((r) => r.id)).toEqual([orderId("A")]);
    expect(page.read).toBe(3);
    expect(page.hasMore).toBe(false);
  });

  it("reads a shop's orders for every buyer and drops shops whose id only starts the same (my-shop-2)", async () => {
    const raw = Array.from({ length: 20 }, (_, i) =>
      i % 2 ? row(orderId(`X${i}`, "my-shop-2"), `Buyer ${i}`) : row(orderId(`X${i}`), `Buyer ${i}`)
    );
    const fetchMock = stubSearch(raw);
    const page = await searchShopOrders("my-shop", 0);
    const p = params(fetchMock.mock.calls[0][0]);
    expect(p.get("identifier")).toBe("q-store-order-my-shop-");
    expect(p.get("prefix")).toBe("true");
    expect(p.has("name")).toBe(false);
    expect(p.get("limit")).toBe("20");
    expect(page.rows).toHaveLength(10);
    expect(page.rows.every((r) => r.id.startsWith("q-store-order-my-shop-X"))).toBe(true);
    // 20 raw rows: there may be more, and the next page starts at 20.
    expect(page.read).toBe(20);
    expect(page.hasMore).toBe(true);
  });
});

describe("opening an order", () => {
  it("fetches and decrypts once, then answers from the cache by buyer and identifier", async () => {
    const q = installQortalMock({
      FETCH_QDN_RESOURCE: async () => "ENC",
      DECRYPT_DATA: async () => encodeData64(orderJson()),
    });
    const r = { id: orderId("A"), user: BUYER, created: 5, updated: 6 };
    const first = await openOrderOnce(r);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.order).toMatchObject({ id: r.id, user: BUYER, created: 5, updated: 6, sellerName: SELLER, isValid: true });
    }
    await openOrderOnce(r);
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(1);
    // Same identifier under another name: not the same order.
    await openOrderOnce({ ...r, user: "Copycat" });
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(2);
    // Updated since: read again.
    await openOrderOnce({ ...r, updated: 7 });
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(3);
  });

  it("tells a missing resource from one that can't be decrypted or isn't an order", async () => {
    const r = { id: orderId("A"), user: BUYER, created: 1, updated: 1 };
    installQortalMock({ FETCH_QDN_RESOURCE: async () => ({ error: 1401, message: "not found" }) });
    expect(await openOrderOnce(r)).toEqual({ ok: false, stage: "fetch" });
    installQortalMock({ FETCH_QDN_RESOURCE: async () => '{"error":1401}' });
    expect(await openOrderOnce(r)).toEqual({ ok: false, stage: "fetch" });
    installQortalMock({
      FETCH_QDN_RESOURCE: async () => "ENC",
      DECRYPT_DATA: async () => Promise.reject(new Error("Unable to decrypt")),
    });
    expect(await openOrderOnce(r)).toEqual({ ok: false, stage: "decrypt" });
    installQortalMock({ FETCH_QDN_RESOURCE: async () => "ENC", DECRYPT_DATA: async () => encodeData64({ hello: 1 }) });
    expect(await openOrderOnce(r)).toEqual({ ok: false, stage: "invalid" });
  });
});

describe("statuses", () => {
  it("indexes a shop's statuses with one bounded search under the seller's name", async () => {
    const fetchMock = stubSearch([
      row(statusId("A"), SELLER, 1, 10),
      row(statusId("A"), SELLER, 1, 20),
      row(statusId("B", "my-shop-2"), SELLER),
      row(statusId("C"), "Impostor"),
    ]);
    const index = await shopStatusIndex(SELLER, "my-shop");
    const p = params(fetchMock.mock.calls[0][0]);
    expect(p.get("identifier")).toBe("q-store-status-order-my-shop-");
    expect(p.get("prefix")).toBe("true");
    expect(p.getAll("name")).toEqual([SELLER]);
    expect(p.get("limit")).toBe("100");
    expect(index.complete).toBe(true);
    expect([...index.rows.keys()]).toEqual([orderId("A")]);
    expect(index.rows.get(orderId("A"))?.updated).toBe(20);
  });

  it("searches a page of the buyer's statuses once, over the page's sellers, and keeps each seller's own", async () => {
    const fetchMock = stubSearch([
      row(statusId("A"), SELLER),
      row(statusId("B", "shop-1"), SELLER), // B belongs to Seller 1: Seller Name can't speak for it
      row(statusId("B", "shop-1"), "Seller 1"),
    ]);
    const index = await buyerStatusIndex([
      { id: orderId("A"), seller: SELLER },
      { id: orderId("B", "shop-1"), seller: "Seller 1" },
      { id: orderId("C"), seller: SELLER },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const p = params(fetchMock.mock.calls[0][0]);
    expect(p.get("identifier")).toBe("q-store-status-order-");
    // Sorted, so the same page asks the same URL (and hits the cache).
    expect(p.getAll("name")).toEqual(["Seller 1", SELLER]);
    expect(index.rows.get(orderId("B", "shop-1"))?.name).toBe("Seller 1");
    expect(index.rows.has(orderId("C"))).toBe(false);
  });

  it("reads a status as the original (FETCH by the seller, the buyer's key, DECRYPT_DATA), looking the key up once per buyer", async () => {
    const q = installQortalMock({
      FETCH_QDN_RESOURCE: async (p) => `ENC:${p.identifier}`,
      GET_NAME_DATA: async () => ({ name: BUYER, owner: BUYER_ADDRESS }),
      GET_ACCOUNT_DATA: async () => ({ address: BUYER_ADDRESS, publicKey: BUYER_PK }),
      DECRYPT_DATA: async (p) =>
        encodeData64(
          String(p.encryptedData).endsWith("A") ? { status: "Shipped", note: "Tracking" } : { status: " Refunded", note: "" }
        ),
    });
    const index = {
      complete: true,
      rows: new Map([
        [orderId("A"), row(statusId("A"), SELLER, 1, 9)],
        [orderId("B"), row(statusId("B"), SELLER, 1, 9)],
      ]),
    };
    const seen: Record<string, any> = {};
    await resolveStatuses(
      ["A", "B", "C"].map((uid) => ({ orderId: orderId(uid), seller: SELLER, buyer: BUYER })),
      index,
      (id, info) => (seen[id] = info)
    );
    expect(seen[orderId("A")]).toEqual({ state: "known", status: "Shipped", note: "Tracking", updated: 9 });
    // " Refunded" (the original's typo in its colour check) reads as Refunded.
    expect(seen[orderId("B")].status).toBe("Refunded");
    // No document and a complete index: Received, with no Hub call.
    expect(seen[orderId("C")]).toEqual({ state: "known", status: "Received", note: "", updated: 0 });
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(2);
    expect(q.callsFor("GET_NAME_DATA")).toEqual([{ action: "GET_NAME_DATA", name: BUYER }]);
    expect(q.callsFor("GET_ACCOUNT_DATA")).toHaveLength(1);
    expect(q.callsFor("DECRYPT_DATA")[0]).toEqual({
      action: "DECRYPT_DATA",
      encryptedData: `ENC:${statusId("A")}`,
      publicKey: BUYER_PK,
    });
  });

  it("looks an order up on its own when the index is incomplete", async () => {
    const fetchMock = stubSearch([]);
    const seen: Record<string, any> = {};
    await resolveStatuses(
      [{ orderId: orderId("Z"), seller: SELLER, buyer: BUYER }],
      { complete: false, rows: new Map() },
      (id, info) => (seen[id] = info)
    );
    const p = params(fetchMock.mock.calls[0][0]);
    expect(p.get("identifier")).toBe(statusId("Z"));
    expect(p.get("name")).toBe(SELLER);
    expect(p.get("limit")).toBe("1");
    expect(p.has("prefix")).toBe(false);
    expect(seen[orderId("Z")].status).toBe("Received");
  });

  it("only trusts a status row published by the seller", async () => {
    stubSearch([row(statusId("Z"), "Impostor")]);
    expect(await findStatusRow(SELLER, orderId("Z"))).toBeNull();
  });

  it("gives an error status, not a rejection, when a status can't be read", async () => {
    installQortalMock({
      FETCH_QDN_RESOURCE: async () => "ENC",
      GET_NAME_DATA: async () => ({ owner: BUYER_ADDRESS }),
      GET_ACCOUNT_DATA: async () => ({ publicKey: BUYER_PK }),
      DECRYPT_DATA: async () => Promise.reject(new Error("no")),
    });
    expect(await readStatus(SELLER, row(statusId("A"), SELLER, 1, 3), BUYER)).toEqual({
      state: "error",
      status: "",
      note: "",
      updated: 3,
    });
  });
});

describe("payment transactions", () => {
  it("reads a transaction by signature, encoded, and rejects Core's error body", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes("GOOD") ? { type: "PAYMENT", amount: "3.00000000" } : { error: 135, message: "unknown" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchPaymentTransaction("GOOD/1")).toEqual({ type: "PAYMENT", amount: "3.00000000" });
    expect(fetchMock.mock.calls[0][0]).toBe("/transactions/signature/GOOD%2F1");
    await expect(fetchPaymentTransaction("BAD")).rejects.toThrow();
  });
});
