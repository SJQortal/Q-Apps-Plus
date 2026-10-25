import { describe, expect, it } from "vitest";
import { moreFromShopRows, MORE_FROM_SHOP } from "./MoreFromShop";

const row = (created: number, extra: object = {}) => ({ created, priceQort: 1, category: "Toys & Hobbies", catalogueId: "c1", status: "AVAILABLE", ...extra });

describe("more from the shop", () => {
  it("leaves out this product, retired ones and this product's group; one tile a group, its lead's", () => {
    const index = {
      products: {
        me: row(9, { variant: { group: "G1", values: ["Red"] } }),
        sib: row(8, { variant: { group: "G1", values: ["Blue"] } }),
        a: row(7),
        old: row(6, { status: "RETIRED" }),
        l2: row(5, { variant: { group: "G2", values: ["S"] } }),
        m2: row(4, { variant: { group: "G2", values: ["M"] } }),
      },
      variantGroups: { G1: { lead: "me" }, G2: { lead: "m2" } },
    };
    expect(moreFromShopRows(index, "me", "G1").map((r) => r.productId)).toEqual(["a", "m2"]);
  });

  it("follows the shop's own order first, then newest, at most 8", () => {
    const products = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`p${i}`, row(i)]));
    const rows = moreFromShopRows({ products, productOrder: ["p2", "p5"] }, "p11", null);
    expect(rows).toHaveLength(MORE_FROM_SHOP);
    expect(rows.slice(0, 4).map((r) => r.productId)).toEqual(["p2", "p5", "p10", "p9"]);
  });

  it("is empty for a shop with only this product", () => {
    expect(moreFromShopRows({ products: { me: row(1) } }, "me", null)).toEqual([]);
    expect(moreFromShopRows(null, "me", null)).toEqual([]);
  });
});
