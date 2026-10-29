import { describe, expect, it } from "vitest";
import {
  FIAT_CURRENCIES,
  MissingPriceCatalogueError,
  fiatToText,
  formatFiat,
  isValidTicker,
  normalizeTicker,
  priceDecimals,
  buildPricesPublish,
  coinPriceFromFiat,
  fiatPriceOf,
  fiatPricingOf,
  parseFiat,
  priceChanges,
  priceListFromFiat,
  productPricedInFiat,
  rateToText,
  sanitizeFiatInput,
  staleFiatPriceOf,
} from "./fiatPricing";
import { base64ToJson, type CatalogueDoc, type DataContainerDoc } from "../qdn/payloads";
import { CATALOGUE_ID, DATA_CONTAINER_ID, SELLER, catalogue, chair, dataContainer, mug, poster } from "../test/fixtures/shop";

const usd = { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 } };

describe("prices from a currency", () => {
  it("rounds coin prices to cents from 1 coin up, to four significant digits below", () => {
    expect(coinPriceFromFiat(10, 0.18)).toBe(55.56);
    expect(coinPriceFromFiat(12.5, 0.25)).toBe(50);
    expect(coinPriceFromFiat(0.1, 0.18)).toBe(0.5556);
    expect(coinPriceFromFiat(0.01, 0.18)).toBe(0.05556);
    expect(coinPriceFromFiat(0.01, 90000)).toBe(1.1e-7);
    expect(coinPriceFromFiat(0, 0.18)).toBeNaN();
    expect(coinPriceFromFiat(10, 0)).toBeNaN();
  });

  it("reads typed prices and rates: comma or dot, a limited number of decimals, above 0", () => {
    expect(parseFiat("12,50")).toBe(12.5);
    expect(parseFiat("0.18", 8)).toBe(0.18);
    expect(parseFiat("0.123", 2)).toBeNaN();
    expect(parseFiat("0")).toBeNaN();
    expect(parseFiat("")).toBeNaN();
    expect(parseFiat("1e3")).toBeNaN();
    expect(sanitizeFiatInput("12,505")).toBe("12.50");
    expect(sanitizeFiatInput("$0.1800", 8)).toBe("0.1800");
    expect(rateToText(0.18)).toBe("0.18");
    expect(rateToText(0.00000123)).toBe("0.00000123");
  });

  it("reads the shop's pricing from its product list, or none", () => {
    expect(fiatPricingOf({ fiatPricing: { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 5 } })).toEqual({
      currency: "USD",
      rates: { QORT: 0.18, ARRR: 0.25 },
      updated: 5,
    });
    expect(fiatPricingOf({ fiatPricing: { currency: "USD", rates: { QORT: 0.18, ARRR: -1 } } })).toEqual({
      currency: "USD",
      rates: { QORT: 0.18 },
      updated: 0,
    });
    expect(fiatPricingOf({ fiatPricing: null })).toBeNull();
    expect(fiatPricingOf({ fiatPricing: { currency: "usd", rates: { QORT: 1 } } })).toBeNull();
    expect(fiatPricingOf({ fiatPricing: { currency: "USD", rates: { QORT: 0 } } })).toBeNull();
    expect(fiatPricingOf(dataContainer)).toBeNull();
  });

  it("builds the price list: QORT, ARRR when the shop takes it and has a rate, then the rest (assets) as they were", () => {
    const existing = [
      { currency: "qort", value: 1 },
      { currency: "ARRR", value: 2 },
      { currency: "ASSET:81", value: 3 },
    ];
    expect(priceListFromFiat(existing, 10, usd.rates, true)).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ARRR", value: 40 },
      { currency: "ASSET:81", value: 3 },
    ]);
    // No ARRR rate (or no ARRR in the shop): no ARRR price, so checkout converts at the node's rate.
    expect(priceListFromFiat(existing, 10, { QORT: 0.18 }, true)).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ASSET:81", value: 3 },
    ]);
    expect(priceListFromFiat(existing, 10, usd.rates, false)).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ASSET:81", value: 3 },
    ]);
  });

  it("keeps the product's shape and key order, adding fiatPrice at the end", () => {
    const priced = productPricedInFiat({ ...poster } as Record<string, unknown>, 10, usd, true);
    expect(Object.keys(priced)).toEqual([...Object.keys(poster), "fiatPrice"]);
    expect(priced.price).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ARRR", value: 40 },
    ]);
    expect(priced.fiatPrice).toEqual({ currency: "USD", value: 10, qort: 55.56 });
  });

  it("knows a product still follows its price in the currency only while its QORT price is the one that gave", () => {
    const priced = productPricedInFiat({ ...mug } as Record<string, unknown>, 10, usd, false);
    expect(fiatPriceOf(priced, "USD")).toEqual({ currency: "USD", value: 10, qort: 55.56 });
    expect(fiatPriceOf(priced, "EUR")).toBeNull();
    // The original's form changed its QORT price (and kept fiatPrice, as it keeps unknown fields).
    const editedElsewhere = { ...priced, price: [{ currency: "qort", value: 60 }] };
    expect(fiatPriceOf(editedElsewhere, "USD")).toBeNull();
    expect(staleFiatPriceOf(editedElsewhere, "USD")).toBe(10);
    expect(staleFiatPriceOf(priced, "USD")).toBeNull();
  });
});

