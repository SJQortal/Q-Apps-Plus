import { beforeEach, describe, expect, it } from "vitest";
import {
  changedCatalogueIds,
  indexKey,
  isOwnPublishNotServedYet,
  isProductIndexDoc,
  mergeProductIndexes,
  notePublishedIndex,
  resetPublishedIndexes,
} from "./productIndex";
import { CATALOGUE_ID, STORE_ID, SHORT_STORE_ID, chair, dataContainer, mug, poster } from "../test/fixtures/shop";
import type { DataContainerDoc } from "../qdn/payloads";

const seen = dataContainer as unknown as DataContainerDoc;
const C2 = `q-store-catalogue-${SHORT_STORE_ID}-CAT2xxxxx2`;
const LAMP = `q-store-product-${SHORT_STORE_ID}-LAMPxxxxx4`;
const VASE = `q-store-product-${SHORT_STORE_ID}-VASExxxxx5`;
const entry = (catalogueId: string, extra: Record<string, unknown> = {}) => ({
  created: 1,
  priceQort: 2,
  category: "Kitchen",
  catalogueId,
  status: "AVAILABLE",
  ...extra,
});

beforeEach(() => {
  resetPublishedIndexes();
});

describe("comparing copies of the product index", () => {
  it("compares what an index names, whatever the key order or the other fields", () => {
    const reordered = {
      catalogues: seen.catalogues,
      products: Object.fromEntries(Object.entries(seen.products).reverse()),
      owner: "someone",
    } as unknown as DataContainerDoc;
    expect(indexKey(reordered)).toBe(indexKey(seen));
    expect(indexKey({ ...seen, products: { ...seen.products, [mug.id]: { ...seen.products[mug.id], status: "RETIRED" } } })).not.toBe(
      indexKey(seen)
    );
  });

  it("knows a product index from other JSON", () => {
    expect(isProductIndexDoc(seen)).toBe(true);
    expect(isProductIndexDoc({ id: "x" })).toBe(false);
    expect(isProductIndexDoc({ products: [] })).toBe(false);
    expect(isProductIndexDoc(null)).toBe(false);
  });
});

describe("mergeProductIndexes", () => {
  it("keeps every product either copy names; the fresh copy wins for a product both have", () => {
    const fresh: DataContainerDoc = {
      ...seen,
      products: { ...seen.products, [mug.id]: entry(CATALOGUE_ID, { status: "OUT_OF_STOCK" }), [VASE]: entry(C2) },
      catalogues: [...(seen.catalogues ?? []), { id: C2, products: { [VASE]: true } }],
    };
    // The page has a product the node doesn't serve yet.
    const page: DataContainerDoc = {
      ...seen,
      products: { ...seen.products, [LAMP]: entry(CATALOGUE_ID) },
      catalogues: [{ id: CATALOGUE_ID, products: { ...seen.catalogues![0].products, [LAMP]: true } }],
    };
    const merged = mergeProductIndexes(page, fresh);
    expect(Object.keys(merged.products)).toEqual([mug.id, poster.id, chair.id, VASE, LAMP]);
    expect(merged.products[mug.id].status).toBe("OUT_OF_STOCK");
    expect(merged.catalogues).toEqual([
      { id: CATALOGUE_ID, products: { [mug.id]: true, [poster.id]: true, [chair.id]: true, [LAMP]: true } },
      { id: C2, products: { [VASE]: true } },
    ]);
    expect(merged.storeId).toBe(STORE_ID);
    // Neither input changes.
    expect(page.products[VASE]).toBeUndefined();
    expect(fresh.products[LAMP]).toBeUndefined();
  });

  it("lists a product only under the catalogue its entry names", () => {
    const moved: DataContainerDoc = {
      ...seen,
      products: { ...seen.products, [mug.id]: entry(C2) },
      catalogues: [
        { id: CATALOGUE_ID, products: { [poster.id]: true, [chair.id]: true } },
        { id: C2, products: { [mug.id]: true } },
      ],
    };
    const merged = mergeProductIndexes(seen, moved);
    expect(merged.catalogues?.[0].products).toEqual({ [poster.id]: true, [chair.id]: true });
    expect(merged.catalogues?.[1].products).toEqual({ [mug.id]: true });
  });

  it("is the page's copy when the fresh one names nothing new", () => {
    const older: DataContainerDoc = { ...seen, products: { [mug.id]: seen.products[mug.id] }, catalogues: [{ id: CATALOGUE_ID, products: { [mug.id]: true } }] };
    expect(indexKey(mergeProductIndexes(seen, older))).toBe(indexKey(seen));
  });

  it("names the catalogues to read again: of added or changed products, and with a changed list", () => {
    const fresh: DataContainerDoc = {
      ...seen,
      products: { ...seen.products, [VASE]: entry(C2) },
      catalogues: [...(seen.catalogues ?? []), { id: C2, products: { [VASE]: true } }],
    };
    expect(changedCatalogueIds(seen, mergeProductIndexes(seen, fresh))).toEqual([C2]);
    const edited: DataContainerDoc = { ...seen, products: { ...seen.products, [poster.id]: { ...seen.products[poster.id], priceQort: 9 } } };
    expect(changedCatalogueIds(seen, mergeProductIndexes(seen, edited))).toEqual([CATALOGUE_ID]);
    expect(changedCatalogueIds(seen, seen)).toEqual([]);
  });
});

describe("this session's own publish", () => {
  it("recognises the node still serving the list a publish replaced, only for that shop and that pair", () => {
    notePublishedIndex(STORE_ID, "before", "after");
    expect(isOwnPublishNotServedYet(STORE_ID, "after", "before")).toBe(true);
    expect(isOwnPublishNotServedYet(STORE_ID, "after", "something else")).toBe(false);
    expect(isOwnPublishNotServedYet(STORE_ID, "before", "after")).toBe(false);
    expect(isOwnPublishNotServedYet("q-store-general-other", "after", "before")).toBe(false);
  });
});
