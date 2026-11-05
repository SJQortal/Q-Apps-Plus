import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assetPricingOf, assetRate, fetchAssetQuote, resetAssetRates } from "./assetRates";
import { shopAssets } from "./coins";
import { unitPrice } from "./pricing";
import { resetAssetCache } from "../qdn/assets";

/** The node: trades and asks per asset, as Core answers them; asset info for divisibility. */
function node(answers: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) => {
    const path = url.replace(/&limit=\d+/, "");
    const body = answers[path] ?? (path.startsWith("/assets/info") ? { assetId: 88, name: "BHC Coin", isDivisible: true } : []);
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  resetAssetRates();
  resetAssetCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("a Q-Asset's trade portal price", () => {
  it("is its latest trade with QORT, whichever side started it", async () => {
    node({
      // QORT given for BHC Coin: 5.5 QORT for 100.
      "/assets/trades/recent?assetid=0&otherassetid=88": [{ assetId: 0, otherAssetId: 88, amount: "5.5", otherAmount: "100", timestamp: 1000 }],
      // BHC Coin given for QORT, later: 50 for 3 QORT.
      "/assets/trades/recent?assetid=88&otherassetid=0": [{ assetId: 88, otherAssetId: 0, amount: "50", otherAmount: "3", timestamp: 2000 }],
    });
    expect(await fetchAssetQuote(88)).toEqual({ qort: 0.06, source: "trade", at: 2000 });
  });

  it("is the lowest offer when it never traded, and nothing when it has neither", async () => {
    const fetch = node({ "/assets/orderbook/87/0?limit=1": [{ price: "0.20000000", unfulfilled: "10000" }] });
    expect(await fetchAssetQuote(87)).toEqual({ qort: 0.2, source: "offer" });
    expect(await fetchAssetQuote(87)).toEqual({ qort: 0.2, source: "offer" });
    // Read once, then from the session's copy.
    expect(fetch.mock.calls.filter(([u]) => String(u).startsWith("/assets/orderbook"))).toHaveLength(1);
    expect(await fetchAssetQuote(5)).toBeNull();
  });
});

describe("an accepted asset's price setting", () => {
  it("is kept with the asset, and anything else reads as none", () => {
    expect(assetPricingOf({ from: "market" })).toEqual({ from: "market" });
    expect(assetPricingOf({ from: "seller", qort: 0.05 })).toEqual({ from: "seller", qort: 0.05 });
    expect(assetPricingOf({ from: "seller", qort: -1 })).toBeUndefined();
    expect(assetPricingOf("market")).toBeUndefined();
    expect(shopAssets({ acceptedAssets: [{ id: 88, name: "BHC Coin", price: { from: "seller", qort: 0.05 } }, { id: 7, name: "Gold", price: { from: "web" } } as never] })).toEqual([
      { id: 88, name: "BHC Coin", price: { from: "seller", qort: 0.05 } },
      { id: 7, name: "Gold" },
    ]);
  });

  it("converts QORT prices at the seller's rate, rounded up to whole units for an indivisible asset", async () => {
    node({ "/assets/info?assetId=89": { assetId: 89, name: "Whole", isDivisible: false } });
    const own = await assetRate(88, { from: "seller", qort: 0.05 });
    expect(own).toEqual({ rate: 20, qort: 0.05, source: "seller" });
    expect(unitPrice({ price: [{ currency: "qort", value: 1.5 }] }, "ASSET:88", own!.rate)).toBe(30);
    const whole = await assetRate(89, { from: "seller", qort: 0.4 });
    // 1.5 QORT at 0.4 QORT each is 3.75: 4 whole units.
    expect(unitPrice({ price: [{ currency: "qort", value: 1.5 }] }, "ASSET:89", whole!.rate)).toBe(4);
    expect(await assetRate(88, undefined)).toBeNull();
  });
});
