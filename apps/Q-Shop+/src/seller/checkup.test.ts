import { describe, expect, it } from "vitest";
import { isFeeProduct, openShopSteps, shopCheckup, suggestShippingCountries } from "./checkup";
import type { SellerRow } from "./productList";

const row = (id: string, category: string, status = "AVAILABLE"): SellerRow => ({ productId: id, created: 1, priceQort: 1, category, catalogueId: "c", status });

describe("the shop checkup", () => {
  it("reads the countries old typed Ships to texts name (texts from the node's shops)", () => {
    const all = suggestShippingCountries("Worldwide").codes.length;
    expect(all).toBeGreaterThan(200);
    expect(suggestShippingCountries("U.S.A.").codes).toEqual(["US"]);
    expect(suggestShippingCountries("USA (50 States)").codes).toEqual(["US"]);
    expect(suggestShippingCountries("Üle Eesti").codes).toEqual(["EE"]);
    expect(suggestShippingCountries("Austria Germany Switzerland").codes).toEqual(["AT", "DE", "CH"]);
    expect(suggestShippingCountries("Iceland, Poland, UK, USA, Canada").codes).toEqual(["IS", "PL", "GB", "US", "CA"]);
    expect(suggestShippingCountries("Anywhere").codes.length).toBe(all);
    expect(suggestShippingCountries("Domestic").codes).toEqual([]);
    expect(suggestShippingCountries("Europe").codes).toContain("FR");
    expect(suggestShippingCountries("Russia").codes).toEqual(["RU"]);
  });

  it("finds products used to charge delivery", () => {
    expect(isFeeProduct(row("a", "Shipping"), "USPS Priority")).toBe(true);
    expect(isFeeProduct(row("a", "Food"), "Postage to Canada")).toBe(true);
    expect(isFeeProduct(row("a", "Food & Drink"), "Ghee 100 ml")).toBe(false);
  });

  it("lists what a shop still needs: old categories, its details, payments, where it ships, delivery prices, fee products", () => {
    const rows = [row("a", "Health & Beauty"), row("b", "füüsilised"), row("c", "Postage"), row("d", "toy", "RETIRED")];
    const items = shopCheckup({
      shop: { title: "Old shop", description: "Hi", logo: "data:x", location: "Tallinn", shipsTo: "Üle Eesti", supportedCoins: ["QORT", "ARRR"], foreignCoins: { ARRR: "" } },
      rows,
      detailsOf: (r) => ({ title: r.productId === "c" ? "Saatmine" : "Thing", type: "physical" }),
      hasDelivery: false,
    });
    expect(items).toEqual([
      { key: "products", done: true },
      { key: "categories", done: false, count: 2 },
      { key: "details", done: true },
      { key: "payments", done: false },
      { key: "shipsTo", done: false },
      { key: "delivery", done: false },
      { key: "policies", done: false },
      { key: "feeProducts", done: false, count: 1 },
    ]);
    // A shop of digital products only needn't say where it ships, or when it dispatches.
    const digital = shopCheckup({
      shop: { logo: "x", description: "d", location: "l", policies: { returnDays: 0 } },
      rows: [row("a", "Services")],
      detailsOf: () => ({ type: "digital" }),
      hasDelivery: false,
    });
    expect(digital.map((i) => [i.key, i.done])).toEqual([
      ["products", true],
      ["categories", true],
      ["details", true],
      ["payments", true],
      ["policies", true],
    ]);
  });

  it("asks a new shop for its first product, once its list has been read", () => {
    const first = (listLoaded: boolean) => shopCheckup({ shop: {}, rows: [], detailsOf: () => undefined, hasDelivery: null, listLoaded }).find((i) => i.key === "products")?.done;
    expect(first(true)).toBe(false);
    expect(first(false)).toBe(true);
  });

  it("wants dispatch time and returns said for a shop that ships", () => {
    const check = (policies: unknown) =>
      shopCheckup({ shop: { policies }, rows: [row("a", "Toys & Hobbies")], detailsOf: () => ({ type: "physical" }), hasDelivery: true }).find((i) => i.key === "policies")?.done;
    expect(check(undefined)).toBe(false);
    expect(check({ returnDays: 14 })).toBe(false);
    expect(check({ returnDays: 14, dispatchDays: 2 })).toBe(true);
    expect(check({ returnDays: 0, dispatchDays: 30 })).toBe(true);
  });

  it("counts the steps an owner's shop page can tell, without reading more", () => {
    const rows = [{ category: "Paper" }, { category: "Home & Garden" }];
    expect(openShopSteps({ logo: "x", description: "d", location: "l" }, rows)).toBe(3);
    expect(openShopSteps({ logo: "x", description: "d", location: "l", shippingCountries: ["PT"], policies: { returnDays: 14 } }, [{ category: "Home & Garden" }])).toBe(0);
  });
});
