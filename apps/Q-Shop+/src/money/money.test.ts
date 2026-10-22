import { describe, expect, it, vi } from "vitest";
import moment from "moment";
import { amountText, formatPrice, ownPrice, unitPrice } from "./pricing";
import { getRate, parseRate, rateUrl } from "./rates";
import {
  buildDelivery,
  buildOrderDetails,
  buildOrderMailHtml,
  digitalDelivery,
  escapeHtml,
  formatLlll,
  isDigitalOnly,
  missingDeliveryFields,
  MissingPriceError,
} from "./order";
import { assetCoinId, assetIdOf, coinLabel, payoutAddress, priceCurrencyKey, shopCoins } from "./coins";
import { paymentRequest } from "./checkout";
import { CATALOGUE_ID, chair, mug, poster } from "../test/fixtures/shop";

describe("pricing (the original's rules)", () => {
  it("uses the QORT price, the coin's own price, or QORT × rate as a raw float", () => {
    expect(unitPrice(mug, "QORT", null)).toBe(1.5);
    expect(unitPrice(poster, "ARRR", 9)).toBe(0.25);
    expect(unitPrice(mug, "ARRR", 0.3)).toBe(1.5 * 0.3);
    // No rate yet: no price (the original showed the QORT number as ARRR).
    expect(unitPrice(mug, "ARRR", null)).toBeUndefined();
    // Assets need the seller's own price.
    expect(unitPrice(mug, "ASSET:81", 2)).toBeUndefined();
    expect(unitPrice({ price: [{ currency: "ASSET:81", value: 4 }] }, "ASSET:81", null)).toBe(4);
    expect(ownPrice({ price: [{ currency: "ARRR", value: 0 }] }, "ARRR")).toBeUndefined();
  });

  it("rounds only the total, to 8 places, as the amount Hub sends", () => {
    expect(amountText(0.1 + 0.2)).toBe("0.30000000");
    expect(amountText(1.5 * 0.3 * 3)).toBe("1.35000000");
    expect(formatPrice(1234.5)).toBe("1,234.50");
    expect(formatPrice(0.00000001)).toBe("0.00000001");
    expect(formatPrice(undefined)).toBe("—");
  });

  it("keys product prices as the original does", () => {
    expect(priceCurrencyKey("QORT")).toBe("qort");
    expect(priceCurrencyKey("ARRR")).toBe("ARRR");
    expect(priceCurrencyKey("BTC")).toBe("BTC");
    expect(assetIdOf(assetCoinId(81))).toBe(81);
    expect(assetIdOf("ASSET:x")).toBeNull();
  });

  it("lists a shop's coins: QORT, foreign coins with an address, then assets", () => {
    expect(
      shopCoins({
        supportedCoins: ["QORT", "ARRR", "BTC", "LTC"],
        foreignCoins: { ARRR: " zs1 ", BTC: "", LTC: "ltc1" },
        acceptedAssets: [{ id: 81, name: "Gold" }],
      })
    ).toEqual(["QORT", "ARRR", "LTC", "ASSET:81"]);
    expect(shopCoins(null)).toEqual(["QORT"]);
  });

  it("never throws on a shop JSON with mistyped coin fields (anyone can publish one)", () => {
    const bad = (shop: object) => shop as any;
    // Each of these threw a TypeError during the home page's render.
    expect(shopCoins(bad({ supportedCoins: 1 }))).toEqual(["QORT"]);
    expect(shopCoins(bad({ supportedCoins: "ARRR", foreignCoins: { ARRR: "zs1" } }))).toEqual(["QORT"]);
    expect(shopCoins(bad({ supportedCoins: ["ARRR", 7, null], foreignCoins: { ARRR: 5 } }))).toEqual(["QORT"]);
    expect(shopCoins(bad({ supportedCoins: ["ARRR"], foreignCoins: ["zs1"] }))).toEqual(["QORT"]);
    expect(shopCoins(bad({ acceptedAssets: {} }))).toEqual(["QORT"]);
    expect(shopCoins(bad({ acceptedAssets: 81 }))).toEqual(["QORT"]);
    expect(
      shopCoins(bad({ acceptedAssets: [null, 5, { id: "81" }, { id: 81, name: { x: 1 } }, { id: 81, name: "Again" }, { id: 82 }] }))
    ).toEqual(["QORT", "ASSET:81", "ASSET:82"]);
    expect(payoutAddress(bad({ foreignCoins: { BTC: " bc1 " } }), "BTC")).toBe("bc1");
    expect(payoutAddress(bad({ foreignCoins: "bc1" }), "BTC")).toBe("");

    // Labels are always text, never an object React can't render.
    expect(coinLabel("ASSET:81", bad({ acceptedAssets: {} }))).toBe("Asset #81");
    expect(coinLabel("ASSET:81", bad({ acceptedAssets: [{ id: 81, name: { en: "Gold" } }] }))).toBe("Asset #81");
    expect(coinLabel("ASSET:81", bad({ acceptedAssets: [{ id: 81, name: " Gold " }] }))).toBe("Gold");
    expect(coinLabel("ARRR", bad({ acceptedAssets: "x" }))).toBe("ARRR");

    // Checkout says the address is missing instead of crashing on it.
    expect(() => paymentRequest("ARRR", "1.00000000", "Qseller", bad({ foreignCoins: { ARRR: 5 } }))).toThrow(
      "This shop has not set a ARRR address"
    );
  });
});

