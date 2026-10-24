import { describe, expect, it } from "vitest";
import { priceCheckout } from "../money/checkout";
import type { CartLine } from "../money/order";
import { SHIPPING_REGIONS } from "../constants/shipping";
import { DELIVERY_LINE_ID, deliveryDocOf, isDeliveryLine, quoteDelivery, type DeliveryDoc } from "./model";

const STORE = "q-store-general-my-shop";
const EUROPE = [...SHIPPING_REGIONS[0].codes];
const pricing = { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 1 };
const line = (id: string, qty: number, usd: number, extra: Record<string, unknown> = {}): CartLine => ({
  productId: id,
  catalogueId: "c",
  quantity: qty,
  product: { title: id, type: "physical", price: [{ currency: "qort", value: usd / 0.18 }], fiatPrice: { currency: "USD", value: usd, qort: usd / 0.18 }, ...extra } as never,
});
const doc = (over: Partial<DeliveryDoc> = {}): DeliveryDoc => ({
  v: 1,
  storeId: STORE,
  currency: "USD",
  general: { zones: [{ id: "eu", name: "Europe", countries: EUROPE, first: 5, extra: 1, freeOver: 100 }] },
  profiles: [{ id: "heavy", name: "Heavy items", products: ["anvil"], zones: [{ id: "world", countries: ["IS", "PL", "US"], first: 30 }] }],
  updated: 1,
  ...over,
});
const quote = (d: DeliveryDoc | null, lines: CartLine[], country: string, state = "") => quoteDelivery({ doc: d, lines, country, state, pricing, takesArrr: true });

describe("delivery prices", () => {
  it("charge the zone's first item, then each one more, in the shop's currency with QORT and ARRR from its rates", () => {
    const q = quote(doc(), [line("ghee", 2, 10), line("mask", 1, 20)], "Poland");
    expect(q).toMatchObject({ kind: "charge", fee: 7, currency: "USD", parts: [{ profile: "Delivery", zone: "Europe", items: 3, fee: 7 }] });
    if (q.kind !== "charge") return;
    expect(q.line).toMatchObject({ productId: DELIVERY_LINE_ID, quantity: 1 });
    expect(q.line.product).toMatchObject({ title: "Delivery to Poland", type: "delivery", price: [{ currency: "qort", value: 38.89 }, { currency: "ARRR", value: 28 }] });
    // Checkout's own pricing (money/checkout.ts) charges it as one more line.
    const lines = [line("ghee", 2, 10), line("mask", 1, 20)];
    const { amount, details } = priceCheckout([...lines, q.line], "QORT", null);
    expect(details[DELIVERY_LINE_ID]).toMatchObject({ quantity: 1, pricePerUnit: 38.89, totalProductPrice: 38.89 });
    expect(Number(amount)).toBeCloseTo((2 * 10) / 0.18 + 20 / 0.18 + 38.89, 6);
    expect(isDeliveryLine(DELIVERY_LINE_ID, details[DELIVERY_LINE_ID] as never)).toBe(true);
  });

  it("are free over the zone's amount, for digital products, and without delivery prices", () => {
    expect(quote(doc(), [line("ghee", 10, 10)], "Poland").kind).toBe("free");
    expect(quote(doc(), [line("ebook", 1, 10, { type: "digital" })], "Japan").kind).toBe("free");
    expect(quote(null, [line("ghee", 1, 10)], "Japan").kind).toBe("free");
    // A profile without zones delivers free wherever the shop ships.
    expect(quote(doc({ general: { zones: [] } }), [line("ghee", 1, 10)], "Japan").kind).toBe("free");
  });

  it("price a product in its profile by that profile's zones, and add the groups up", () => {
    const q = quote(doc(), [line("ghee", 1, 10), line("anvil", 1, 50)], "Poland");
    expect(q).toMatchObject({ kind: "charge", fee: 35, parts: [{ profile: "Delivery", fee: 5 }, { profile: "Heavy items", fee: 30 }] });
    if (q.kind === "charge") expect(q.line.product?.title).toBe("Delivery to Poland: Heavy items");
  });

  it("say which products can't go to the address, and need the state in the US when a zone names states", () => {
    expect(quote(doc(), [line("ghee", 1, 10)], "Japan")).toEqual({ kind: "unavailable", titles: ["ghee"] });
    const us = doc({ general: { zones: [{ id: "west", countries: ["US"], states: ["OR", "WA"], first: 8 }] }, profiles: [] });
    expect(quote(us, [line("ghee", 1, 10)], "United States", "Oregon")).toMatchObject({ kind: "charge", fee: 8 });
    expect(quote(us, [line("ghee", 1, 10)], "United States", "Texas").kind).toBe("unavailable");
    // A zone naming the state comes before the whole country's, wherever it is listed.
    const both = doc({ general: { zones: [{ id: "usa", countries: ["US", "CA"], first: 6 }, { id: "west", countries: ["US"], states: ["OR"], first: 4 }] }, profiles: [] });
    expect(quote(both, [line("ghee", 1, 10)], "United States", "Oregon")).toMatchObject({ kind: "charge", fee: 4 });
    expect(quote(both, [line("ghee", 1, 10)], "United States", "Texas")).toMatchObject({ kind: "charge", fee: 6 });
    expect(quote(both, [line("ghee", 1, 10)], "Canada")).toMatchObject({ kind: "charge", fee: 6 });
  });

  it("in QORT need no rates; in a currency the shop no longer prices in, can't be worked out", () => {
    const qort = doc({ currency: "QORT", general: { zones: [{ id: "eu", countries: EUROPE, first: 2.5 }] }, profiles: [] });
    const q = quoteDelivery({ doc: qort, lines: [line("ghee", 1, 10)], country: "Poland", state: "", pricing: null, takesArrr: true });
    expect(q).toMatchObject({ kind: "charge", fee: 2.5 });
    if (q.kind === "charge") expect(q.line.product?.price).toEqual([{ currency: "qort", value: 2.5 }]);
    expect(quoteDelivery({ doc: doc(), lines: [line("ghee", 1, 10)], country: "Poland", state: "", pricing: null, takesArrr: true }).kind).toBe("no-rates");
  });

  it("read only a well-formed document of this shop", () => {
    expect(deliveryDocOf({ ...doc(), storeId: "q-store-general-other" }, STORE)).toBeNull();
    expect(deliveryDocOf({ deleted: true, storeId: STORE, currency: "USD" }, STORE)).toBeNull();
    const parsed = deliveryDocOf(
      { ...doc(), general: { zones: [{ id: "bad", countries: ["XX"], first: 1 }, { id: "ok", countries: ["PL", "XX"], first: -1 }, { id: "ok2", countries: ["PL"], first: 2, states: ["OR"] }] } },
      STORE
    );
    expect(parsed?.general.zones).toEqual([{ id: "ok2", countries: ["PL"], first: 2 }]);
  });
});
