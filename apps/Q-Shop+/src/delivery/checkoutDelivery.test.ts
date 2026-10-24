import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "../money/order";
import { deliveryIdentifier } from "../qdn/identifiers";
import { resourcePath } from "../qdn/search";
import { deliveryCharge, loadShopDelivery } from "./checkoutDelivery";
import { buildDeliveryPublish, fetchDeliveryDoc } from "./deliveryDoc";
import { DELIVERY_LINE_ID, type DeliveryDoc } from "./model";

const STORE = "q-store-general-my-shop";
const OWNER = "Seller Name";
const shop = { title: "My Shop", owner: OWNER, supportedCoins: ["QORT", "ARRR"], acceptedAssets: [{ id: 7, name: "Gold" }] };
const chair: CartLine = { productId: "chair", catalogueId: "c", quantity: 2, product: { title: "Chair", type: "physical", price: [{ currency: "qort", value: 12 }] } as never };
const doc = (zones: DeliveryDoc["general"]["zones"]): DeliveryDoc => ({ v: 1, storeId: STORE, currency: "QORT", general: { zones }, profiles: [], updated: 1 });
const poland = { country: "Poland", state: "" };
const charge = (d: DeliveryDoc | null, coin = "QORT", rate: number | null = null, address = poland) =>
  deliveryCharge({ shop, delivery: { doc: d, pricing: null }, lines: [chair], address, coin, rate });

describe("the delivery charge at checkout", () => {
  it("is a line priced in the buyer's coin, or nothing to pay", () => {
    const fee = charge(doc([{ id: "eu", countries: ["PL"], first: 2, extra: 1 }]));
    expect(fee).toMatchObject({ ok: true, free: false, line: { productId: DELIVERY_LINE_ID, quantity: 1, product: { title: "Delivery to Poland", price: [{ currency: "qort", value: 3 }] } } });
    // ARRR at the node's rate, as a product without its own ARRR price.
    expect(charge(doc([{ id: "eu", countries: ["PL"], first: 2 }]), "ARRR", 0.5).ok).toBe(true);
    expect(charge(null)).toEqual({ ok: true, line: null, free: false });
    expect(charge(doc([{ id: "eu", countries: ["PL"], first: 0 }]))).toEqual({ ok: true, line: null, free: true });
  });

  it("says why it can't be paid: not delivered there, in an asset, or prices in a currency the shop left", () => {
    expect(charge(doc([{ id: "us", countries: ["US"], states: ["OR"], first: 2 }]), "QORT", null, { country: "United States", state: "Texas" })).toEqual({
      ok: false,
      message: "My Shop doesn't deliver Chair to Texas, United States. Remove it from your cart, pick another address, or ask the seller.",
    });
    // Assets have no rate: a fee in QORT can't be paid in one.
    expect(charge(doc([{ id: "eu", countries: ["PL"], first: 2 }]), "ASSET:7", null)).toEqual({
      ok: false,
      message: "Delivery can't be paid in Gold: go back and pick another coin.",
    });
    const usd = { ...doc([{ id: "eu", countries: ["PL"], first: 2 }]), currency: "USD" };
    expect(charge(usd).ok).toBe(false);
  });
});

describe("reading the delivery prices", () => {
  afterEach(() => vi.unstubAllGlobals());
  const id = deliveryIdentifier("my-shop");
  const json = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });

  it("asks QDN first and never fetches prices a shop doesn't have", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.startsWith("/arbitrary/resources/search?")) return json([]);
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    expect(await loadShopDelivery(OWNER, STORE)).toEqual({ doc: null, pricing: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain(`identifier=${id}`);
  });

  it("reads the ones it has, with the shop's rates when they're in a currency, and fails when the node can't serve them", async () => {
    const usd = { ...doc([{ id: "eu", countries: ["PL"], first: 7 }]), currency: "USD" };
    let serve = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/arbitrary/resources/search?")) return json([{ name: OWNER, service: "DOCUMENT", identifier: id }]);
        if (url === resourcePath("DOCUMENT", OWNER, id)) return serve ? json(usd) : { ok: false, status: 404, text: async () => "{}", json: async () => ({}) };
        if (url === resourcePath("DOCUMENT", OWNER, `${STORE}-datacontainer`)) return json({ fiatPricing: { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } });
        throw new Error(`unexpected fetch ${url}`);
      })
    );
    expect(await loadShopDelivery(OWNER, STORE)).toEqual({ doc: usd, pricing: { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } });
    serve = false;
    await expect(fetchDeliveryDoc(OWNER, STORE, { fresh: true })).rejects.toThrow();
  });

  it("publishes them as one DOCUMENT of the seller's", () => {
    const d = doc([{ id: "eu", countries: ["PL"], first: 2 }]);
    const built = buildDeliveryPublish({ name: OWNER, doc: d });
    expect(built.identifier).toBe(id);
    expect(built.request).toMatchObject({ action: "PUBLISH_QDN_RESOURCE", name: OWNER, service: "DOCUMENT", identifier: id, filename: "delivery.json" });
    expect(JSON.parse(atob(built.request.data64))).toEqual(d);
  });
});
