import { describe, expect, it } from "vitest";
import { MAX_PRODUCT_ORDER, arrangeProducts, buildProductOrderPublish, featuredOrder, productOrderOf } from "./productOrder";
import { base64ToJson, type DataContainerDoc } from "./payloads";
import { DATA_CONTAINER_ID, SELLER, STORE_ID, chair, dataContainer, mug, poster } from "../test/fixtures/shop";

describe("the seller's product order", () => {
  it("reads only product ids, once each, at most the limit", () => {
    expect(productOrderOf({ productOrder: ["a", 3, "", "b", "a", null] })).toEqual(["a", "b"]);
    expect(productOrderOf({ productOrder: "a,b" })).toEqual([]);
    expect(productOrderOf(null)).toEqual([]);
    const many = Array.from({ length: MAX_PRODUCT_ORDER + 5 }, (_, i) => `p${i}`);
    expect(productOrderOf({ productOrder: many })).toHaveLength(MAX_PRODUCT_ORDER);
  });

  it("arranges the listed products: the order's first, then the rest as given; unlisted ids go", () => {
    expect(arrangeProducts(["c", "gone", "a"], ["a", "b", "c", "d"])).toEqual(["c", "a", "b", "d"]);
    expect(arrangeProducts([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("publishes the product index with the order added, its original shape otherwise unchanged", () => {
    const dc = dataContainer as unknown as DataContainerDoc;
    const built = buildProductOrderPublish({ name: SELLER, storeId: STORE_ID, dataContainer: dc, order: [chair.id, mug.id, chair.id] });
    expect(built.resources).toHaveLength(1);
    const [resource] = built.resources;
    expect(resource).toMatchObject({ name: SELLER, service: "DOCUMENT", identifier: DATA_CONTAINER_ID, filename: "datacontainer.json" });
    const sent = base64ToJson(resource.data64);
    expect(sent).toEqual({ ...dataContainer, productOrder: [chair.id, mug.id] });
    expect(Object.keys(sent).slice(0, -1)).toEqual(Object.keys(dataContainer));
    // Back to newest first: an empty order, so an older copy can't bring the old one back.
    const cleared = buildProductOrderPublish({ name: SELLER, storeId: STORE_ID, dataContainer: { ...dc, productOrder: [poster.id] }, order: [] });
    expect(base64ToJson(cleared.resources[0].data64).productOrder).toEqual([]);
  });
});

describe("featuredOrder", () => {
  it("puts each collection's products first, in collection order, once each, then the shop's order", () => {
    const { order, sectionOf } = featuredOrder(
      [
        { products: ["b", "a"] },
        { products: ["a", "c"] },
        { products: [] },
      ],
      ["d", "c", "e"]
    );
    expect(order).toEqual(["b", "a", "c", "d", "e"]);
    expect([...sectionOf]).toEqual([
      ["b", 0],
      ["a", 0],
      ["c", 1],
    ]);
  });

  it("without collections is the shop's order", () => {
    expect(featuredOrder([], ["x", "y"])).toEqual({ order: ["x", "y"], sectionOf: new Map() });
  });
});
