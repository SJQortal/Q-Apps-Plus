import { describe, expect, it } from "vitest";
import type { CartLine } from "../money/order";
import { SHIPPING_REGIONS } from "../constants/shipping";
import type { DeliveryDoc } from "./model";
import { deliveryEstimate } from "./estimate";
import { cleanPlace } from "./buyerPlace";

const STORE = "q-store-general-my-shop";
const EUROPE = [...SHIPPING_REGIONS[0].codes];
const pricing = { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 1 };
const line = (id: string, qty: number, usd: number): CartLine => ({
  productId: id,
  catalogueId: "c",
  quantity: qty,
  product: { title: id, type: "physical", price: [{ currency: "qort", value: usd / 0.18 }], fiatPrice: { currency: "USD", value: usd, qort: usd / 0.18 } } as never,
});
const doc = (over: Partial<DeliveryDoc> = {}): DeliveryDoc => ({
  v: 1,
  storeId: STORE,
  currency: "USD",
  general: { zones: [{ id: "eu", name: "Europe", countries: EUROPE, first: 5, extra: 1, freeOver: 100, rates: { exp: { first: 12 }, pick: { first: 0 } } }] },
  profiles: [],
  updated: 1,
  ...over,
});
const shop = { supportedCoins: ["QORT", "ARRR"], shippingCountries: [...EUROPE, "US"] };
const estimate = (d: DeliveryDoc | null, l: CartLine, country: string, state = "", s: object = shop) =>
  deliveryEstimate({ shop: s, delivery: { doc: d, pricing }, lines: [l], place: { country, state } });

describe("delivery before checkout", () => {
  it("prices the zone's own delivery for the product, with free over", () => {
    expect(estimate(doc(), line("mug", 2, 10), "Portugal")).toEqual({
      kind: "ok",
      choices: [{ id: "", name: "", free: false, qort: 33.33, fiat: { value: 6, currency: "USD" } }],
      freeOver: { value: 100, currency: "USD" },
    });
    // Over the amount it's free, as checkout will say.
    expect(estimate(doc(), line("mug", 12, 10), "Portugal")).toMatchObject({ kind: "ok", choices: [{ id: "", free: true }] });
  });

  it("lists each option the zone prices, the shop's first option first", () => {
    const options = doc({ base: { name: "Standard", note: "5–10 days" }, options: [{ id: "exp", name: "Express", note: "1–3 days" }, { id: "pick", name: "Local pickup" }, { id: "eve", name: "Evening" }] });
    const result = estimate(options, line("mug", 1, 10), "Portugal");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.choices.map((c) => [c.name, c.free, c.fiat?.value])).toEqual([
      ["Standard", false, 5],
      ["Express", false, 12],
      ["Local pickup", true, undefined],
    ]);
    expect(result.choices[0].note).toBe("5–10 days");
  });

  it("says when the shop doesn't ship there, or has no zone for it", () => {
    expect(estimate(doc(), line("mug", 1, 10), "Japan")).toEqual({ kind: "not-shipped", place: "Japan" });
    expect(estimate(doc(), line("mug", 1, 10), "United States", "Oregon")).toEqual({ kind: "unavailable", place: "Oregon, United States" });
    // A shop without a list of countries: the zones decide.
    expect(estimate(doc(), line("mug", 1, 10), "Japan", "", { supportedCoins: ["QORT"] })).toEqual({ kind: "unavailable", place: "Japan" });
  });

  it("has nothing to say without delivery prices, or when their currency has no rate any more", () => {
    expect(estimate(null, line("mug", 1, 10), "Portugal")).toEqual({ kind: "none" });
    expect(deliveryEstimate({ shop, delivery: { doc: doc(), pricing: null }, lines: [line("mug", 1, 10)], place: { country: "Portugal", state: "" } })).toEqual({ kind: "no-rates" });
  });
});

describe("the buyer's place", () => {
  it("keeps a country the lists know, and a state in the United States only", () => {
    expect(cleanPlace({ country: "portugal", state: "Lisboa" })).toEqual({ country: "Portugal", state: "" });
    expect(cleanPlace({ country: "United States", state: "oregon" })).toEqual({ country: "United States", state: "Oregon" });
    expect(cleanPlace({ country: "Atlantis" })).toBeNull();
    expect(cleanPlace(null)).toBeNull();
  });
});
