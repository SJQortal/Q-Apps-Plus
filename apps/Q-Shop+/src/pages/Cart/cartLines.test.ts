import { describe, expect, it } from "vitest";
import { CATALOGUE_ID, SELLER, STORE_ID, catalogue, chair, mug, poster } from "../../test/fixtures/shop";
import type { Cart } from "../../state/features/cartSlice";
import {
  cartShopFrom,
  cartViewLines,
  catalogueFor,
  checkoutLinesOf,
  isLeftOut,
  priceLines,
  shortAddress,
} from "./cartLines";

const OTHER_CATALOGUE = "q-store-catalogue-my-shop-OTHERxxxx";

function cartOf(...ids: string[]): Cart {
  const orders: Cart["orders"] = {};
  for (const id of ids) {
    const catalogueId = id.startsWith("missing") ? OTHER_CATALOGUE : CATALOGUE_ID;
    orders[id] = { productId: id, catalogueId, quantity: 2 };
  }
  return { orders, lastUpdated: 1, storeId: STORE_ID, storeOwner: SELLER };
}

const retired = { ...poster, id: "q-store-product-my-shop-RETIREDxx", status: "RETIRED" };
const outOfStock = { ...chair, id: "q-store-product-my-shop-OOSxxxxxxx", status: "OUT_OF_STOCK" };
const catalogues = {
  [CATALOGUE_ID]: {
    ...catalogue,
    user: SELLER,
    products: { ...catalogue.products, [retired.id]: retired, [outOfStock.id]: outOfStock },
  },
} as any;

describe("cart lines", () => {
  it("keeps the cart's order and says which lines can be bought", () => {
    const cart = cartOf(mug.id, retired.id, "q-store-product-my-shop-GONExxxxxx", outOfStock.id, "missing-1", poster.id);
    const lines = cartViewLines(cart, catalogues, () => "retrying");
    expect(lines.map((l) => [l.productId, l.state])).toEqual([
      [mug.id, "ready"],
      [retired.id, "unavailable"],
      ["q-store-product-my-shop-GONExxxxxx", "gone"],
      [outOfStock.id, "unavailable"],
      ["missing-1", "fetching"],
      [poster.id, "ready"],
    ]);
    expect(lines.filter(isLeftOut)).toHaveLength(3);
    // Only the lines for sale, as checkout's CartLine, the product object as the catalogue holds it.
    expect(checkoutLinesOf(lines)).toEqual([
      { productId: mug.id, catalogueId: CATALOGUE_ID, quantity: 2, product: mug },
      { productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 2, product: poster },
    ]);
    expect(cartViewLines(cartOf("missing-2"), catalogues, () => "failed")[0].state).toBe("failed");
    expect(cartViewLines(cartOf("missing-3"), catalogues, () => "loading")[0].state).toBe("loading");
  });

  it("never prices a line from another name's copy of the catalogue", () => {
    const copy = { [CATALOGUE_ID]: { ...catalogue, user: "Impostor" } } as any;
    expect(catalogueFor(copy, CATALOGUE_ID, SELLER)).toBeNull();
    expect(cartViewLines(cartOf(mug.id), copy, () => "loading")[0].state).toBe("loading");
    // A catalogue the app holds without a publisher (the seller's own drafts) is used.
    expect(catalogueFor({ [CATALOGUE_ID]: catalogue } as any, CATALOGUE_ID, SELLER)).not.toBeNull();
  });

  it("prices with the checkout service and names lines without a price in the coin", () => {
    const lines = checkoutLinesOf(cartViewLines(cartOf(mug.id, poster.id), catalogues, () => "loading"));
    expect(priceLines(lines, "QORT", null, false)).toMatchObject({ ok: true, amount: "3.20000000" });
    // Poster has its own ARRR price; Mug needs the rate.
    expect(priceLines(lines, "ARRR", null, true)).toEqual({ ok: false, reason: "rate", missing: ["Mug"] });
    expect(priceLines(lines, "ARRR", 0.5, false)).toMatchObject({ ok: true, amount: (1.5 * 0.5 * 2 + 0.25 * 2).toFixed(8) });
    expect(priceLines(lines, "ASSET:81", null, false)).toEqual({ ok: false, reason: "price", missing: ["Mug", "Poster"] });
    expect(priceLines([], "QORT", null, false)).toEqual({ ok: false, reason: "empty", missing: [] });
  });

  it("shapes a store for checkout and shortens addresses", () => {
    expect(
      cartShopFrom(STORE_ID, SELLER, {
        title: "T",
        supportedCoins: ["QORT"],
        foreignCoins: { ARRR: "x" },
        acceptedAssets: [{ id: 1, name: "A" }],
        logo: "data:x",
        extra: 1,
      })
    ).toEqual({
      id: STORE_ID,
      title: "T",
      owner: SELLER,
      supportedCoins: ["QORT"],
      foreignCoins: { ARRR: "x" },
      acceptedAssets: [{ id: 1, name: "A" }],
      logo: "data:x",
    });
    expect(shortAddress("zs1arrrpayoutaddressxxxxxxxxxxxxxxxxxxxxxxxxxxxx")).toBe("zs1arrrp…xxxxxx");
    expect(shortAddress("short")).toBe("short");
  });
});
