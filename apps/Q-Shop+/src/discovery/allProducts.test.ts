import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  INDEX_BATCH,
  catalogueKey,
  categoryKey,
  categoryOptions,
  filterAndSortAll,
  matchesAllSearch,
  newestFrontier,
  rowsOfShop,
  searchAll,
  searchCatalogueKeys,
  shopSources,
  useAllCatalogues,
  useAllProducts,
  type AllCatalogues,
  type AllProductRow,
  type ShopSource,
} from "./allProducts";
import { buildActivityIndex } from "./activity";
import { shopKey, type ShopEntry } from "./shopIndex";
import { installMockNode, makeWorld } from "../test/mockNode";
import type { Catalogue } from "../state/features/globalSlice";

function entry(owner: string, short: string, title = `${owner}'s shop`): ShopEntry {
  const id = `q-store-general-${short}`;
  return { key: shopKey(owner, id), owner, id, shortStoreId: short, title, description: "", created: 1, updated: 1, acceptsArrr: false };
}

function source(owner: string, short: string, updated: number): ShopSource {
  const id = `q-store-general-${short}`;
  return { key: shopKey(owner, id), owner, storeId: id, title: `${owner}'s shop`, updated };
}

function row(owner: string, productId: string, extra: Partial<AllProductRow> = {}): AllProductRow {
  return {
    key: `${owner}\u0000q-store-general-s\u0000${productId}`,
    owner,
    storeId: "q-store-general-s",
    shopTitle: `${owner}'s shop`,
    productId,
    catalogueId: "q-store-catalogue-s-CAT0000001",
    created: 1,
    status: "AVAILABLE",
    ...extra,
  };
}

function catalogue(id: string, products: Record<string, object>): Catalogue {
  return { id, products } as unknown as Catalogue;
}

describe("which shops, in which order", () => {
  it("reads the most recently updated product index first, and skips shops without one", () => {
    const shops = [entry("Ann", "a"), entry("Bob", "b"), entry("Cy", "c")];
    const activity = buildActivityIndex([
      { name: "Ann", service: "DOCUMENT", identifier: "q-store-general-a-datacontainer", created: 1, updated: 50 },
      { name: "Cy", service: "DOCUMENT", identifier: "q-store-general-c-datacontainer", created: 1, updated: 90 },
      // Another name's index for Bob's shop id: not Bob's.
      { name: "Mallory", service: "DOCUMENT", identifier: "q-store-general-b-datacontainer", created: 1, updated: 99 },
    ]);
    expect(shopSources(shops, activity).map((s) => [s.owner, s.updated])).toEqual([
      ["Cy", 90],
      ["Ann", 50],
    ]);
  });

  it("reads last, as possibly newest, the shops a cut-short index search didn't reach", () => {
    const shops = [entry("Ann", "a"), entry("Bob", "b")];
    const activity = buildActivityIndex(
      [{ name: "Ann", service: "DOCUMENT", identifier: "q-store-general-a-datacontainer", created: 1, updated: 50 }],
      false
    );
    const sources = shopSources(shops, activity);
    expect(sources.map((s) => s.owner)).toEqual(["Ann", "Bob"]);
    expect(sources[1].updated).toBe(Number.POSITIVE_INFINITY);
    // Until Bob's is read, nothing is known to be newest.
    expect(newestFrontier(sources, (key) => key === sources[0].key)).toBe(Number.POSITIVE_INFINITY);
  });

  it("knows a product is in its final place once no unread index was updated after it", () => {
    const sources = [source("Cy", "c", 90), source("Ann", "a", 50), source("Bob", "b", 20)];
    const settled = new Set([sources[0].key]);
    expect(newestFrontier(sources, (key) => settled.has(key))).toBe(50);
    // Read out of order: Bob's arrived before Ann's.
    settled.add(sources[2].key);
    expect(newestFrontier(sources, (key) => settled.has(key))).toBe(50);
    settled.add(sources[1].key);
    expect(newestFrontier(sources, (key) => settled.has(key))).toBe(Number.NEGATIVE_INFINITY);
  });

  it("turns an index into rows that carry their shop, skipping what isn't a product", () => {
    const rows = rowsOfShop(source("Ann", "a", 1), {
      products: {
        P1: { created: 5, priceQort: 2, category: "Art", catalogueId: "C1", status: "AVAILABLE" },
        P2: { created: 9, catalogueId: "C1" },
        bad: { created: 1 },
        worse: "x",
      },
    });
    expect(rows.map((r) => [r.productId, r.owner, r.storeId, r.shopTitle])).toEqual([
      ["P2", "Ann", "q-store-general-a", "Ann's shop"],
      ["P1", "Ann", "q-store-general-a", "Ann's shop"],
    ]);
    expect(rows[0].key).toBe("Ann\u0000q-store-general-a\u0000P2");
    expect(rowsOfShop(source("Ann", "a", 1), "D")).toEqual([]);
    expect(rowsOfShop(source("Ann", "a", 1), null)).toEqual([]);
  });
});

