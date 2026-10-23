import { describe, expect, it } from "vitest";
import {
  categoriesOf,
  effectiveSort,
  filterAndSortProducts,
  isInStock,
  isListed,
  matchesSearch,
  openAuctionCount,
  productRowsFromContainer,
  searchCatalogueIds,
  searchProducts,
  searchTerms,
  type CatalogueMap,
  type ProductRow,
} from "./shopData";
import { CATALOGUE_ID, catalogue, chair, dataContainer, mug, poster } from "../../test/fixtures/shop";

const row = (over: Partial<ProductRow> & { productId: string }): ProductRow => ({
  catalogueId: "cat-1",
  created: 1,
  ...over,
});

describe("productRowsFromContainer", () => {
  it("reads every product of the index, newest first", () => {
    const rows = productRowsFromContainer(dataContainer);
    expect(rows.map((r) => r.productId)).toEqual([mug.id, poster.id, chair.id]);
    expect(rows[0]).toEqual({
      productId: mug.id,
      catalogueId: CATALOGUE_ID,
      created: mug.created,
      priceQort: 1.5,
      category: "Kitchen",
      status: "AVAILABLE",
    });
  });

  it("skips malformed entries and tolerates a missing index", () => {
    expect(productRowsFromContainer(null)).toEqual([]);
    expect(productRowsFromContainer({ products: "x" })).toEqual([]);
    const rows = productRowsFromContainer({
      products: { a: { created: 2, catalogueId: "c" }, b: null, c: { created: 3 }, d: { created: "4", priceQort: "2.5", catalogueId: "c" } },
    });
    expect(rows).toEqual([
      { productId: "d", catalogueId: "c", created: 4, priceQort: 2.5, category: undefined, status: undefined },
      { productId: "a", catalogueId: "c", created: 2, priceQort: undefined, category: undefined, status: undefined },
    ]);
  });
});

describe("categoriesOf", () => {
  it("lists each category once, A to Z", () => {
    expect(categoriesOf(productRowsFromContainer(dataContainer))).toEqual(["Art", "Furniture", "Kitchen"]);
  });
});

describe("isListed", () => {
  const loaded: CatalogueMap = { [CATALOGUE_ID]: { ...catalogue, user: "Seller Name" } as any };
  it("shows available and out-of-stock products, hides retired ones (as the original)", () => {
    expect(isListed(row({ productId: "a", status: "AVAILABLE" }), {})).toBe(true);
    expect(isListed(row({ productId: "a", status: "OUT_OF_STOCK" }), {})).toBe(true);
    expect(isListed(row({ productId: "a", status: "RETIRED" }), {})).toBe(false);
  });

  it("lets the catalogue's status win once loaded", () => {
    const retired: CatalogueMap = {
      [CATALOGUE_ID]: { id: CATALOGUE_ID, products: { [mug.id]: { ...mug, status: "RETIRED" } } } as any,
    };
    expect(isListed(row({ productId: mug.id, catalogueId: CATALOGUE_ID, status: "AVAILABLE" }), retired)).toBe(false);
  });

  it("keeps a product without status until its catalogue says, and drops one its catalogue lacks", () => {
    expect(isListed(row({ productId: mug.id, catalogueId: CATALOGUE_ID }), {})).toBe(true);
    expect(isListed(row({ productId: mug.id, catalogueId: CATALOGUE_ID }), loaded)).toBe(true);
    expect(isListed(row({ productId: "gone", catalogueId: CATALOGUE_ID, status: "AVAILABLE" }), loaded)).toBe(false);
  });
});

