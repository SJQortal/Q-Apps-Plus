/** How far an order is from free delivery (delivery/freeDelivery.ts). */
import { describe, expect, it } from "vitest";
import type { CartLine } from "../money/order";
import type { DeliveryDoc } from "./model";
import { freeDeliveryProgress } from "./freeDelivery";

const line = (productId: string, qort: number, quantity = 1, type = "physical"): CartLine => ({
  productId,
  catalogueId: "c",
  quantity,
  product: { title: productId, type, price: [{ currency: "qort", value: qort }] } as never,
});
// Biohackers Corner's shape: no general zones, an Iceland profile free from 120 USD, a heavy one free from 200.
const doc: DeliveryDoc = {
  v: 1,
  storeId: "s",
  currency: "USD",
  general: { zones: [] },
  profiles: [
    { id: "is", name: "Iceland", products: ["ghee", "balm"], zones: [{ id: "z1", countries: ["IS"], first: 12, freeOver: 120 }] },
    { id: "heavy", name: "Iceland Heavy", products: ["oil"], zones: [{ id: "z2", countries: ["IS"], first: 40, freeOver: 200 }] },
  ],
  updated: 1,
} as DeliveryDoc;
const pricing = { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } as never;
const iceland = { country: "Iceland", state: "", pricing };

describe("free delivery progress", () => {
  it("says what each profile the order uses still needs, in the shop's currency", () => {
    // 130 QORT ghee at 0.2 USD = 26 USD of 120.
    expect(freeDeliveryProgress({ doc, lines: [line("ghee", 130)], ...iceland })).toEqual([
      { profile: "Iceland", freeOver: 120, subtotal: 26, left: 94, currency: "USD", reached: false },
    ]);
    const both = freeDeliveryProgress({ doc, lines: [line("ghee", 130, 5), line("oil", 100)], ...iceland });
    expect(both.map((s) => [s.profile, s.left, s.reached])).toEqual([
      ["Iceland", 0, true],
      ["Iceland Heavy", 180, false],
    ]);
  });

  it("offers the lowest 'free from' there with nothing (physical) in the cart; nothing elsewhere or without rates", () => {
    expect(freeDeliveryProgress({ doc, lines: [], ...iceland })).toEqual([{ profile: null, freeOver: 120, subtotal: 0, left: 120, currency: "USD", reached: false }]);
    expect(freeDeliveryProgress({ doc, lines: [line("ebook", 5, 1, "digital")], ...iceland })).toHaveLength(1);
    expect(freeDeliveryProgress({ doc, lines: [line("ghee", 130)], country: "Portugal", state: "", pricing })).toEqual([]);
    expect(freeDeliveryProgress({ doc, lines: [line("ghee", 130)], country: "Iceland", state: "", pricing: null })).toEqual([]);
  });
});
