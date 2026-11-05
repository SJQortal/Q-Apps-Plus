import { describe, expect, it } from "vitest";
import { decodeData64 } from "../test/fixtures/shop";
import {
  buildFavoriteCounts,
  buildFavoritePublish,
  buildUnfavoritePublish,
  favProductIdentifier,
  favoriteOfRow,
  favoriteProduct,
  favoriteShop,
} from "./model";

const shop = favoriteShop("Seller Name", "q-store-general-my-shop")!;
const product = favoriteProduct("Seller Name", "q-store-general-my-shop", "q-store-product-my-shop-P000000003", "q-store-catalogue-my-shop-CAT0000000")!;
const row = (name: string, request: { identifier: string; title: string; description: string }, extra: Record<string, unknown> = {}) =>
  ({ name, service: "DOCUMENT", identifier: request.identifier, metadata: { title: request.title, description: request.description }, ...extra }) as never;

describe("favourites", () => {
  it("are one DOCUMENT per shop or product, under the buyer's name, that a search row describes in full", () => {
    expect(shop.identifier).toBe("q-store-favs-my-shop");
    expect(product.identifier).toBe("q-store-favp-my-shop-P000000003");
    expect(favProductIdentifier("not-a-product")).toBeNull();
    const publish = buildFavoritePublish({ name: "Ann Buyer", fav: product, now: 5 });
    expect(publish).toMatchObject({
      action: "PUBLISH_QDN_RESOURCE",
      name: "Ann Buyer",
      service: "DOCUMENT",
      identifier: "q-store-favp-my-shop-P000000003",
      filename: "favorite.json",
      title: "Favourite product",
      description: "fav:Seller%20Name;cat:q-store-catalogue-my-shop-CAT0000000",
    });
    expect(decodeData64(publish.data64)).toEqual({
      v: 1,
      kind: "product",
      storeId: "q-store-general-my-shop",
      owner: "Seller Name",
      productId: "q-store-product-my-shop-P000000003",
      catalogueId: "q-store-catalogue-my-shop-CAT0000000",
      created: 5,
    });
    // The row gives the favourite back, shop or product.
    expect(favoriteOfRow(row("Ann Buyer", publish))).toEqual(product);
    expect(favoriteOfRow(row("Ann Buyer", buildFavoritePublish({ name: "Ann Buyer", fav: shop, now: 5 })))).toEqual(shop);
  });

  it("are removed by a tombstone the searches leave out", () => {
    const removed = buildUnfavoritePublish({ name: "Ann Buyer", identifier: shop.identifier });
    expect(removed).toMatchObject({ identifier: "q-store-favs-my-shop", title: "deleted", description: "deleted", tags: ["deleted"] });
    expect(decodeData64(removed.data64)).toEqual({ deleted: true });
    expect(favoriteOfRow({ name: "Ann Buyer", service: "DOCUMENT", identifier: removed.identifier, metadata: { title: "deleted", description: "deleted", tags: ["deleted"] } } as never)).toBeNull();
  });

  it("count once per name, for the owner each names, never the owner's own", () => {
    const fav = buildFavoritePublish({ name: "x", fav: shop, now: 1 });
    const other = buildFavoritePublish({ name: "x", fav: favoriteShop("Someone Else", "q-store-general-my-shop")!, now: 1 });
    const counts = buildFavoriteCounts([
      row("Ann Buyer", fav),
      row("Bob", fav),
      row("Seller Name", fav),
      row("Carol", other),
      row("Dan", buildFavoritePublish({ name: "x", fav: product, now: 1 })),
      row("Eve", buildUnfavoritePublish({ name: "Eve", identifier: shop.identifier })),
    ]);
    expect(counts.shop("Seller Name", "my-shop")).toBe(2);
    expect(counts.shop("Someone Else", "my-shop")).toBe(1);
    expect(counts.product("Seller Name", "q-store-product-my-shop-P000000003")).toBe(1);
    expect(counts.shop("Nobody", "my-shop")).toBe(0);
  });
});