describe("filterAndSortProducts", () => {
  const rows: ProductRow[] = [
    row({ productId: "old-cheap", created: 1, priceQort: 1, category: "Art", status: "AVAILABLE" }),
    row({ productId: "new-dear", created: 3, priceQort: 9, category: "Kitchen", status: "OUT_OF_STOCK" }),
    row({ productId: "mid-mid", created: 2, priceQort: 5, category: "Art", status: "AVAILABLE" }),
    row({ productId: "no-price", created: 4, category: "Art", status: "AVAILABLE" }),
    row({ productId: "retired", created: 5, priceQort: 2, status: "RETIRED" }),
  ];
  const ids = (list: ProductRow[]) => list.map((r) => r.productId);

  it("sorts Featured in the seller's order, then the rest newest first", () => {
    const order = ["mid-mid", "gone", "old-cheap"];
    expect(ids(filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "featured" }, {}, order))).toEqual([
      "mid-mid",
      "old-cheap",
      "no-price",
      "new-dear",
    ]);
    // Without an order, Featured is newest first.
    expect(ids(filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "featured" }, {}))).toEqual([
      "no-price",
      "new-dear",
      "mid-mid",
      "old-cheap",
    ]);
  });

  it("defaults to Featured only where the seller set an order, and keeps the buyer's pick", () => {
    expect(effectiveSort(null, true)).toBe("featured");
    expect(effectiveSort(null, false)).toBe("newest");
    expect(effectiveSort("price-asc", true)).toBe("price-asc");
    expect(effectiveSort("featured", false)).toBe("newest");
  });

  it("sorts newest and oldest by the index's created time", () => {
    expect(ids(filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "newest" }, {}))).toEqual([
      "no-price",
      "new-dear",
      "mid-mid",
      "old-cheap",
    ]);
    expect(ids(filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "oldest" }, {}))).toEqual([
      "old-cheap",
      "mid-mid",
      "new-dear",
      "no-price",
    ]);
  });

  it("sorts by the QORT price, products without one last", () => {
    expect(ids(filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "price-asc" }, {}))).toEqual([
      "old-cheap",
      "mid-mid",
      "new-dear",
      "no-price",
    ]);
    expect(ids(filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "price-desc" }, {}))).toEqual([
      "new-dear",
      "mid-mid",
      "old-cheap",
      "no-price",
    ]);
  });

  it("sorts by the QORT price even when price[0] is another coin (bug 13)", () => {
    const fromIndex = productRowsFromContainer({
      products: {
        a: { created: 1, priceQort: 3, catalogueId: "c", status: "AVAILABLE" },
        b: { created: 2, priceQort: 2, catalogueId: "c", status: "AVAILABLE" },
      },
    });
    const catalogues: CatalogueMap = {
      c: {
        id: "c",
        products: {
          a: { ...mug, id: "a", price: [{ currency: "ARRR", value: 1 }, { currency: "qort", value: 3 }] },
          b: { ...mug, id: "b", price: [{ currency: "ARRR", value: 50 }, { currency: "qort", value: 2 }] },
        },
      } as any,
    };
    expect(ids(filterAndSortProducts(fromIndex, { categories: [], inStockOnly: false, sort: "price-asc" }, catalogues))).toEqual(["b", "a"]);
  });

  it("filters by categories and stock", () => {
    expect(ids(filterAndSortProducts(rows, { categories: ["Art"], inStockOnly: false, sort: "newest" }, {}))).toEqual([
      "no-price",
      "mid-mid",
      "old-cheap",
    ]);
    expect(ids(filterAndSortProducts(rows, { categories: ["Art", "Kitchen"], inStockOnly: true, sort: "newest" }, {}))).toEqual([
      "no-price",
      "mid-mid",
      "old-cheap",
    ]);
  });

  it("does not change the input", () => {
    const copy = [...rows];
    filterAndSortProducts(rows, { categories: [], inStockOnly: false, sort: "price-desc" }, {});
    expect(rows).toEqual(copy);
  });
});

