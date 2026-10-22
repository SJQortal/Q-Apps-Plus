import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterSellerProducts, isFiltered, needsDetails, statusCounts, type SellerRow } from "./productList";

const rows: SellerRow[] = [
  { productId: "p-mug", created: 3, priceQort: 1.5, category: "Kitchen", catalogueId: "c1", status: "AVAILABLE" },
  { productId: "p-poster", created: 1, priceQort: 0.1, category: "Art", catalogueId: "c1", status: "OUT_OF_STOCK" },
  { productId: "p-chair", created: 2, priceQort: 12, category: "Furniture", catalogueId: "c2", status: "RETIRED" },
  { productId: "p-odd", created: 4, priceQort: 5, category: "Art", catalogueId: "c3", status: "" },
];
const titles: Record<string, { title: string; description: string }> = {
  "p-mug": { title: "Mug", description: "A tea mug" },
  "p-poster": { title: "Poster", description: "Mountains" },
  "p-chair": { title: "Chair", description: "Oak" },
};
const detailsOf = (row: SellerRow) => titles[row.productId];
const ids = (list: SellerRow[]) => list.map((r) => r.productId);

describe("the seller's product list", () => {
  it("counts statuses, an unknown status as available", () => {
    expect(statusCounts(rows)).toEqual({ all: 4, AVAILABLE: 2, OUT_OF_STOCK: 1, RETIRED: 1 });
  });

  it("sorts newest first by default, and by price either way", () => {
    expect(ids(filterSellerProducts(rows, DEFAULT_FILTERS, detailsOf))).toEqual(["p-odd", "p-mug", "p-chair", "p-poster"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "oldest" }, detailsOf))).toEqual(["p-poster", "p-chair", "p-mug", "p-odd"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "price-asc" }, detailsOf))).toEqual(["p-poster", "p-mug", "p-odd", "p-chair"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "price-desc" }, detailsOf))).toEqual(["p-chair", "p-odd", "p-mug", "p-poster"]);
  });

  it("sorts by title with products not loaded yet last", () => {
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "title" }, detailsOf))).toEqual(["p-chair", "p-mug", "p-poster", "p-odd"]);
  });

  it("filters by status and category, and searches titles, descriptions, categories and ids", () => {
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, status: "AVAILABLE" }, detailsOf))).toEqual(["p-odd", "p-mug"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, category: "Art" }, detailsOf))).toEqual(["p-odd", "p-poster"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, query: "TEA" }, detailsOf))).toEqual(["p-mug"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, query: "furn" }, detailsOf))).toEqual(["p-chair"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, query: "p-odd" }, detailsOf))).toEqual(["p-odd"]);
  });

  it("knows when it needs the catalogues and when filters are on", () => {
    expect(needsDetails(DEFAULT_FILTERS)).toBe(false);
    expect(needsDetails({ ...DEFAULT_FILTERS, query: "x" })).toBe(true);
    expect(needsDetails({ ...DEFAULT_FILTERS, sort: "title" })).toBe(true);
    expect(isFiltered({ ...DEFAULT_FILTERS, sort: "oldest" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_FILTERS, status: "RETIRED" })).toBe(true);
  });
});
