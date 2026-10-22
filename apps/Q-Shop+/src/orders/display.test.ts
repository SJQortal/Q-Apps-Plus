import { describe, expect, it } from "vitest";
import { chair, mug, poster } from "../test/fixtures/shop";
import { countLabel, countStatuses, normalizeStatus, statusColor, statusLabel } from "./status";
import { deliveryLines, isDigitalOrder, itemSummary, orderCoinSettings, orderItems, orderTotal } from "./format";
import { paymentSummary, paymentWarnings } from "./payment";
import { visibleItems } from "./listView";
import { orderJson } from "./testing";
import type { OrderListItem } from "./selectors";

describe("statuses", () => {
  it("reads the three statuses whatever their case or spaces", () => {
    expect(normalizeStatus(" Refunded")).toBe("Refunded");
    expect(normalizeStatus("shipped")).toBe("Shipped");
    expect(normalizeStatus("Lost")).toBeNull();
    expect(statusColor(" Refunded")).toBe("error");
    expect(statusColor("Shipped")).toBe("success");
    expect(statusColor("Received")).toBe("warning");
    expect(statusLabel("Received", "seller")).toBe("To handle");
    expect(statusLabel("Received", "buyer")).toBe("Received");
  });

  it("counts loaded statuses and shows + while more pages exist", () => {
    const known = (status: string) => ({ state: "known" as const, status, note: "", updated: 0 });
    const counts = countStatuses(["a", "b", "c", "d"], {
      a: known("Shipped"),
      b: known("Received"),
      c: { ...known(""), state: "error" },
    });
    expect(counts).toEqual({ Received: 1, Shipped: 1, Refunded: 0, unknown: 2 });
    expect(countLabel(3, true)).toBe("3+");
    expect(countLabel(3, false)).toBe("3");
  });
});

describe("order display", () => {
  const order = {
    ...orderJson({
      lines: [
        { product: mug, quantity: 2, unit: 1.5 },
        { product: poster, quantity: 1, unit: 0.1 },
        { product: chair, quantity: 1, unit: 12 },
      ],
    }),
    user: "B",
    id: "x",
    created: 1,
    updated: 1,
  } as any;

  it("lists the lines as written, with their pictures", () => {
    const items = orderItems(order);
    expect(items.map((i) => [i.title, i.quantity, i.pricePerUnit, i.totalProductPrice])).toEqual([
      ["Mug", 2, 1.5, 3],
      ["Poster", 1, 0.1, 0.1],
      ["Chair", 1, 12, 12],
    ]);
    expect(items[0].image).toBe(mug.images[0]);
    expect(itemSummary(items)).toBe("Mug × 2, Poster and 1 more");
    expect(orderTotal(order)).toBe("15.10000000");
  });

  it("knows a physical order and labels its address", () => {
    expect(isDigitalOrder(order)).toBe(false);
    expect(isDigitalOrder({ ...orderJson(), user: "B", id: "y", created: 1, updated: 1 } as any)).toBe(true);
    const physical = { ...orderJson({ physical: true }), user: "B", id: "z", created: 1, updated: 1 } as any;
    expect(deliveryLines(physical).map((l) => l.label)).toEqual([
      "Name",
      "Street address",
      "City",
      "Region",
      "Country",
      "Postcode",
      "Delivery note",
    ]);
    physical.delivery.shippingAddress = {
      streetAddress: "1 Main St",
      city: "Austin",
      state: "Texas",
      country: "United States",
      zipCode: "73301",
      deliveryNote: "",
    };
    expect(deliveryLines(physical).find((l) => l.label === "State")?.value).toBe("Texas");
  });

  it("names an asset the order was paid in", () => {
    expect(orderCoinSettings({ payment: { currency: "ASSET:7", assetName: "Gold", total: "1" } } as any)).toEqual({
      acceptedAssets: [{ id: 7, name: "Gold" }],
    });
    expect(orderCoinSettings({ payment: { currency: "QORT", total: "1" } } as any)).toBeNull();
  });
});

describe("payments", () => {
  it("says how each coin was paid", () => {
    expect(paymentSummary({ total: "1", currency: "QORT", transactionSignature: "SIG", arrrAddressUsed: "" })).toMatchObject({
      kind: "qort",
      signature: "SIG",
    });
    expect(paymentSummary({ total: "1", currency: "ARRR", transactionSignature: null, arrrAddressUsed: "zs1" })).toMatchObject({
      kind: "foreign",
      addressPaid: "zs1",
      signature: null,
    });
    expect(paymentSummary({ total: "1", currency: "DOGE", foreignAddressUsed: "D1", foreignTxid: "T" } as any)).toMatchObject({
      addressPaid: "D1",
      txid: "T",
    });
    expect(
      paymentSummary({ total: "1", currency: "ASSET:5", assetId: 5, assetName: "Gold", transactionSignature: "S" } as any)
    ).toMatchObject({
      kind: "asset",
      assetId: 5,
      signature: "S",
    });
  });

  it("flags a transaction that doesn't match the order", () => {
    const payment = { total: "3.00000000", currency: "QORT", transactionSignature: "S" };
    const good = { type: "PAYMENT", amount: "3.00000000", recipient: "QS", creatorAddress: "QB" };
    expect(paymentWarnings(good, payment, { sellerAddress: "QS", buyerAddress: "QB" })).toEqual([]);
    expect(paymentWarnings({ ...good, amount: "2.99999999" }, payment)).toEqual(["The amount sent is not the order total."]);
    expect(paymentWarnings({ ...good, type: "ARBITRARY" }, payment)).toHaveLength(1);
    const asset = { total: "2", currency: "ASSET:5", assetId: 5, transactionSignature: "S" } as any;
    expect(paymentWarnings({ type: "TRANSFER_ASSET", amount: "2", assetId: 6 }, asset)).toEqual([
      "This transfer is of another asset.",
    ]);
  });
});

describe("list filters", () => {
  const item = (id: string, user: string, status: string | null): OrderListItem => ({
    row: { id, user, created: 1, updated: 1 },
    order: null,
    openState: null,
    status: status === null ? null : { state: "known", status, note: "", updated: 0 },
  });
  const items = [item("1", "Ann", "Shipped"), item("2", "Bo", "Received"), item("3", "Cy", null), item("4", "Di", "Refunded")];

  it("puts the seller's orders to handle first in All, and filters by status and buyer", () => {
    expect(visibleItems(items, { filter: "all", role: "seller" }).map((i) => i.row.id)).toEqual(["2", "3", "1", "4"]);
    expect(visibleItems(items, { filter: "all", role: "buyer" }).map((i) => i.row.id)).toEqual(["1", "2", "3", "4"]);
    expect(visibleItems(items, { filter: "Received", role: "seller" }).map((i) => i.row.id)).toEqual(["2"]);
    expect(visibleItems(items, { filter: "all", role: "seller", search: " d" }).map((i) => i.row.id)).toEqual(["4"]);
  });
});
