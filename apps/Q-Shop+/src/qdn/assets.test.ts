import { describe, expect, it } from "vitest";
import { isWholeAmount, suggestAssets, toAsset, type CoreAsset } from "./assets";

// As Core answers /assets/info?assetId=88 on mainnet (2026-10-22).
const BHC_COIN = {
  assetId: 88,
  owner: "QfX9KhXnoB78v2D36j7nocKaYtzUYcyQyH",
  name: "BHC Coin",
  description: "BHC Coin is the native Coin of Biohackers Corner.",
  quantity: 40204200000000,
  isDivisible: true,
  data: "{}",
  isUnspendable: false,
  creationGroupId: 0,
};

const asset = (assetId: number, assetName: string, extra: Partial<CoreAsset> = {}): CoreAsset => ({ assetId, assetName, ...extra });

describe("Core's assets", () => {
  it("reads Core's shape, where an asset's name is `name`", () => {
    expect(toAsset(BHC_COIN)).toEqual({
      assetId: 88,
      assetName: "BHC Coin",
      owner: "QfX9KhXnoB78v2D36j7nocKaYtzUYcyQyH",
      description: "BHC Coin is the native Coin of Biohackers Corner.",
      isDivisible: true,
      isUnspendable: false,
    });
    // `assetName` (a transaction's field) still reads, should something write it.
    expect(toAsset({ assetId: 5, assetName: "Old" })?.assetName).toBe("Old");
    expect(toAsset({ assetId: 5 })).toBeNull();
    expect(toAsset({ error: 601 })).toBeNull();
  });

  it("suggests by id, then the exact name in any case, then names and words starting with it, then names containing it", () => {
    const all = [
      asset(0, "QORT"),
      asset(10, "10Coin"),
      asset(67, "Bitcoin"),
      asset(75, "X-Coin"),
      asset(87, "BHC"),
      asset(88, "BHC Coin"),
      asset(8, "DEEZCOIN"),
    ];
    expect(suggestAssets(all, "bhc").map((a) => a.assetId)).toEqual([87, 88]);
    expect(suggestAssets(all, "BHC COIN").map((a) => a.assetId)).toEqual([88]);
    // "coin": no name is it or starts with it; words starting with it (X-Coin, BHC Coin) before names containing it.
    expect(suggestAssets(all, "coin").map((a) => a.assetName)).toEqual(["X-Coin", "BHC Coin", "10Coin", "Bitcoin", "DEEZCOIN"]);
    expect(suggestAssets(all, "#88").map((a) => a.assetId)).toEqual([88]);
    expect(suggestAssets(all, "10").map((a) => a.assetId)).toEqual([10]);
    expect(suggestAssets(all, "qort")).toEqual([]);
    expect(suggestAssets(all, "  ")).toEqual([]);
    expect(suggestAssets(all, "coin", 2)).toHaveLength(2);
  });

  it("knows a whole number of units", () => {
    expect(isWholeAmount("3.00000000")).toBe(true);
    expect(isWholeAmount(2)).toBe(true);
    expect(isWholeAmount("1.50000000")).toBe(false);
    expect(isWholeAmount("abc")).toBe(false);
  });
});
