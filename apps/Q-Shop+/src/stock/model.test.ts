import { describe, expect, it } from "vitest";
import { countedOrders, newStock, orderUidOf, parseStockNote, productUidOf, soldSince, stockLeft, stockNote, stockOf, type StockNote } from "./model";

const P1 = "q-store-product-my-shop-PRODxxxxx1";
const P2 = "q-store-product-my-shop-PRODxxxxx2";
const counted = { stock: { v: 1, quantity: 5, since: 1000 } };

describe("stock counts", () => {
  it("reads a well-formed count and nothing else", () => {
    expect(stockOf(counted)).toEqual({ v: 1, quantity: 5, since: 1000 });
    expect(stockOf({ stock: { quantity: 2, since: 5, voided: ["ORDERxxxx1", "bad id!", 3] } })).toEqual({ v: 1, quantity: 2, since: 5, voided: ["ORDERxxxx1"] });
    expect(stockOf({})).toBeNull();
    expect(stockOf({ stock: { quantity: -1, since: 5 } })).toBeNull();
    expect(stockOf({ stock: { quantity: 1.5, since: 5 } })).toBeNull();
    expect(stockOf({ stock: { quantity: 1, since: 0 } })).toBeNull();
    expect(newStock(7.9, 42)).toEqual({ v: 1, quantity: 7, since: 42 });
  });

  it("takes the uids from product and order ids (short shop ids may hold dashes)", () => {
    expect(productUidOf("q-store-product-my-shop-2-ABCDEFGHIJ")).toBe("ABCDEFGHIJ");
    expect(orderUidOf("q-store-order-my-shop-ORDERxxxx1")).toBe("ORDERxxxx1");
    expect(productUidOf("q-store-catalogue-x-1")).toBeNull();
  });

  it("writes a note of the counted lines only, and none for an order without them", () => {
    expect(
      stockNote([
        { productId: P1, quantity: 2, product: counted },
        { productId: P2, quantity: 1, product: {} },
      ])
    ).toBe("stock:PRODxxxxx1x2");
    expect(stockNote([{ productId: P2, quantity: 1, product: {} }])).toBeNull();
    // At most Core's 240 characters: the lines that fit.
    const many = Array.from({ length: 30 }, (_, i) => ({ productId: `q-store-product-s-P${String(i).padStart(9, "0")}`, quantity: 3, product: counted }));
    const note = stockNote(many) as string;
    expect(note.length).toBeLessThanOrEqual(240);
    expect(parseStockNote(note).size).toBe(18);
  });

  it("reads a note, and nothing from other descriptions", () => {
    expect([...parseStockNote("stock:PRODxxxxx1x2;PRODxxxxx2x10")]).toEqual([
      ["PRODxxxxx1", 2],
      ["PRODxxxxx2", 10],
    ]);
    expect(parseStockNote("Favourite shop").size).toBe(0);
    expect(parseStockNote("stock:bad entry;PRODxxxxx1x0").size).toBe(0);
    expect(parseStockNote(undefined).size).toBe(0);
  });

  it("counts the orders since the count was set, without the voided ones", () => {
    const notes: StockNote[] = [
      { orderUid: "ORDERxxxx1", buyer: "Ann", created: 900, items: new Map([["PRODxxxxx1", 9]]) },
      { orderUid: "ORDERxxxx2", buyer: "Bob", created: 1100, items: new Map([["PRODxxxxx1", 2]]) },
      { orderUid: "ORDERxxxx3", buyer: "Cat", created: 1200, items: new Map([["PRODxxxxx1", 1], ["PRODxxxxx2", 4]]) },
      { orderUid: "ORDERxxxx4", buyer: "Troll", created: 1300, items: new Map([["PRODxxxxx1", 99]]) },
    ];
    const stock = { v: 1 as const, quantity: 5, since: 1000, voided: ["ORDERxxxx4"] };
    expect(soldSince(stock, P1, notes)).toBe(3);
    expect(stockLeft(stock, 3)).toBe(2);
    expect(stockLeft(stock, 9)).toBe(0);
    expect(countedOrders(stock, P1, notes).map((o) => [o.buyer, o.quantity])).toEqual([
      ["Troll", 99],
      ["Cat", 1],
      ["Bob", 2],
    ]);
  });
});
