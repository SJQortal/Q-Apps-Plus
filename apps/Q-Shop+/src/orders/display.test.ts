import { describe, expect, it } from "vitest";
import { chair, mug, poster } from "../test/fixtures/shop";
import { countLabel, countStatuses, normalizeStatus, statusColor, statusLabel } from "./status";
import {
  deliveryLines,
  displaySafeOrder,
  isDigitalOrder,
  itemSummary,
  orderCoinSettings,
  orderItems,
  orderTotal,
} from "./format";
import { orderCoinOf, paymentSummary, paymentWarnings, shopPaymentWarnings, transactionCoin } from "./payment";
import { sellerRowKind, sellerStatusCounts, splitSellerItems, visibleItems } from "./listView";
import { orderJson } from "./testing";
import type { OrderListItem } from "./selectors";

describe("statuses", () => {
  it("reads the three statuses whatever their case or spaces", () => {
    expect(normalizeStatus(" Refunded")).toBe("Refunded");
    expect(normalizeStatus("shipped")).toBe("Shipped");
    expect(normalizeStatus("Lost")).toBeNull();
    expect(statusColor(" Refunded")).toBe("error");
    expect(statusColor("Shipped")).toBe("primary");
    expect(statusColor("Delivered")).toBe("success");
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
    expect(counts).toEqual({ Received: 1, Shipped: 1, Delivered: 0, Refunded: 0, unknown: 2 });
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

  it("keeps text fields as text, so a malformed order can't break a render", () => {
    const safe = displaySafeOrder({
      id: "x",
      user: "B",
      created: 1,
      updated: 1,
      storeName: { evil: 1 },
      sellerName: 5,
      details: "nope",
      payment: { total: {}, currency: 3, transactionSignature: [], arrrAddressUsed: 9, assetId: "7", assetName: {} },
    } as any);
    expect(safe).toMatchObject({ storeName: undefined, sellerName: undefined, details: undefined });
    expect(safe.payment).toMatchObject({
      total: undefined,
      currency: "",
      transactionSignature: null,
      arrrAddressUsed: undefined,
      assetId: undefined,
      assetName: undefined,
    });
    const good = { ...orderJson(), user: "B", id: "y", created: 1, updated: 1 } as any;
    expect(displaySafeOrder(good)).toEqual({
      ...good,
      payment: {
        ...good.payment,
        foreignAddressUsed: undefined,
        foreignTxid: undefined,
        assetId: undefined,
        assetName: undefined,
      },
    });
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
    // A coin Q-Shop+ doesn't take (its test builds offered DOGE): shown with what the order says, never checked.
    expect(paymentSummary({ total: "1", currency: "DOGE", foreignAddressUsed: "D1", foreignTxid: "T" } as any)).toMatchObject({
      kind: "foreign",
      known: false,
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

describe("payments checked against the seller's shop", () => {
  const qortOnly = { supportedCoins: ["QORT"], foreignCoins: { ARRR: "" } };
  const withGold = { ...qortOnly, acceptedAssets: [{ id: 42, name: "Gold" }] };
  const withArrr = { supportedCoins: ["QORT", "ARRR"], foreignCoins: { ARRR: "zs1shop" } };

  it("reads the coin strictly", () => {
    expect(orderCoinOf({ currency: "QORT" } as any)).toEqual({ coin: "QORT", known: true });
    expect(orderCoinOf({ currency: " qort " } as any)).toEqual({ coin: "QORT", known: true });
    expect(orderCoinOf({ currency: "" } as any)).toEqual({ coin: "QORT", known: true });
    expect(orderCoinOf({ currency: "asset:42" } as any)).toEqual({ coin: "ASSET:42", known: true });
    expect(orderCoinOf({ currency: "arrr" } as any)).toEqual({ coin: "ARRR", known: true });
    expect(orderCoinOf({ currency: "btc" } as any)).toEqual({ coin: "btc", known: false });
    expect(orderCoinOf({ currency: "QORT2" } as any)).toEqual({ coin: "QORT2", known: false });
    // The currency decides, not a stray asset id.
    expect(paymentSummary({ currency: "QORT", assetId: 5 } as any).kind).toBe("qort");
    expect(paymentSummary({ currency: "QORT2" } as any)).toMatchObject({ kind: "foreign", known: false });
  });

  it("warns when the shop doesn't accept the asset or coin the order names", () => {
    // A worthless asset the buyer issued, called "QORT" in the order.
    const spoof = { currency: "ASSET:9999", assetId: 9999, assetName: "QORT", total: "50.00000000" } as any;
    expect(shopPaymentWarnings(spoof, qortOnly)).toEqual([
      "This order was paid in asset #9999, which your shop doesn't accept.",
    ]);
    expect(shopPaymentWarnings({ currency: "ASSET:42", assetId: 42, assetName: "Fake" } as any, withGold)).toEqual([]);
    expect(shopPaymentWarnings({ currency: "ARRR", arrrAddressUsed: "zs1shop" } as any, qortOnly)).toEqual([
      "This order was paid in ARRR, which your shop doesn't accept.",
    ]);
    expect(shopPaymentWarnings({ currency: "ARRR", arrrAddressUsed: "zs1shop" } as any, withArrr)).toEqual([]);
    expect(shopPaymentWarnings({ currency: "ARRR", arrrAddressUsed: "zs1other" } as any, withArrr)).toEqual([
      "The ARRR address in this order isn't your shop's current ARRR address.",
    ]);
    // A coin Q-Shop+ doesn't take, even one the shop still names.
    const withBtc = { supportedCoins: ["QORT", "BTC"], foreignCoins: { BTC: "bc1shop" } };
    expect(shopPaymentWarnings({ currency: "BTC", foreignAddressUsed: "bc1shop" } as any, withBtc)).toEqual([
      "This order names a coin Q-Shop+ doesn't know, so its payment can't be checked here.",
    ]);
    expect(shopPaymentWarnings({ currency: "QORT" } as any, qortOnly)).toEqual([]);
    // A coin the app doesn't know is flagged even when the shop isn't known.
    expect(shopPaymentWarnings({ currency: "QORT2" } as any, null)).toHaveLength(1);
    expect(shopPaymentWarnings(spoof, null)).toEqual([]);
  });

  it("checks the node's name for the asset against the shop's, and names the coin a transaction moved", () => {
    const gold = { total: "2", currency: "ASSET:42", assetId: 42, transactionSignature: "S" } as any;
    const tx = { type: "TRANSFER_ASSET", amount: "2", assetId: 42, assetName: "Gold" };
    expect(paymentWarnings(tx, gold, { shop: withGold })).toEqual([]);
    expect(paymentWarnings({ ...tx, assetName: "Lead" }, gold, { shop: withGold })).toEqual([
      "The node calls asset #42 “Lead”, not “Gold” as your shop lists it.",
    ]);
    expect(transactionCoin(tx)).toEqual({ coin: "ASSET:42", settings: { acceptedAssets: [{ id: 42, name: "Gold" }] } });
    expect(transactionCoin({ type: "TRANSFER_ASSET", assetId: 7 })).toEqual({
      coin: "ASSET:7",
      settings: { acceptedAssets: [{ id: 7, name: "Asset #7" }] },
    });
    expect(transactionCoin({ type: "TRANSFER_ASSET", assetId: 0 })).toEqual({ coin: "QORT", settings: null });
    expect(transactionCoin({ type: "PAYMENT", amount: "1" })).toEqual({ coin: "QORT", settings: null });
    expect(transactionCoin({ amount: "1" })).toBeNull();
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

  it("counts as To handle only opened orders naming the seller; rows it can't open or another seller's stay apart", () => {
    const SELLER = "Seller Name";
    const opened = (id: string, status: string | null, sellerName: string | undefined = SELLER): OrderListItem => ({
      ...item(id, "Buyer", status),
      order: { id, user: "Buyer", created: 1, updated: 1, sellerName },
    });
    const rows: OrderListItem[] = [
      opened("mine-received", "Received"),
      opened("mine-shipped", "Shipped"),
      // Same short id under another owner: the order opens but names them (status "Received": no document).
      opened("foreign", "Received", "Other Owner"),
      { ...opened("nameless", "Received"), order: { id: "nameless", user: "Buyer", created: 1, updated: 1 } },
      // Not decryptable or not on the node.
      { ...item("unreadable", "X", "Received"), openState: "unreadable" },
      { ...item("unavailable", "Y", "Received"), openState: "unavailable" },
      // Not opened yet: the seller's own Refunded settles it; a bare "Received" waits for the order.
      item("pending-refunded", "Z", "Refunded"),
      item("pending-received", "W", "Received"),
      opened("mine-other-case", "Received", "seller name"),
    ];
    expect(sellerRowKind(rows[0], SELLER)).toBe("mine");
    expect(sellerRowKind(rows[2], SELLER)).toBe("other");
    expect(sellerRowKind(rows[7], SELLER)).toBe("pending");
    const { main, others } = splitSellerItems(rows, SELLER);
    expect(others.map((i) => i.row.id)).toEqual(["foreign", "nameless", "unreadable", "unavailable"]);
    expect(sellerStatusCounts(main, SELLER)).toEqual({
      counts: { Received: 2, Shipped: 1, Delivered: 0, Refunded: 1, unknown: 1 },
      loading: true,
    });
    expect(visibleItems(main, { filter: "Received", role: "seller", seller: SELLER }).map((i) => i.row.id)).toEqual([
      "mine-received",
      "mine-other-case",
    ]);
    expect(visibleItems(main, { filter: "Refunded", role: "seller", seller: SELLER }).map((i) => i.row.id)).toEqual([
      "pending-refunded",
    ]);
    // Once the last pending order opens, nothing is left undecided.
    const settled = main.map((i) => (i.row.id === "pending-received" ? opened("pending-received", "Received") : i));
    expect(sellerStatusCounts(settled, SELLER)).toEqual({
      counts: { Received: 3, Shipped: 1, Delivered: 0, Refunded: 1, unknown: 0 },
      loading: false,
    });
  });
});