describe("publishing prices", () => {
  const dc = dataContainer as unknown as DataContainerDoc;
  const cats = { [CATALOGUE_ID]: structuredClone(catalogue) as unknown as CatalogueDoc };

  it("prices the products given, in their catalogue, updates the list's QORT prices and pricing, the list last", () => {
    const built = buildPricesPublish({ name: SELLER, dataContainer: dc, catalogues: cats, prices: { [mug.id]: 10, [chair.id]: 50 }, pricing: usd, takesArrr: true, now: 1234 });
    expect(built.resources.map((r) => [r.service, r.identifier, r.filename])).toEqual([
      ["DOCUMENT", CATALOGUE_ID, "catalogue.json"],
      ["DOCUMENT", DATA_CONTAINER_ID, "datacontainer.json"],
    ]);
    const cat = base64ToJson(built.resources[0].data64);
    expect(cat.products[mug.id].price).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ARRR", value: 40 },
    ]);
    expect(cat.products[mug.id].fiatPrice).toEqual({ currency: "USD", value: 10, qort: 55.56 });
    expect(cat.products[chair.id].price[0]).toEqual({ currency: "qort", value: 277.78 });
    // The poster isn't in the list: untouched, byte for byte.
    expect(cat.products[poster.id]).toEqual(catalogue.products[poster.id]);
    const list = base64ToJson(built.resources[1].data64);
    expect(list).toEqual({
      ...dataContainer,
      products: {
        ...dataContainer.products,
        [mug.id]: { ...dataContainer.products[mug.id], priceQort: 55.56 },
        [chair.id]: { ...dataContainer.products[chair.id], priceQort: 277.78 },
      },
      fiatPricing: { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 1234 },
    });
    expect(built.changedProducts).toEqual([mug.id, chair.id]);
  });

  it("republishes no catalogue whose products don't change, and stops following with null", () => {
    const already = productPricedInFiat({ ...mug } as Record<string, unknown>, 10, usd, true);
    const withMug = { [CATALOGUE_ID]: { ...structuredClone(catalogue), products: { ...catalogue.products, [mug.id]: already } } as unknown as CatalogueDoc };
    const same = buildPricesPublish({ name: SELLER, dataContainer: dc, catalogues: withMug, prices: { [mug.id]: 10 }, pricing: usd, takesArrr: true, now: 1 });
    expect(same.resources.map((r) => r.identifier)).toEqual([DATA_CONTAINER_ID]);
    const stop = buildPricesPublish({ name: SELLER, dataContainer: dc, catalogues: withMug, prices: { [mug.id]: null }, pricing: usd, takesArrr: true, now: 1 });
    const cat = base64ToJson(stop.resources[0].data64);
    expect(cat.products[mug.id].fiatPrice).toBeUndefined();
    expect(cat.products[mug.id].price).toEqual(already.price);
  });

  it("writes a stopped pricing as null, so an older copy can't switch it back on", () => {
    const built = buildPricesPublish({ name: SELLER, dataContainer: dc, catalogues: cats, prices: {}, pricing: null, takesArrr: true, now: 1 });
    expect(built.resources).toHaveLength(1);
    expect(base64ToJson(built.resources[0].data64).fiatPricing).toBeNull();
  });

  it("stops when a catalogue it needs wasn't read", () => {
    expect(() =>
      buildPricesPublish({ name: SELLER, dataContainer: dc, catalogues: {}, prices: { [mug.id]: 10 }, pricing: usd, takesArrr: true, now: 1 })
    ).toThrow(MissingPriceCatalogueError);
  });
});

