import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterSellerProducts, isFiltered, needsDetails, shopOrderPlaces, sortColumnOf, sortForColumn, statusCounts, type SellerRow } from "./productList";

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
    expect(statusCounts(rows)).toEqual({ all: 4, AVAILABLE: 2, AUCTION: 0, OUT_OF_STOCK: 1, RETIRED: 1 });
  });

  it("counts an auction as an auction, though it's stored out of stock for the original app", () => {
    const auction = { ...rows[0], productId: "p-clock", status: "OUT_OF_STOCK", auction: { start: 1, end: 2 } };
    expect(statusCounts([...rows, auction])).toEqual({ all: 5, AVAILABLE: 2, AUCTION: 1, OUT_OF_STOCK: 1, RETIRED: 1 });
    expect(ids(filterSellerProducts([...rows, auction], { ...DEFAULT_FILTERS, status: "AUCTION" }, detailsOf))).toEqual(["p-clock"]);
  });

  it("sorts by the seller's order (Featured), the products it doesn't name after, newest first", () => {
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "featured" }, detailsOf, ["p-chair", "p-gone", "p-poster"]))).toEqual(["p-chair", "p-poster", "p-odd", "p-mug"]);
    // Filters still apply; with no order it is newest first.
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "featured", category: "Art" }, detailsOf, ["p-poster", "p-odd"]))).toEqual(["p-poster", "p-odd"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "featured" }, detailsOf))).toEqual(["p-odd", "p-mug", "p-chair", "p-poster"]);
  });

  it("sorts by status and title either way, and each column's second click is its other way", () => {
    // Available (newest first), out of stock, retired; and back.
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "status" }, detailsOf))).toEqual(["p-odd", "p-mug", "p-poster", "p-chair"]);
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "status-desc" }, detailsOf))).toEqual(["p-chair", "p-poster", "p-odd", "p-mug"]);
    // Z to A, a product without a title still last.
    expect(ids(filterSellerProducts(rows, { ...DEFAULT_FILTERS, sort: "title-desc" }, detailsOf))).toEqual(["p-poster", "p-mug", "p-chair", "p-odd"]);
    expect(sortForColumn("price", "newest")).toBe("price-asc");
    expect(sortForColumn("price", "price-asc")).toBe("price-desc");
    expect(sortForColumn("price", "price-desc")).toBe("price-asc");
    expect(sortForColumn("added", "title")).toBe("newest");
    expect(sortColumnOf("oldest")).toEqual({ column: "added", way: "second" });
    expect(sortColumnOf("featured")).toEqual({ column: "order", way: "first" });
  });

  it("numbers the listed products in the shop's order, the rest newest first after it, retired ones left out", () => {
    expect([...shopOrderPlaces(rows, ["p-poster", "p-chair"])]).toEqual([
      ["p-poster", 1],
      ["p-odd", 2],
      ["p-mug", 3],
    ]);
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
