import { describe, expect, it } from "vitest";
import reducer, {
  addToHashMap,
  listFailed,
  listLoading,
  listPage,
  mergeOrderRows,
  resetOrders,
  statusRestored,
  statusSending,
  statusSent,
  statusesLoaded,
  upsertOrders,
} from "./orderSlice";

const row = (id: string, user = "Buyer", created = 1) => ({ id, user, created, updated: created });
const init = () => reducer(undefined, { type: "init" });

describe("order rows", () => {
  it("keeps one row per order id, the first published when two names use the same id", () => {
    const merged = mergeOrderRows([row("a", "Real", 10)], [row("b"), row("a", "Copycat", 20), row("c")]);
    expect(merged.map((r) => `${r.id}:${r.user}`)).toEqual(["a:Real", "b:Buyer", "c:Buyer"]);
    const earlier = mergeOrderRows([row("a", "Copycat", 20)], [row("a", "Real", 10)]);
    expect(earlier[0].user).toBe("Real");
  });

  it("upsertOrders still merges the seller's rows", () => {
    const state = reducer(reducer(init(), upsertOrders([row("a"), row("b")])), upsertOrders([row("b"), row("c")]));
    expect(state.orders.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("addToHashMap (Bugs 4)", () => {
  it("skips a missing or unreadable order instead of throwing", () => {
    let state = init();
    expect(() => (state = reducer(state, addToHashMap(undefined)))).not.toThrow();
    state = reducer(state, addToHashMap({ ...row("a"), isValid: false } as any));
    expect(state.hashMapOrders).toEqual({});
    state = reducer(state, addToHashMap({ ...row("b"), details: { totalPrice: "1.00000000" } } as any));
    expect(state.hashMapOrders.b.totalPrice).toBe("1.00000000");
  });
});

describe("list pages", () => {
  it("pages from the list's own offset, and a new owner starts over", () => {
    let s = reducer(init(), listLoading({ kind: "buyer", owner: "Me", reset: false }));
    const gen = s.buyer.generation;
    s = reducer(
      s,
      listPage({ kind: "buyer", owner: "Me", generation: gen, rows: [row("a"), row("b")], read: 20, hasMore: true, first: true })
    );
    s = reducer(s, listLoading({ kind: "buyer", owner: "Me", reset: false }));
    expect(s.buyer.loadingMore).toBe(true);
    s = reducer(
      s,
      listPage({ kind: "buyer", owner: "Me", generation: gen, rows: [row("c")], read: 3, hasMore: false, first: false })
    );
    expect(s.buyer).toMatchObject({ offset: 23, hasMore: false, loadingMore: false, phase: "ready" });
    expect(s.myOrders.map((r) => r.id)).toEqual(["a", "b", "c"]);
    // The seller's list is separate.
    expect(s.orders).toEqual([]);
    s = reducer(s, listLoading({ kind: "buyer", owner: "Other", reset: false }));
    expect(s.myOrders).toEqual([]);
    expect(s.buyer).toMatchObject({ owner: "Other", offset: 0, phase: "loading" });
  });

  it("a refresh keeps the rows until page one lands, and drops answers to older loads", () => {
    let s = reducer(init(), listLoading({ kind: "seller", owner: "shop", reset: false }));
    const old = s.seller.generation;
    s = reducer(
      s,
      listPage({ kind: "seller", owner: "shop", generation: old, rows: [row("a")], read: 20, hasMore: true, first: true })
    );
    s = reducer(s, listLoading({ kind: "seller", owner: "shop", reset: true }));
    expect(s.seller.refreshing).toBe(true);
    expect(s.orders).toHaveLength(1);
    expect(s.seller.offset).toBe(20);
    // A next page asked before the refresh lands late: ignored.
    s = reducer(
      s,
      listPage({ kind: "seller", owner: "shop", generation: old, rows: [row("z")], read: 20, hasMore: true, first: false })
    );
    expect(s.orders.map((r) => r.id)).toEqual(["a"]);
    s = reducer(
      s,
      listPage({
        kind: "seller",
        owner: "shop",
        generation: s.seller.generation,
        rows: [row("n"), row("a")],
        read: 2,
        hasMore: false,
        first: true,
      })
    );
    expect(s.orders.map((r) => r.id)).toEqual(["n", "a"]);
    expect(s.seller).toMatchObject({ refreshing: false, offset: 2, hasMore: false });
  });

  it("a failed first page is an error only when nothing is on screen", () => {
    let s = reducer(init(), listLoading({ kind: "buyer", owner: "Me", reset: false }));
    s = reducer(s, listFailed({ kind: "buyer", owner: "Me", generation: s.buyer.generation, first: true }));
    expect(s.buyer.phase).toBe("error");
    s = reducer(s, listLoading({ kind: "buyer", owner: "Me", reset: false }));
    s = reducer(
      s,
      listPage({
        kind: "buyer",
        owner: "Me",
        generation: s.buyer.generation,
        rows: [row("a")],
        read: 20,
        hasMore: true,
        first: true,
      })
    );
    s = reducer(s, listLoading({ kind: "buyer", owner: "Me", reset: false }));
    s = reducer(s, listFailed({ kind: "buyer", owner: "Me", generation: s.buyer.generation, first: false }));
    expect(s.buyer).toMatchObject({ phase: "ready", moreError: true, loadingMore: false });
  });

  it("resetOrders forgets the seller's list but keeps opened orders", () => {
    let s = reducer(init(), upsertOrders([row("a")]));
    s = reducer(s, addToHashMap({ ...row("a"), details: { totalPrice: "1" } } as any));
    s = reducer(s, resetOrders());
    expect(s.orders).toEqual([]);
    expect(s.seller.phase).toBe("idle");
    expect(s.hashMapOrders.a).toBeDefined();
  });
});

describe("statuses", () => {
  const known = (status: string, updated: number) => ({ state: "known" as const, status, note: "", updated });

  it("doesn't let an older document replace the status the seller just sent", () => {
    let s = reducer(init(), statusesLoaded([{ orderId: "a", info: known("Received", 0) }]));
    s = reducer(s, statusSending({ orderId: "a", status: "Shipped", note: "x", sentAt: 1000 }));
    s = reducer(s, statusesLoaded([{ orderId: "a", info: known("Received", 0) }]));
    expect(s.statuses.a.status).toBe("Shipped");
    s = reducer(s, statusSent({ orderId: "a" }));
    s = reducer(s, statusesLoaded([{ orderId: "a", info: known("Received", 500) }]));
    expect(s.statuses.a.status).toBe("Shipped");
    // The published document, read back.
    s = reducer(s, statusesLoaded([{ orderId: "a", info: known("Shipped", 1200) }]));
    expect(s.statuses.a).toEqual(known("Shipped", 1200));
  });

  it("puts the previous status back", () => {
    let s = reducer(init(), statusSending({ orderId: "a", status: "Shipped", note: "", sentAt: 1 }));
    s = reducer(s, statusRestored({ orderId: "a", previous: null }));
    expect(s.statuses.a).toBeUndefined();
    s = reducer(s, statusSending({ orderId: "b", status: "Shipped", note: "", sentAt: 1 }));
    s = reducer(s, statusRestored({ orderId: "b", previous: known("Refunded", 3) }));
    expect(s.statuses.b).toEqual(known("Refunded", 3));
  });
});