describe("what publishing prices would change", () => {
  it("lists only products whose prices change, with before and after, and those that stop following", () => {
    const following = productPricedInFiat({ ...mug } as Record<string, unknown>, 10, usd, true);
    const changes = priceChanges(
      [
        { productId: mug.id, product: following, value: 10 },
        { productId: poster.id, product: { ...poster } as Record<string, unknown>, value: 1 },
        { productId: chair.id, product: { ...chair } as Record<string, unknown>, value: null },
        { productId: "unread", product: undefined, value: 5 },
      ],
      usd,
      true
    );
    // The mug already has these prices; the chair never followed a currency; the unread one can't be priced.
    expect(changes).toEqual([
      { productId: poster.id, value: 1, before: { qort: 0.1, arrr: 0.25 }, after: { qort: 5.56, arrr: 4 } },
    ]);
    const stop = priceChanges([{ productId: mug.id, product: following, value: null }], usd, true);
    expect(stop).toEqual([{ productId: mug.id, value: null, before: { qort: 55.56, arrr: 40 }, after: { qort: 55.56, arrr: 40 } }]);
  });
});

describe("currencies and tickers", () => {
  it("offers PLN and ISK with the others, USD first", () => {
    expect(FIAT_CURRENCIES[0]).toBe("USD");
    expect(FIAT_CURRENCIES).toContain("PLN");
    expect(FIAT_CURRENCIES).toContain("ISK");
  });

  it("takes a ticker of the seller's own: 2 to 10 letters or digits, not QORT or ARRR", () => {
    expect(normalizeTicker(" xau ")).toBe("XAU");
    expect(normalizeTicker("us-dt!")).toBe("USDT");
    expect(normalizeTicker("ABCDEFGHIJKL")).toBe("ABCDEFGHIJ");
    expect(isValidTicker("XAU")).toBe(true);
    expect(isValidTicker("SATS")).toBe(true);
    expect(isValidTicker("X")).toBe(false);
    expect(isValidTicker("QORT")).toBe(false);
    expect(isValidTicker("ARRR")).toBe(false);
  });

  it("prices the offered currencies in cents, a ticker of the seller's own with up to 8 decimals", () => {
    expect(priceDecimals("PLN")).toBe(2);
    expect(priceDecimals("XAU")).toBe(8);
    expect(fiatToText(12.5, "ISK")).toBe("12.50");
    expect(fiatToText(0.00012, "XAU")).toBe("0.00012");
    expect(formatFiat(0.00012, "XAU")).toBe("0.00012 XAU");
    expect(parseFiat("0.00012", priceDecimals("XAU"))).toBe(0.00012);
    expect(parseFiat("0.00012", priceDecimals("USD"))).toBeNaN();
  });

  it("reads a shop's pricing in a ticker of its own", () => {
    expect(fiatPricingOf({ fiatPricing: { currency: "XAU", rates: { QORT: 0.0001 }, updated: 1 } })?.currency).toBe("XAU");
    expect(fiatPricingOf({ fiatPricing: { currency: "QORT", rates: { QORT: 1 } } })).toBeNull();
  });
});
