import { describe, expect, it } from "vitest";
import { priceCheckout } from "../money/checkout";
import type { CartLine } from "../money/order";
import { SHIPPING_REGIONS } from "../constants/shipping";
import { DELIVERY_LINE_ID, deliveryDocOf, deliveryOptionsOf, isDeliveryLine, pickupDays, pickupText, quoteDelivery, type DeliveryDoc } from "./model";

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

  it("offer the seller's delivery options: each zone prices the ones it offers, and the line says which was picked", () => {
    const withOptions = doc({
      base: { name: "Standard", note: "5–10 days" },
      options: [
        { id: "exp", name: "Express", note: "1–3 days" },
        { id: "pick", name: "Local pickup", note: "Reykjavik, Saturdays" },
      ],
      general: { zones: [{ id: "eu", name: "Europe", countries: [...EUROPE, "IS"], first: 5, rates: { exp: { first: 15, extra: 2 }, pick: { first: 0 } } }] },
      profiles: [],
    });
    const parsed = deliveryDocOf(JSON.parse(JSON.stringify(withOptions)), STORE);
    expect(parsed?.options).toEqual(withOptions.options);
    expect(parsed?.base).toEqual({ name: "Standard", note: "5–10 days" });
    expect(parsed?.general.zones[0].rates).toEqual({ exp: { first: 15, extra: 2 }, pick: { first: 0 } });
    const lines = [line("ghee", 2, 10)];
    const base = quoteDelivery({ doc: withOptions, lines, country: "Poland", state: "", pricing, takesArrr: true });
    expect(base).toMatchObject({ kind: "charge", fee: 5 });
    if (base.kind === "charge") expect(base.line.product).toMatchObject({ title: "Delivery to Poland, Standard", delivery: { option: { id: "", name: "Standard" } } });
    const express = quoteDelivery({ doc: withOptions, lines, country: "Poland", state: "", pricing, takesArrr: true, option: "exp" });
    expect(express).toMatchObject({ kind: "charge", fee: 17 });
    if (express.kind === "charge") expect(express.line.product).toMatchObject({ title: "Delivery to Poland, Express", delivery: { option: { id: "exp", name: "Express" } } });
    // A free option is still the buyer's pick.
    expect(quoteDelivery({ doc: withOptions, lines, country: "Iceland", state: "", pricing, takesArrr: true, option: "pick" })).toEqual({ kind: "free", parts: [{ profile: "Delivery", zone: "Europe", items: 2, fee: 0 }], option: { id: "pick", name: "Local pickup" } });
    // An option a zone doesn't price, or one the shop doesn't have, isn't offered.
    const partial = doc({ options: [{ id: "exp", name: "Express" }] });
    expect(quoteDelivery({ doc: partial, lines, country: "Poland", state: "", pricing, takesArrr: true, option: "exp" })).toEqual({ kind: "option-unavailable" });
    expect(quoteDelivery({ doc: withOptions, lines, country: "Poland", state: "", pricing, takesArrr: true, option: "nope" })).toEqual({ kind: "option-unavailable" });
  });

  it("keep only well-formed options: four at most, named, each once", () => {
    const parsed = deliveryDocOf(
      {
        ...doc(),
        options: [{ id: "a", name: "A" }, { id: "a", name: "Again" }, { id: "b", name: "" }, { id: "bad id", name: "X" }, { id: "c", name: "C" }, { id: "d", name: "D" }, { id: "e", name: "E" }, { id: "f", name: "F" }],
      },
      STORE
    );
    expect(parsed?.options?.map((o) => o.id)).toEqual(["a", "c", "d", "e"]);
  });

  it("read a pickup point's place, say where and when, and offer it free only in its country", () => {
    const parsed = deliveryDocOf(
      {
        ...doc(),
        options: [
          { id: "p", name: "Pick up", pickup: true, place: { country: "PT", address: " Rua Augusta 10 ", days: [6, 1, 2, 3, 4, 5, 9], from: "10:00", to: "25:00" } },
          { id: "q", name: "Shop", pickup: true, place: { country: "PT", address: "", days: [1] } },
        ],
      },
      STORE
    ) as DeliveryDoc;
    expect(parsed.options?.[0].place).toEqual({ country: "PT", address: "Rua Augusta 10", days: [1, 2, 3, 4, 5, 6], from: "10:00" });
    expect(parsed.options?.[1].place).toBeUndefined();
    expect(pickupDays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(pickupDays([1, 3, 6, 0])).toBe("Mon, Wed, Sat, Sun");
    expect(pickupDays([0, 1, 2, 3, 4, 5, 6])).toBe("every day");
    expect(pickupText({ country: "PT", address: "Rua Augusta 10", days: [1, 2, 3, 4, 5], from: "10:00", to: "18:00" })).toBe("Rua Augusta 10, Portugal · Mon–Fri 10:00–18:00");
    expect(deliveryOptionsOf(parsed)[1].note).toBe("Rua Augusta 10, Portugal · Mon–Sat from 10:00");
    const lines = [line("ghee", 2, 10)];
    const quote = (country: string) => quoteDelivery({ doc: parsed, lines, country, state: "", pricing, takesArrr: true, option: "p" });
    expect(quote("Portugal")).toEqual({ kind: "free", parts: [], option: { id: "p", name: "Pick up" } });
    expect(quote("Poland")).toEqual({ kind: "option-unavailable" });
  });

  it("keep which options the buyer collects, the zones' own included (only a true pickup flag counts)", () => {
    const parsed = deliveryDocOf(
      { ...doc(), base: { name: "Farm pickup", pickup: true }, options: [{ id: "a", name: "Local pickup", pickup: true }, { id: "b", name: "Express", pickup: "yes" }] },
      STORE
    );
    expect(parsed?.base).toEqual({ name: "Farm pickup", pickup: true });
    expect(parsed?.options).toEqual([{ id: "a", name: "Local pickup", pickup: true }, { id: "b", name: "Express" }]);
    expect(deliveryOptionsOf(parsed as DeliveryDoc).map((o) => !!o.pickup)).toEqual([true, true, false]);
  });
});

