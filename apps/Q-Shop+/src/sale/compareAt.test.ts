import { describe, expect, it } from "vitest";
import { compareAtOf, rowSaleOf, saleOf, withCompareAt, withSaleRows } from "./compareAt";
import { newProductDraft, editedProductDraft, formValuesFor } from "../seller/productDraft";

const qort = (value: number, extra: object = {}) => ({ price: [{ currency: "qort", value }], ...extra });

describe("a product on sale", () => {
  it("reads its price before safely", () => {
    expect(compareAtOf({ compareAt: { currency: "QORT", value: 12 } })).toEqual({ currency: "QORT", value: 12 });
    expect(compareAtOf({ compareAt: { currency: "USD", value: "12" } })).toBeNull();
    expect(compareAtOf({ compareAt: { currency: "", value: 12 } })).toBeNull();
    expect(compareAtOf({ compareAt: { currency: "QORT", value: -1 } })).toBeNull();
    expect(compareAtOf({})).toBeNull();
  });

  it("is on sale when its price before is above its price now, in the same currency", () => {
    expect(saleOf(qort(9, { compareAt: { currency: "QORT", value: 12 } }))).toEqual({ was: { currency: "QORT", value: 12 }, now: 9, percent: 25 });
    // A price in the shop's currency compares with its own price in that currency, whatever the rates.
    expect(saleOf(qort(50, { fiatPrice: { currency: "USD", value: 8, qort: 50 }, compareAt: { currency: "USD", value: 10 } }))?.percent).toBe(20);
    expect(saleOf(qort(12, { compareAt: { currency: "QORT", value: 12 } }))).toBeNull();
    expect(saleOf(qort(13, { compareAt: { currency: "QORT", value: 12 } }))).toBeNull();
    // Another currency than its price's: nothing to compare with.
    expect(saleOf(qort(9, { compareAt: { currency: "EUR", value: 12 } }))).toBeNull();
    // Less than 1% off isn't a sale worth a badge.
    expect(saleOf(qort(99.5, { compareAt: { currency: "QORT", value: 100 } }))).toBeNull();
  });

  it("goes in a draft as typed, and out when emptied", () => {
    expect(withCompareAt({ title: "Mug" }, "12.5", "QORT")).toEqual({ title: "Mug", compareAt: { currency: "QORT", value: 12.5 } });
    expect(withCompareAt({ title: "Mug", compareAt: { currency: "QORT", value: 9 } }, "", "QORT")).toEqual({ title: "Mug" });
    expect(withCompareAt({ title: "Mug", compareAt: { currency: "QORT", value: 9 } }, undefined, "QORT")).toEqual({ title: "Mug", compareAt: { currency: "QORT", value: 9 } });
  });

  it("is written by the product form, in the currency its price is typed in", () => {
    const values = { ...formValuesFor(null, ["QORT"]), title: "Mug", prices: { QORT: "9" }, compareAt: "12" };
    const draft = newProductDraft({ values, coins: ["QORT"], storeId: "q-store-general-shop", name: "Seller", uid: "U1", now: 1 });
    expect(draft).toMatchObject({ compareAt: { currency: "QORT", value: 12 } });
    const pricing = { currency: "USD", rates: { QORT: 0.2 }, updated: 1 };
    const fiatDraft = newProductDraft({ values: { ...values, fiat: "8", compareAt: "10" }, coins: ["QORT"], storeId: "q-store-general-shop", name: "Seller", uid: "U2", now: 1, pricing });
    expect(fiatDraft).toMatchObject({ compareAt: { currency: "USD", value: 10 } });
    expect(saleOf(fiatDraft as never)?.percent).toBe(20);
    // The form shows it again, and an edit that empties it takes it off sale.
    expect(formValuesFor(draft as never, ["QORT"]).compareAt).toBe("12");
    const edited = editedProductDraft({ base: { ...draft, catalogueId: "c", isUpdate: true } as never, values: { ...formValuesFor(draft as never, ["QORT"]), compareAt: "" }, coins: ["QORT"], name: "Seller" });
    expect("compareAt" in edited).toBe(false);
  });

  it("puts its percent off in the product's row, so lists show and filter it", () => {
    const built = {
      dataContainer: { id: "dc", products: { a: { catalogueId: "c", priceQort: 9 }, b: { catalogueId: "c", priceQort: 5, sale: 10 } } },
      resources: [{ identifier: "dc", service: "DOCUMENT", data64: "" }],
      catalogues: [],
    } as never;
    const out = withSaleRows(built, { a: { id: "a", ...qort(9, { compareAt: { currency: "QORT", value: 12 } }) }, b: { id: "b", ...qort(5) } } as never) as { dataContainer: { products: Record<string, Record<string, unknown>> } };
    expect(out.dataContainer.products.a.sale).toBe(25);
    expect("sale" in out.dataContainer.products.b).toBe(false);
    expect(rowSaleOf({ sale: 25 })).toBe(25);
    expect(rowSaleOf({ sale: 0 })).toBeUndefined();
    expect(rowSaleOf({ sale: "25" })).toBeUndefined();
  });

  it("an edit that leaves the price before a sale alone keeps its currency, with or without the shop's pricing", () => {
    const base = { ...qort(75, { fiatPrice: { currency: "EUR", value: 15, qort: 75 }, compareAt: { currency: "EUR", value: 20 } }), id: "p1", catalogueId: "c", isUpdate: true, title: "Mug", images: [], type: "physical", category: "Home & Garden", status: "AVAILABLE" };
    const values = formValuesFor(base as never, ["QORT"]);
    expect(values.compareAt).toBe("20.00");
    // The shop no longer prices in a currency: the form has no pricing.
    const edited = editedProductDraft({ base: base as never, values, coins: ["QORT"], name: "Seller" });
    expect((edited as { compareAt?: unknown }).compareAt).toEqual({ currency: "EUR", value: 20 });
    // Typed anew, it takes the price's currency (QORT here).
    const retyped = editedProductDraft({ base: base as never, values: { ...values, compareAt: "90" }, coins: ["QORT"], name: "Seller" });
    expect((retyped as { compareAt?: unknown }).compareAt).toEqual({ currency: "QORT", value: 90 });
  });
});