describe("filters and sorts across shops", () => {
  const rows = [
    row("Ann", "A1", { created: 30, priceQort: 5, category: "Art" }),
    row("Bob", "B1", { created: 20, priceQort: 1, category: " art" }),
    row("Cy", "C1", { created: 30, priceQort: 9, category: "Kitchen", status: "OUT_OF_STOCK" }),
    row("Dee", "D1", { created: 40, priceQort: 3, category: "Kitchen", status: "RETIRED" }),
    row("Eve", "E1", { created: 10, category: undefined }),
  ];

  it("lists what a shop page lists, newest first, equal times in a fixed order", () => {
    expect(filterAndSortAll(rows, { categories: [], inStockOnly: false, sort: "newest" }, {}).map((r) => r.productId)).toEqual([
      "A1",
      "C1",
      "B1",
      "E1",
    ]);
    expect(filterAndSortAll(rows, { categories: [], inStockOnly: true, sort: "price-asc" }, {}).map((r) => r.productId)).toEqual([
      "B1",
      "A1",
      "E1",
    ]);
  });

  it("filters by categories whatever their case and spaces", () => {
    expect(categoryKey(" Art ")).toBe("art");
    expect(
      filterAndSortAll(rows, { categories: ["art"], inStockOnly: false, sort: "oldest" }, {}).map((r) => r.productId)
    ).toEqual(["B1", "A1"]);
    expect(
      filterAndSortAll(rows, { categories: ["art", "kitchen"], inStockOnly: false, sort: "newest" }, {}).map((r) => r.productId)
    ).toEqual(["A1", "C1", "B1"]);
  });

  it("offers each category once, with the spelling most products use and how many there are", () => {
    const options = categoryOptions([
      ...rows,
      row("Fay", "F1", { category: "Art" }),
      row("Gus", "G1", { category: "Zines" }),
      row("Hal", "H1", { category: "  " }),
    ]);
    expect(options).toEqual([
      { key: "art", label: "Art", count: 3 },
      { key: "kitchen", label: "Kitchen", count: 2 },
      { key: "zines", label: "Zines", count: 1 },
    ]);
  });

  it("reads each product in its own owner's catalogue, never another name's of the same id", () => {
    const shared = "q-store-catalogue-s-CAT0000001";
    const ann = row("Ann", "P1", { catalogueId: shared });
    const copy = row("Mallory", "P1", { catalogueId: shared });
    const catalogues: AllCatalogues = {
      [catalogueKey("Ann", shared)]: catalogue(shared, { P1: { title: "Ann's mug", status: "AVAILABLE" } }),
      // Mallory's catalogue of that id no longer holds the product.
      [catalogueKey("Mallory", shared)]: catalogue(shared, {}),
    };
    expect(filterAndSortAll([ann, copy], { categories: [], inStockOnly: false, sort: "newest" }, catalogues)).toEqual([ann]);
  });

  it("searches products and their shops, in at most so many catalogues", () => {
    const a = row("Ann", "A1", { catalogueId: "C1" });
    const b = row("Bob", "B1", { catalogueId: "C1", shopTitle: "Gold corner" });
    const c = row("Cy", "C1", { catalogueId: "C2" });
    expect(searchCatalogueKeys([a, b, c, a], 2)).toEqual({ keys: [catalogueKey("Ann", "C1"), catalogueKey("Bob", "C1")], capped: true });
    const catalogues: AllCatalogues = {
      [catalogueKey("Ann", "C1")]: catalogue("C1", { A1: { title: "Gold ring", description: "18 carat" } }),
      [catalogueKey("Bob", "C1")]: catalogue("C1", { B1: { title: "Silver ring" } }),
    };
    const keys = [catalogueKey("Ann", "C1"), catalogueKey("Bob", "C1"), catalogueKey("Cy", "C2")];
    expect(searchAll([a, b, c], ["gold"], keys, catalogues)).toEqual([a, b]);
    expect(searchAll([a, b, c], ["ring", "carat"], keys, catalogues)).toEqual([a]);
    // Not loaded yet: not a match yet.
    expect(searchAll([c], ["cy"], keys, catalogues)).toEqual([]);
    // A title that isn't text is no match, not a crash.
    expect(matchesAllSearch(a, { title: { x: 1 } } as never, ["x"])).toBe(false);
  });
});

