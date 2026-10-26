import { describe, expect, it } from "vitest";
import { normalizeShopJson } from "./shopJson";
import { coinLabel, shopCoins } from "../money/coins";
import { checkStructureStore } from "../utils/checkStructure";

const goodShop = {
  title: "Seller's Shop",
  description: "Mugs",
  location: "Lisbon",
  shipsTo: "Europe",
  created: 1690000000000,
  shortStoreId: "my-shop",
  logo: "data:image/webp;base64,TE9HTw==",
  supportedCoins: ["QORT", "ARRR", "BTC"],
  foreignCoins: { ARRR: "zs1arrr", BTC: "bc1q" },
  acceptedAssets: [{ id: 7, name: "Gold" }],
  // Fields the app doesn't check are kept as they are.
  category: "Art",
  tags: ["mugs"],
};

describe("a shop's JSON, read safely", () => {
  it("keeps a well-formed shop as it is", () => {
    expect(normalizeShopJson(goodShop)).toEqual(goodShop);
  });

  it("isn't a shop when the JSON isn't an object", () => {
    expect(normalizeShopJson(null)).toBeNull();
    expect(normalizeShopJson("shop")).toBeNull();
    expect(normalizeShopJson([goodShop])).toBeNull();
  });

  it("drops coin fields of the wrong type, which crashed every screen that listed the shop", () => {
    const bad = { ...goodShop, supportedCoins: 1, foreignCoins: { ARRR: 5, BTC: "bc1q" }, acceptedAssets: {} };
    // Before night 1's fixes this threw a TypeError during render; shopCoins
    // is defensive now too, and the normalised copy is what screens use.
    expect(() => shopCoins(bad as never)).not.toThrow();
    const shop = normalizeShopJson(bad)!;
    expect(shop.supportedCoins).toEqual([]);
    expect(shop.foreignCoins).toEqual({ BTC: "bc1q" });
    expect(shop.acceptedAssets).toEqual([]);
    expect(shopCoins(shop)).toEqual(["QORT"]);
  });

  it("keeps an asset's price setting when it's well formed (the shop page priced nothing in the asset without it)", () => {
    const shop = normalizeShopJson({
      ...goodShop,
      acceptedAssets: [
        { id: 7, name: "Gold", price: { from: "market" } },
        { id: 8, name: "Silver", price: { from: "seller", qort: "a lot" } },
      ],
    })!;
    expect(shop.acceptedAssets).toEqual([
      { id: 7, name: "Gold", price: { from: "market" } },
      { id: 8, name: "Silver" },
    ]);
  });

  it("keeps only text tickers and addresses", () => {
    const shop = normalizeShopJson({ ...goodShop, supportedCoins: ["QORT", 5, null, "ARRR", { t: 1 }], foreignCoins: ["zs1"] })!;
    expect(shop.supportedCoins).toEqual(["QORT", "ARRR"]);
    expect(shop.foreignCoins).toEqual({});
    expect(shopCoins(shop)).toEqual(["QORT", "ASSET:7"]);
  });

  it("keeps only assets with a positive whole id and a text name", () => {
    const shop = normalizeShopJson({
      ...goodShop,
      acceptedAssets: [
        { id: 7, name: "Gold" },
        { id: 0, name: "Zero" },
        { id: 2.5, name: "Half" },
        { id: "9", name: "Text id" },
        { id: 11, name: { en: "Object" } },
        { id: 12 },
        null,
        "13",
        { id: 14, name: "Silver", extra: true },
      ],
    })!;
    expect(shop.acceptedAssets).toEqual([
      { id: 7, name: "Gold" },
      { id: 14, name: "Silver" },
    ]);
    expect(coinLabel("ASSET:14", shop)).toBe("Silver");
  });

  it("drops text fields that aren't text, so nothing renders an object", () => {
    const shop = normalizeShopJson({ ...goodShop, title: { a: 1 }, description: 5, location: [], shipsTo: true, logo: {}, shortStoreId: 1 })!;
    expect(shop).not.toHaveProperty("title");
    expect(shop).not.toHaveProperty("description");
    expect(shop).not.toHaveProperty("location");
    expect(shop).not.toHaveProperty("shipsTo");
    expect(shop).not.toHaveProperty("logo");
    expect(shop).not.toHaveProperty("shortStoreId");
    // So the original's check no longer calls it a shop.
    expect(checkStructureStore(shop)).toBe(false);
  });

  it("keeps a numeric date and drops any other", () => {
    expect(normalizeShopJson({ ...goodShop, created: "1690000000000" })!.created).toBe(1690000000000);
    expect(normalizeShopJson({ ...goodShop, created: { at: 1 } })).not.toHaveProperty("created");
  });
});
