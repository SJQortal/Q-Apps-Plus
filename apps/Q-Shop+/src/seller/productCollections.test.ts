import { describe, expect, it } from "vitest";
import type { ShopCollection } from "../qdn/collections";
import { collectionsWith, placeInCollections } from "./productCollections";

const c = (id: string, products: string[]): ShopCollection => ({ id, title: id, description: "", products, created: 1, updated: 1 });

describe("a product's collections from its form", () => {
  const shop = [c("mugs", ["m1", "p1"]), c("art", ["a1"]), c("sale", [])];

  it("finds the collections that hold any of its ids (a group's items)", () => {
    expect(collectionsWith(shop, ["p1"])).toEqual(["mugs"]);
    expect(collectionsWith(shop, ["x", "a1"])).toEqual(["art"]);
    expect(collectionsWith(shop, ["new"])).toEqual([]);
  });

  it("adds its ids at the end of the chosen ones and takes them out of the rest", () => {
    const next = placeInCollections(shop, ["p1", "p2"], ["art", "mugs"], 9);
    expect(next.map((x) => [x.id, x.products, x.updated])).toEqual([
      ["mugs", ["m1", "p1", "p2"], 9],
      ["art", ["a1", "p1", "p2"], 9],
      ["sale", [], 1],
    ]);
    expect(placeInCollections(shop, ["p1"], [], 9)[0].products).toEqual(["m1"]);
  });

  it("leaves every collection as it was when nothing changes", () => {
    const next = placeInCollections(shop, ["p1"], ["mugs"], 9);
    expect(next.every((x, i) => x === shop[i])).toBe(true);
  });
});
