import { afterEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "../money/order";
import { unitPrice } from "../money/pricing";
import { deliveryIdentifier } from "../qdn/identifiers";
import { resourcePath } from "../qdn/search";
import { deliveryCharge, deliveryChoices, loadShopDelivery, pickupChoices, withOptionNote } from "./checkoutDelivery";
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
    // An asset without a price setting has no rate: a fee in QORT can't be paid in one.
    expect(charge(doc([{ id: "eu", countries: ["PL"], first: 2 }]), "ASSET:7", null)).toEqual({
      ok: false,
      message: "Delivery can't be paid in Gold. My Shop gives Gold no price for it. Go back and pick another coin.",
    });
    // The zone's own price in the asset needs no rate.
    const own = charge(doc([{ id: "eu", countries: ["PL"], first: 2, assets: { "7": { first: 9 } } }]), "ASSET:7", null);
    expect(own.ok && own.line && unitPrice(own.line.product, "ASSET:7", null)).toBe(9);
    // With a rate (the asset's trade portal price or the seller's), it converts: 2 QORT at 20 Gold per QORT.
    const paid = charge(doc([{ id: "eu", countries: ["PL"], first: 2 }]), "ASSET:7", 20);
    expect(paid.ok && paid.line && unitPrice(paid.line.product, "ASSET:7", 20)).toBe(40);
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

  it("reads them again from the node once the session's copy is too old (checkout: always), so a seller's change counts", async () => {
    let first = 2;
    const reads = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/arbitrary/resources/search?")) return json([{ name: OWNER, service: "DOCUMENT", identifier: id }]);
        if (url.startsWith(resourcePath("DOCUMENT", OWNER, id))) {
          reads();
          return json(doc([{ id: "eu", countries: ["PL"], first }]));
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );
    expect((await loadShopDelivery(OWNER, STORE)).doc?.general.zones[0].first).toBe(2);
    first = 5;
    // The session's copy, for a page that doesn't mind a minute.
    expect((await loadShopDelivery(OWNER, STORE, { maxAgeMs: 60_000 })).doc?.general.zones[0].first).toBe(2);
    // Checkout reads it from the node.
    expect((await loadShopDelivery(OWNER, STORE, { maxAgeMs: 0 })).doc?.general.zones[0].first).toBe(5);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("publishes them as one DOCUMENT of the seller's", () => {
    const d = doc([{ id: "eu", countries: ["PL"], first: 2 }]);
    const built = buildDeliveryPublish({ name: OWNER, doc: d });
    expect(built.identifier).toBe(id);
    expect(built.request).toMatchObject({ action: "PUBLISH_QDN_RESOURCE", name: OWNER, service: "DOCUMENT", identifier: id, filename: "delivery.json" });
    expect(JSON.parse(atob(built.request.data64))).toEqual(d);
  });

  it("lists the delivery options the order can have there, each with its fee, the zones' own first", () => {
    const withOptions: DeliveryDoc = {
      ...doc([{ id: "eu", countries: ["PL", "IS"], first: 2, rates: { exp: { first: 9 }, pick: { first: 0 } } }, { id: "us", countries: ["US"], first: 20 }]),
      options: [
        { id: "exp", name: "Express", note: "1–3 days" },
        { id: "pick", name: "Local pickup" },
      ],
    };
    const offered = deliveryChoices({ shop, delivery: { doc: withOptions, pricing: null }, lines: [chair], address: poland, coin: "QORT", rate: null });
    expect(offered.ok && offered.choices.map((c) => [c.id, c.name, c.note, c.free, c.line ? c.line.product?.price : null])).toEqual([
      ["", "Standard", undefined, false, [{ currency: "qort", value: 2 }]],
      ["exp", "Express", "1–3 days", false, [{ currency: "qort", value: 9 }]],
      ["pick", "Local pickup", undefined, true, null],
    ]);
    // The US zone offers neither: its own prices only.
    const us = deliveryChoices({ shop, delivery: { doc: withOptions, pricing: null }, lines: [chair], address: { country: "United States", state: "Texas" }, coin: "QORT", rate: null });
    expect(us.ok && us.choices.map((c) => c.id)).toEqual([""]);
    // No options: none to pick from.
    const plain = deliveryChoices({ shop, delivery: { doc: doc([{ id: "eu", countries: ["PL"], first: 2 }]), pricing: null }, lines: [chair], address: poland, coin: "QORT", rate: null });
    expect(plain).toEqual({ ok: true, choices: [] });
  });

  it("works out the pickups from the place alone, before any street (only where a zone prices them)", () => {
    const withPickup: DeliveryDoc = {
      ...doc([{ id: "pl", countries: ["PL"], first: 2, rates: { pick: { first: 0 } } }, { id: "de", countries: ["DE"], first: 5 }]),
      options: [{ id: "pick", name: "Local pickup", note: "Kraków, Saturdays", pickup: true }],
    };
    const at = (address: { country: string; state: string }) => pickupChoices({ shop, delivery: { doc: withPickup, pricing: null }, lines: [chair], address, coin: "QORT", rate: null });
    expect(at(poland)).toEqual([{ id: "pick", name: "Local pickup", note: "Kraków, Saturdays", pickup: true, line: null, free: true }]);
    expect(at({ country: "Germany", state: "" })).toEqual([]);
    expect(at({ country: "", state: "" })).toEqual([]);
    expect(pickupChoices({ shop, delivery: { doc: null, pricing: null }, lines: [chair], address: poland, coin: "QORT", rate: null })).toEqual([]);
  });

  it("puts the picked option in front of the buyer's note", () => {
    expect(withOptionNote({ deliveryNote: "Ring twice" }, { name: "Local pickup" }).deliveryNote).toBe("Delivery: Local pickup. Ring twice");
    expect(withOptionNote({ deliveryNote: "" }, { name: "Express" }).deliveryNote).toBe("Delivery: Express.");
    expect(withOptionNote({ deliveryNote: "x" }, undefined).deliveryNote).toBe("x");
  });
});

describe("a delivery choice named after its shipping profile", () => {
  it("calls the zones' own prices by the profile the products ship with, not the generic first option", () => {
    const iceland = { country: "Iceland", state: "" };
    const ghee: CartLine = { productId: "ghee", catalogueId: "c", quantity: 1, product: { title: "Ghee", type: "physical", price: [{ currency: "qort", value: 130 }] } as never };
    const withProfile: DeliveryDoc = {
      v: 1,
      storeId: STORE,
      currency: "QORT",
      base: { name: "Standard" },
      options: [{ id: "pick", name: "Pick up", pickup: true, place: { country: "IS", address: "Kolaportid Market", days: [6, 0], from: "11:00", to: "17:00" } }],
      general: { zones: [] },
      profiles: [{ id: "p", name: "Posturin", products: ["ghee"], zones: [{ id: "z", countries: ["IS"], first: 12 }] }],
      updated: 1,
    } as DeliveryDoc;
    const offered = deliveryChoices({ shop, delivery: { doc: withProfile, pricing: null }, lines: [ghee], address: iceland, coin: "QORT", rate: null });
    expect(offered.ok && offered.choices.map((c) => c.name)).toEqual(["Posturin", "Pick up"]);
    expect(offered.ok && offered.choices[0].line?.product?.title).toBe("Delivery to Iceland, Posturin");
  });
});
