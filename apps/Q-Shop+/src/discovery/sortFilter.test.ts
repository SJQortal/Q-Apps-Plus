import { describe, expect, it } from "vitest";
import { filterShops, lastActive, parsePay, parseSort, payMatch, sortShops } from "./sortFilter";
import { buildRatingsIndex } from "./ratings";
import { buildActivityIndex } from "./activity";
import { shopKey, type ShopEntry } from "./shopIndex";
import type { ShopDetails } from "./shopDetails";

function shop(owner: string, short: string, created: number, extra: Partial<ShopEntry> = {}): ShopEntry {
  const id = `q-store-general-${short}`;
  return {
    key: shopKey(owner, id),
    owner,
    id,
    shortStoreId: short,
    title: short,
    description: "",
    created,
    updated: created,
    acceptsArrr: false,
    ...extra,
  };
}

const ready = (json: object, valid = true): ShopDetails => ({ status: "ready", shop: json, valid });

describe("parsing the URL", () => {
  it("falls back to newest and any coin", () => {
    expect(parseSort("rated")).toBe("rated");
    expect(parseSort("bogus")).toBe("newest");
    expect(parseSort(null)).toBe("newest");
    expect(parsePay("BTC")).toBe("BTC");
    expect(parsePay("assets")).toBe("assets");
    expect(parsePay("QORT")).toBe("");
    expect(parsePay("ASSET:1")).toBe("");
  });
});

describe("sorting shops", () => {
  const a = shop("A", "alpha", 100, { title: "banana stand" });
  const b = shop("B", "beta", 300, { title: "Apple shop" });
  const c = shop("C", "gamma", 200, { title: "apple 10", updated: 900 });
  const d = shop("D", "delta", 50, { title: "apple 9" });

  it("newest first by default", () => {
    expect(sortShops([a, b, c, d], "newest").map((s) => s.owner)).toEqual(["B", "C", "A", "D"]);
  });

  it("A–Z ignores case and orders numbers naturally", () => {
    expect(sortShops([a, b, c, d], "az").map((s) => s.title)).toEqual(["apple 9", "apple 10", "Apple shop", "banana stand"]);
  });

  it("recently active takes the later of the shop's and its product index's last update", () => {
    const activity = buildActivityIndex([
      { name: "A", service: "DOCUMENT", identifier: "q-store-general-alpha-datacontainer", created: 1, updated: 1000, size: 10 },
      { name: "D", service: "DOCUMENT", identifier: "q-store-general-delta-datacontainer", created: 1, updated: 400, size: 10 },
    ]);
    expect(lastActive(c, activity)).toBe(900);
    expect(sortShops([a, b, c, d], "active", { activity }).map((s) => s.owner)).toEqual(["A", "C", "D", "B"]);
  });

  it("most products by product-index size; shops without one go last", () => {
    const activity = buildActivityIndex([
      { name: "A", service: "DOCUMENT", identifier: "q-store-general-alpha-datacontainer", created: 1, size: 300 },
      { name: "C", service: "DOCUMENT", identifier: "q-store-general-gamma-datacontainer", created: 1, size: 3000 },
    ]);
    expect(sortShops([a, b, c, d], "products", { activity }).map((s) => s.owner)).toEqual(["C", "A", "B", "D"]);
  });

  it("top rated by average, then number of reviews; unrated shops last, newest first", () => {
    const review = (name: string, short: string, rating: number) => ({
      name,
      service: "DOCUMENT",
      identifier: `q-store-review-${short}-U${name}000000-${rating * 10}`,
      created: 1,
    });
    const ratings = buildRatingsIndex([
      review("x", "alpha", 4),
      review("y", "alpha", 5),
      review("x", "gamma", 4.5),
      review("x", "delta", 5),
      review("y", "delta", 4),
      review("z", "delta", 4.5),
    ]);
    expect(sortShops([a, b, c, d], "rated", { ratings }).map((s) => s.owner)).toEqual(["D", "A", "C", "B"]);
  });

  it("keeps newest first while a sort's index isn't loaded", () => {
    expect(sortShops([a, b, c, d], "rated").map((s) => s.owner)).toEqual(["B", "C", "A", "D"]);
    expect(sortShops([a, b, c, d], "active").map((s) => s.owner)).toEqual(["B", "C", "A", "D"]);
  });

  it("returns a copy", () => {
    const list = [a, b];
    sortShops(list, "az");
    expect(list).toEqual([a, b]);
  });
});

describe("filtering shops", () => {
  const arrr = shop("A", "arrr", 3, { acceptsArrr: true });
  const plain = shop("B", "plain", 2);
  const other = shop("C", "other", 1);

  it("ARRR comes from the metadata marker until the JSON is read, then needs a payout address", () => {
    expect(payMatch(arrr, "ARRR", undefined)).toBe("yes");
    expect(payMatch(plain, "ARRR", undefined)).toBe("no");
    expect(payMatch(arrr, "ARRR", ready({ supportedCoins: ["QORT", "ARRR"], foreignCoins: { ARRR: " " } }))).toBe("no");
    expect(payMatch(arrr, "ARRR", ready({ supportedCoins: ["QORT", "ARRR"], foreignCoins: { ARRR: "zs1x" } }))).toBe("yes");
  });

  it("other coins and assets are unknown until the JSON is read", () => {
    expect(payMatch(plain, "BTC", undefined)).toBe("unknown");
    expect(payMatch(plain, "BTC", { status: "loading" })).toBe("unknown");
    expect(payMatch(plain, "BTC", ready({ supportedCoins: ["QORT", "BTC"], foreignCoins: { BTC: "bc1x" } }))).toBe("yes");
    expect(payMatch(plain, "BTC", ready({ supportedCoins: ["QORT", "BTC"], foreignCoins: {} }))).toBe("no");
    expect(payMatch(plain, "assets", ready({ acceptedAssets: [{ id: 7, name: "Gold" }] }))).toBe("yes");
    expect(payMatch(plain, "assets", ready({ acceptedAssets: [] }))).toBe("no");
    expect(payMatch(plain, "BTC", { status: "failed", final: false })).toBe("no");
  });

  it("splits shops into matches and ones still to check, and counts unreadable ones", () => {
    const details: Record<string, ShopDetails> = {
      [arrr.key]: ready({ supportedCoins: ["QORT", "LTC"], foreignCoins: { LTC: "ltc1x" } }),
      [plain.key]: { status: "failed", final: true },
    };
    const result = filterShops([arrr, plain, other], { pay: "LTC", mine: null }, (key) => details[key]);
    expect(result.shops).toEqual([arrr]);
    expect(result.unknown).toEqual([other]);
    expect(result.unreadable).toBe(1);
    expect(result.considered).toBe(3);
  });

  it("drops shops whose JSON isn't a valid shop, whatever the filter", () => {
    const details: Record<string, ShopDetails> = { [plain.key]: ready({}, false) };
    const result = filterShops([arrr, plain, other], { pay: "", mine: null }, (key) => details[key]);
    expect(result.shops).toEqual([arrr, other]);
  });

  it("My shops keeps only the signed-in name's shops", () => {
    const result = filterShops([arrr, plain, other], { pay: "", mine: new Set([plain.key]) }, () => undefined);
    expect(result.shops).toEqual([plain]);
    expect(result.considered).toBe(1);
  });
});