describe("a product in several shipping profiles", () => {
  const mk = (productId: string, qort: number): CartLine => ({ productId, catalogueId: "c", quantity: 1, product: { title: productId, type: "physical", price: [{ currency: "qort", value: qort }] } as never });
  const doc = {
    v: 1,
    storeId: "s",
    currency: "QORT",
    general: { zones: [] },
    profiles: [
      { id: "is", name: "Iceland", products: ["ghee"], zones: [{ id: "a", countries: ["IS"], first: 12 }] },
      { id: "intl", name: "International", products: ["ghee"], zones: [{ id: "b", countries: ["PL", "PT"], first: 20 }] },
    ],
    updated: 1,
  } as DeliveryDoc;
  const quote = (country: string) => quoteDelivery({ doc, lines: [mk("ghee", 50)], country, state: "", pricing: null, takesArrr: false });

  it("goes by the first profile whose zones reach the buyer's country", () => {
    expect(quote("Iceland")).toMatchObject({ kind: "charge", fee: 12, parts: [{ profile: "Iceland" }] });
    expect(quote("Poland")).toMatchObject({ kind: "charge", fee: 20, parts: [{ profile: "International" }] });
    // Neither reaches Japan: not delivered there, as with one profile.
    expect(quote("Japan")).toMatchObject({ kind: "unavailable" });
  });
});

describe("delivery prices in Q-Assets", () => {
  const priced = doc({
    general: { zones: [{ id: "eu", countries: EUROPE, first: 5, extra: 1, freeOver: 100, assets: { "88": { first: 25, extra: 5 } } }] },
    profiles: [{ id: "heavy", name: "Heavy items", products: ["anvil"], zones: [{ id: "world", countries: ["IS", "PL", "US"], first: 30, assets: { "88": { first: 150 } } }] }],
  });
  const priceIn = (q: ReturnType<typeof quote>, coin: string) => (q.kind === "charge" ? (q.line.product as { price: { currency: string; value: number }[] }).price.find((p) => p.currency === coin)?.value : undefined);

  it("carry the zone's own asset price on the fee's line, added up over the order's parts", () => {
    // 3 items in Europe: 25 + 2 × 5 BHC Coin.
    expect(priceIn(quote(priced, [line("ghee", 3, 10)], "Poland"), "ASSET:88")).toBe(35);
    // With the anvil's own zone too: 25 + 150.
    expect(priceIn(quote(priced, [line("ghee", 1, 10), line("anvil", 1, 50)], "Poland"), "ASSET:88")).toBe(175);
  });

  it("leave it out when a part has none, so it converts from QORT (or can't be paid in the asset)", () => {
    const partly = doc({ ...priced, profiles: [{ id: "heavy", name: "Heavy items", products: ["anvil"], zones: [{ id: "world", countries: ["IS", "PL", "US"], first: 30 }] }] });
    expect(priceIn(quote(partly, [line("ghee", 1, 10), line("anvil", 1, 50)], "Poland"), "ASSET:88")).toBeUndefined();
    // A part that's free there doesn't count against it.
    expect(priceIn(quote(partly, [line("ghee", 1, 10)], "Poland"), "ASSET:88")).toBe(25);
  });

  it("are read only when well formed", () => {
    const read = deliveryDocOf(
      { ...priced, general: { zones: [{ id: "eu", countries: ["PL"], first: 5, assets: { "88": { first: 25, extra: 5 }, "0": { first: 1 }, x: { first: 2 }, "89": { extra: 3 } } }] } },
      STORE
    );
    expect(read?.general.zones[0].assets).toEqual({ "88": { first: 25, extra: 5 } });
  });
});