describe("rates", () => {
  it("parses the node's price like the original and caches one request per coin", async () => {
    expect(parseRate("250000000")).toBe(2.5);
    expect(() => parseRate("nope")).toThrow();
    expect(rateUrl("BITCOIN")).toBe("/crosschain/price/BITCOIN?maxtrades=10&inverse=true");
    const fetchMock = vi.fn(async () => ({ ok: true, text: async () => "12345678" }));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([getRate("ARRR"), getRate("ARRR")]);
    expect(a).toBe(0.12345678);
    expect(b).toBe(a);
    await getRate("ARRR");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(getRate("QORT")).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it("refuses a zero rate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => "0" })));
    await expect(getRate("DOGE")).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("order building", () => {
  const lines = [
    { productId: mug.id, catalogueId: CATALOGUE_ID, quantity: 2, product: mug },
    { productId: "missing", catalogueId: CATALOGUE_ID, quantity: 1, product: null },
    { productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 1, product: poster },
  ];

  it("lists the total first, then the loaded lines in cart order", () => {
    const details = buildOrderDetails(lines, "QORT", null);
    expect(Object.keys(details)).toEqual(["totalPrice", mug.id, poster.id]);
    expect(details.totalPrice).toBe("3.10000000");
  });

  it("stops before paying when a product has no price in the coin", () => {
    expect(() => buildOrderDetails(lines, "ARRR", null)).toThrow(MissingPriceError);
  });

  it("writes state for the United States and region elsewhere", () => {
    const base = { ...digitalDelivery("Ann"), streetAddress: "1", city: "C", zipCode: "Z", state: "Oregon", region: "R" };
    expect(Object.keys(buildDelivery({ ...base, country: "United States" }).shippingAddress)).toEqual([
      "streetAddress",
      "city",
      "state",
      "country",
      "zipCode",
      "deliveryNote",
    ]);
    expect(buildDelivery({ ...base, country: "Portugal" }).shippingAddress).toEqual({
      streetAddress: "1",
      city: "C",
      region: "R",
      country: "Portugal",
      zipCode: "Z",
      deliveryNote: "",
    });
    expect(missingDeliveryFields(digitalDelivery("Ann"))).toEqual(["streetAddress", "country", "city", "region", "zipCode"]);
    expect(isDigitalOnly([{ ...lines[0] }, { productId: chair.id, catalogueId: CATALOGUE_ID, quantity: 1, product: chair }])).toBe(false);
  });

  it("formats the date like moment's llll and escapes typed text in the mail", () => {
    for (const t of [0, 1761000000000, 1700000000000 + 12 * 3600_000, 1703980800000]) {
      expect(formatLlll(t)).toBe(moment(t).format("llll"));
    }
    expect(escapeHtml(`<img src=x onerror="a">&'`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;");
    const html = buildOrderMailHtml({
      details: buildOrderDetails(lines, "QORT", null),
      storeTitle: "<b>Shop</b>",
      currency: "QORT",
      currencyLabel: "QORT",
      isDigital: false,
      buyerName: "Ann",
      delivery: { ...digitalDelivery("<script>"), country: "Portugal" },
      created: 0,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Shop</b>");
    expect(html).toContain("Customer Name: &lt;script&gt;");
  });
});