describe("search", () => {
  it("matches every word in the title, description or category, ignoring case", () => {
    expect(searchTerms("  Big   MUG ")).toEqual(["big", "mug"]);
    expect(matchesSearch(mug, ["mug"])).toBe(true);
    expect(matchesSearch(mug, ["a", "kitchen"])).toBe(true);
    expect(matchesSearch(mug, ["mug", "poster"])).toBe(false);
    expect(matchesSearch(undefined, ["mug"])).toBe(false);
  });

  it("reads at most 30 catalogues, in list order, and says when it stopped", () => {
    const many = Array.from({ length: 35 }, (_, i) => row({ productId: `p${i}`, catalogueId: `c${i}` }));
    const doubled = many.flatMap((r) => [r, { ...r, productId: `${r.productId}b` }]);
    const { ids, capped } = searchCatalogueIds(doubled);
    expect(ids).toHaveLength(30);
    expect(ids[0]).toBe("c0");
    expect(ids[29]).toBe("c29");
    expect(capped).toBe(true);
    expect(searchCatalogueIds(doubled.slice(0, 20))).toEqual({ ids: Array.from({ length: 10 }, (_, i) => `c${i}`), capped: false });
  });

  it("shows only loaded, searched, matching products", () => {
    const rows = productRowsFromContainer(dataContainer);
    const catalogues: CatalogueMap = { [CATALOGUE_ID]: catalogue as any };
    expect(searchProducts(rows, ["poster"], [CATALOGUE_ID], catalogues).map((r) => r.productId)).toEqual([poster.id]);
    expect(searchProducts(rows, ["poster"], [], catalogues)).toEqual([]);
    expect(searchProducts(rows, ["poster"], [CATALOGUE_ID], {})).toEqual([]);
  });
});

describe("auctions in a list", () => {
  const NOW = 1_800_000_000_000;
  const H = 3_600_000;
  const rows = productRowsFromContainer({
    products: {
      plain: { created: 5, catalogueId: "c1", priceQort: 3, category: "Art", status: "AVAILABLE" },
      soon: { created: 1, catalogueId: "c1", priceQort: 9, category: "Art", status: "OUT_OF_STOCK", auction: { start: NOW - H, end: NOW + H } },
      later: { created: 4, catalogueId: "c1", priceQort: 2, category: "Art", status: "OUT_OF_STOCK", auction: { start: NOW + H, end: NOW + 9 * H } },
      over: { created: 3, catalogueId: "c1", priceQort: 1, category: "Art", status: "OUT_OF_STOCK", auction: { start: NOW - 9 * H, end: NOW - H } },
      gone: { created: 2, catalogueId: "c1", priceQort: 1, category: "Art", status: "OUT_OF_STOCK" },
    },
  });
  const ids = (list: ProductRow[]) => list.map((r) => r.productId);
  const query = { categories: [], inStockOnly: false, sort: "newest" as const };

  it("read the auction's times from the index, and count open ones (running or yet to start) as in stock", () => {
    expect(rows.find((r) => r.productId === "soon")?.auction).toEqual({ start: NOW - H, end: NOW + H });
    expect(rows.find((r) => r.productId === "plain")).not.toHaveProperty("auction");
    expect(ids(rows.filter((r) => isInStock(r, {}, NOW)))).toEqual(["plain", "later", "soon"]);
    expect(openAuctionCount(rows, {}, NOW)).toBe(2);
  });

  it("show only open auctions when asked, the soonest to end first", () => {
    expect(ids(filterAndSortProducts(rows, { ...query, auctionsOnly: true, sort: "ending" }, {}, [], NOW))).toEqual(["soon", "later"]);
    // Ending soonest in the whole list: open auctions first, then the rest newest first.
    expect(ids(filterAndSortProducts(rows, { ...query, sort: "ending" }, {}, [], NOW))).toEqual(["soon", "later", "plain", "over", "gone"]);
    expect(ids(filterAndSortProducts(rows, { ...query, inStockOnly: true }, {}, [], NOW))).toEqual(["plain", "later", "soon"]);
  });

  it("let the catalogue's terms win once it's loaded", () => {
    const catalogues: CatalogueMap = {
      c1: { id: "c1", products: { soon: { status: "OUT_OF_STOCK" }, plain: { status: "AVAILABLE", auction: { v: 1, start: NOW - H, end: NOW + 2 * H, startingBid: 1 } } } } as any,
    };
    expect(openAuctionCount(rows, catalogues, NOW)).toBe(1);
    expect(ids(filterAndSortProducts(rows, { ...query, auctionsOnly: true }, catalogues, [], NOW))).toEqual(["plain"]);
  });
});
