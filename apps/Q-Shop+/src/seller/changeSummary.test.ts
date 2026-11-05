/** What changed, in words (seller/changeSummary.ts). */
import { describe, expect, it } from "vitest";
import type { DeliveryDoc } from "../delivery/model";
import type { ShopCollection } from "../qdn/collections";
import { collectionChanges, deliveryChanges, discountChanges } from "./changeSummary";

const names: Record<string, string> = { ghee: "Ghee 200 ml", balm: "Tallow balm", soap: "Soap", lamp: "Lamp" };
const nameOf = (id: string) => names[id] ?? "a product";

const before: DeliveryDoc = {
  v: 1,
  storeId: "s",
  currency: "USD",
  base: { name: "Standard" },
  options: [{ id: "pick", name: "Pick up", pickup: true, place: { country: "IS", address: "Kolaportid Market", days: [6, 0], from: "11:00", to: "17:00" } }],
  general: { zones: [] },
  profiles: [{ id: "is", name: "Iceland", products: ["ghee", "soap"], zones: [{ id: "z", countries: ["IS"], first: 12, extra: 4, freeOver: 120 }] }],
  updated: 1,
} as DeliveryDoc;

describe("what changed in the delivery prices", () => {
  it("says each change: options, pickup hours, profiles' products and zones' prices", () => {
    const after: DeliveryDoc = {
      ...before,
      options: [
        { id: "pick", name: "Pick up", pickup: true, place: { country: "IS", address: "Kolaportid Market", days: [5, 6, 0], from: "11:00", to: "17:00" } },
        { id: "exp", name: "Express" },
      ],
      profiles: [
        { id: "is", name: "Iceland", products: ["ghee", "balm"], zones: [{ id: "z", countries: ["IS"], first: 10, extra: 4, freeOver: 100 }] },
        { id: "heavy", name: "Heavy", products: ["lamp"], zones: [] },
      ],
    } as DeliveryDoc;
    expect(deliveryChanges(before, after, nameOf)).toEqual([
      "Added option Express",
      "Pick up: open Fri, Sat, Sun 11:00–17:00 (was Sat, Sun 11:00–17:00)",
      "Added shipping profile Heavy with Lamp",
      "Iceland: added Tallow balm",
      "Iceland: took out Soap",
      "Iceland › Iceland: first item $12.00 → $10.00, free from $120.00 → $100.00",
    ]);
    expect(deliveryChanges(before, before, nameOf)).toEqual([]);
  });
});

describe("what changed in the collections", () => {
  const c = (id: string, title: string, products: string[]): ShopCollection => ({ id, title, description: "", products, created: 1, updated: 1 });
  it("says what was added, taken out, renamed and reordered", () => {
    const was = [c("a", "Ghee", ["ghee"]), c("b", "Skin", ["balm", "soap"])];
    expect(collectionChanges(was, [c("b", "Skin care", ["soap", "balm"]), c("a", "Ghee", ["ghee", "lamp"]), c("n", "New", [])], nameOf)).toEqual([
      "Added collection New",
      "Collection Skin renamed Skin care",
      "Skin care: products in a new order",
      "Ghee: added Lamp",
      "Collections in a new order",
    ]);
  });
});

describe("what changed in the discount codes", () => {
  it("names codes added, deleted, paused and changed", () => {
    const was = [
      { id: "a", code: "0123456789abcdef0123456789abcdef", percent: 10 },
      { id: "b", code: "fedcba9876543210fedcba9876543210", percent: 20 },
    ];
    const lines = discountChanges(
      [{ ...was[0], codeText: "SPRING10" }, { ...was[1], codeText: "VIP20" }] as never,
      [
        { ...was[0], codeText: "SPRING10", paused: true as const },
        { id: "c", percent: 15, codeText: "NEW15" },
      ],
      "QORT"
    );
    expect(lines).toEqual(["Added NEW15: 15% off · every product", "Deleted VIP20", "SPRING10: paused"]);
  });
});
