import { describe, expect, it } from "vitest";
import { SHOP_CATEGORIES, categoryKey, isListedCategory, listedCategory, oldCategoryOf } from "./categories";

describe("product categories", () => {
  it("is one fixed list, each name once, Everything Else last", () => {
    expect(SHOP_CATEGORIES).toHaveLength(20);
    expect(new Set(SHOP_CATEGORIES.map(categoryKey)).size).toBe(SHOP_CATEGORIES.length);
    expect(SHOP_CATEGORIES.at(-1)).toBe("Everything Else");
    expect(SHOP_CATEGORIES).toContain("Home & Garden");
  });

  it("knows a listed category in any case and spacing", () => {
    expect(listedCategory("  home  &  garden ")).toBe("Home & Garden");
    expect(listedCategory("BABY")).toBe("Baby");
    expect(listedCategory("flower")).toBeNull();
    expect(isListedCategory("")).toBe(false);
  });

  it("names a product's own category from before the list, so editing keeps it", () => {
    expect(oldCategoryOf({ category: " flower " })).toBe("flower");
    expect(oldCategoryOf({ category: "services" })).toBeNull();
    expect(oldCategoryOf({ category: "" })).toBeNull();
    expect(oldCategoryOf({ category: 3 })).toBeNull();
    expect(oldCategoryOf(null)).toBeNull();
  });
});