describe("loading", () => {
  it("reads the shop list and only the newest indexes first, then more as asked", async () => {
    const world = makeWorld({ shops: 20, productsPerShop: 3 });
    const node = installMockNode(world);
    const { result } = renderHook(() => useAllProducts());
    await waitFor(() => expect(result.current.read).toBe(INDEX_BATCH));
    expect(result.current.total).toBe(20);
    expect(result.current.complete).toBe(false);
    // Two searches (shops, product indexes) and one index per shop read.
    expect(node.summary().searches).toEqual({ STORE: 1, DOCUMENT: 1 });
    expect(node.summary().resources).toEqual({ "data container": INDEX_BATCH });
    // The shops updated last come first: shops 19 to 12.
    expect(new Set(result.current.rows.map((r) => r.owner))).toEqual(
      new Set(Array.from({ length: INDEX_BATCH }, (_, i) => `Seller ${19 - i}`))
    );
    // Nothing unread was updated after shop 11's index.
    expect(result.current.frontier).toBe(world.shops[11].updated + 1000);

    act(() => result.current.readMore());
    await waitFor(() => expect(result.current.read).toBe(2 * INDEX_BATCH));
    act(() => result.current.readAll());
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.rows).toHaveLength(60);
    expect(result.current.frontier).toBe(Number.NEGATIVE_INFINITY);
    expect(node.summary().resources).toEqual({ "data container": 20 });
    expect(node.summary().unlimitedSearches).toBe(0);
  });

  it("leaves out deleted shops, and counts an index the node can't give, with Retry", async () => {
    const world = makeWorld({ shops: 4, productsPerShop: 2 });
    world.shops[2].deleted = "marked";
    const node = installMockNode(world);
    const missing = "/arbitrary/DOCUMENT/Seller%203/q-store-general-shop-3-datacontainer";
    const nodeFetch = globalThis.fetch as unknown as (url: string) => Promise<unknown>;
    let down = true;
    vi.stubGlobal("fetch", async (url: string) =>
      down && url === missing ? { ok: false, status: 404, json: async () => ({ error: 1401 }), text: async () => '{"error":1401}' } : nodeFetch(url)
    );

    const { result } = renderHook(() => useAllProducts());
    await waitFor(() => expect(result.current.complete).toBe(true));
    expect(result.current.total).toBe(3);
    expect(result.current.failed).toBe(1);
    expect(new Set(result.current.rows.map((r) => r.owner))).toEqual(new Set(["Seller Name", "Shop+Plus"]));
    expect(node.fetchCalls.some((u) => u.includes("shop-2-datacontainer"))).toBe(false);

    down = false;
    act(() => result.current.retryFailed());
    await waitFor(() => expect(result.current.rows.filter((r) => r.owner === "Seller 3")).toHaveLength(2));
    expect(result.current.failed).toBe(0);
    expect(result.current.complete).toBe(true);
  });

  it("reads catalogues by owner and id, once each", async () => {
    const world = makeWorld({ shops: 2, productsPerShop: 2 });
    const node = installMockNode(world);
    const { result } = renderHook(() => useAllCatalogues());
    const cat = "q-store-catalogue-my-shop-CAT0000000";
    act(() => {
      result.current.load([
        { owner: "Seller Name", catalogueId: cat },
        { owner: "Seller Name", catalogueId: cat },
      ]);
    });
    await waitFor(() => expect(result.current.catalogues[catalogueKey("Seller Name", cat)]).toBeTruthy());
    act(() => result.current.load([{ owner: "Seller Name", catalogueId: cat }]));
    expect(node.fetchCalls.filter((u) => u.includes(cat))).toHaveLength(1);
  });
});
