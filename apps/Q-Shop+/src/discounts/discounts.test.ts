import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartLine } from "../money/order";
import { discountsIdentifier } from "../qdn/identifiers";
import { resetQdnCaches, resourcePath } from "../qdn/search";
import { installQortalMock } from "../test/qortalMock";
import {
  codeHash,
  discountSecretOf,
  discountStatus,
  discountTitle,
  discountsDocOf,
  isDiscountLine,
  nameHash,
  normalizeCode,
  DISCOUNT_LINE_ID,
  type Discount,
  type DiscountsDoc,
} from "./model";
import { discountForCode, discountForName, discountLine, discountProblem, discountedLines, productsSubtotal } from "./apply";
import { checkOrderDiscount } from "./verify";
import {
  buildDiscountsPublish,
  decryptDiscountSecret,
  encryptDiscountSecret,
  keepDiscountSecret,
  loadShopDiscounts,
  localDiscountSecret,
} from "./discountsDoc";

const STORE = "q-store-general-my-shop";
const OWNER = "Seller Name";
const H1 = "0123456789abcdef0123456789abcdef";
const H2 = "fedcba9876543210fedcba9876543210";
const line = (productId: string, qort: number, quantity = 1, extra: Record<string, unknown> = {}): CartLine => ({
  productId,
  catalogueId: "c",
  quantity,
  product: { title: productId, type: "physical", price: [{ currency: "qort", value: qort }], ...extra } as never,
});
const mug = line("mug", 10, 2);
const lamp = line("lamp", 5);
const delivery = line("q-store-delivery", 3, 1, { type: "delivery" });
const doc = (discounts: Discount[], over: Partial<DiscountsDoc> = {}): DiscountsDoc => ({ v: 1, storeId: STORE, currency: "QORT", discounts, updated: 1, ...over });

describe("discount codes", () => {
  it("compare codes in capitals without spaces, fingerprinted per shop; names in lower case", async () => {
    expect(normalizeCode(" spring 10 ")).toBe("SPRING10");
    const a = await codeHash(STORE, "spring10");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await codeHash(STORE, "SPRING 10")).toBe(a);
    expect(await codeHash("q-store-general-other", "SPRING10")).not.toBe(a);
    expect(await nameHash(STORE, "Ann")).toBe(await nameHash(STORE, "ann"));
    expect(await nameHash(STORE, "Ann")).not.toBe(a);
  });

  it("read only well-formed discounts of this shop: 1–99 % or free delivery, a code or a name, each once", () => {
    const parsed = discountsDocOf(
      {
        v: 1,
        storeId: STORE,
        currency: "USD",
        updated: 5,
        secret: "enc",
        discounts: [
          { id: "a", code: H1, percent: 10, products: ["mug", "mug", 3], minTotal: 50, starts: 1, ends: 2, extra: "kept out" },
          { id: "a", code: H1, percent: 20 },
          { id: "b", forName: H2, percent: 0, freeDelivery: true, paused: true },
          { id: "c", code: H1, percent: 100 },
          { id: "d", code: H1, percent: 0 },
          { id: "e", percent: 10 },
          { id: "f", code: "not-a-hash", percent: 10 },
          { id: "bad id", code: H1, percent: 10 },
          { id: "g", code: H1, percent: 12.5 },
        ],
      },
      STORE
    );
    expect(parsed).toEqual({
      v: 1,
      storeId: STORE,
      currency: "USD",
      updated: 5,
      secret: "enc",
      discounts: [
        { id: "a", code: H1, percent: 10, products: ["mug"], minTotal: 50, starts: 1, ends: 2 },
        { id: "b", forName: H2, percent: 0, freeDelivery: true, paused: true },
      ],
    });
    expect(discountsDocOf({ ...parsed, storeId: "q-store-general-other" }, STORE)).toBeNull();
    expect(discountsDocOf({ ...parsed, deleted: true }, STORE)).toBeNull();
    expect(discountSecretOf({ codes: { a: "SPRING10", b: "x" }, names: { b: "Ann", "bad id": "Bob" } })).toEqual({ codes: { a: "SPRING10" }, names: { b: "Ann" } });
  });

  it("say whether they're in use, what they take off, and recognise their order line", () => {
    expect(discountStatus({ starts: 10, ends: 20 }, 5)).toBe("scheduled");
    expect(discountStatus({ starts: 10, ends: 20 }, 15)).toBe("active");
    expect(discountStatus({ starts: 10, ends: 20 }, 25)).toBe("ended");
    expect(discountStatus({ paused: true }, 15)).toBe("paused");
    expect(discountTitle({ percent: 10, freeDelivery: true }, "SPRING10")).toBe("Discount SPRING10: 10% off and free delivery");
    expect(discountTitle({ percent: 0, freeDelivery: true })).toBe("Your discount: free delivery");
    expect(isDiscountLine(DISCOUNT_LINE_ID, null)).toBe(true);
    expect(isDiscountLine("x", { product: { type: "discount" } })).toBe(true);
    expect(isDiscountLine("x", { product: { type: "physical" } })).toBe(false);
  });
});

describe("a discount at checkout", () => {
  const base: Discount = { id: "a", code: H1, percent: 10 };
  const problem = (discount: Discount, over: Partial<Parameters<typeof discountProblem>[0]> = {}) =>
    discountProblem({ discount, doc: { currency: "QORT" }, lines: [mug, lamp], buyerNameHash: H2, now: 1000, pricing: null, hasDeliveryFee: true, ...over });

  it("applies while in use, to its products, for its name, over its minimum", () => {
    expect(problem(base)).toBeNull();
    expect(problem({ ...base, paused: true })).toBe("This code isn't in use right now.");
    expect(problem({ ...base, starts: 2000 })).toMatch(/^This code starts on /);
    expect(problem({ ...base, ends: 500 })).toMatch(/^This code ended on /);
    expect(problem({ ...base, forName: H1 })).toBe("This code is for another Qortal name.");
    expect(problem({ ...base, forName: H2 })).toBeNull();
    expect(problem({ ...base, products: ["chair"] })).toBe("This code is for other products of this shop.");
    // The order's products come to 25 QORT.
    expect(problem({ ...base, minTotal: 30 })).toBe("This code is for orders of 30.00 QORT or more (these products come to 25.00 QORT).");
    expect(problem({ ...base, minTotal: 25 })).toBeNull();
    expect(problem({ ...base, percent: 0, freeDelivery: true }, { hasDeliveryFee: false })).toBe("This code makes delivery free, and this order has no delivery to pay.");
  });

  it("counts a minimum in the shop's currency: prices set in it, others at its rate", () => {
    const usd = line("cup", 50, 1, { fiatPrice: { currency: "USD", value: 10, qort: 50 } });
    const pricing = { currency: "USD", rates: { QORT: 0.2 }, updated: 1 };
    // 10 USD, and the 25 QORT of the mug and lamp at 0.2 USD.
    expect(productsSubtotal([usd, mug, lamp], "USD", pricing)).toBeCloseTo(15);
    expect(productsSubtotal([usd, mug], "USD", null)).toBeNull();
    expect(problem({ ...base, minTotal: 20 }, { doc: { currency: "USD" }, lines: [usd, mug, lamp], pricing })).toMatch(/^This code is for orders of .*20.*or more/);
  });

  it("takes its percentage off the products it covers, never an auction win, priced in the buyer's coin", () => {
    const won = line("vase", 40, 1, { auctionWin: { amount: 40 } });
    expect(discountedLines({ products: ["mug"] }, [mug, lamp, won]).map((l) => l.productId)).toEqual(["mug"]);
    const off = discountLine({ discount: base, code: "SPRING10", lines: [mug, lamp, won], deliveryLine: null, coin: "QORT", rate: null, digital: false });
    expect(off?.amount).toBe(2.5);
    expect(off?.line).toEqual({
      productId: DISCOUNT_LINE_ID,
      catalogueId: "",
      quantity: 1,
      product: {
        id: DISCOUNT_LINE_ID,
        title: "Discount SPRING10: 10% off",
        type: "discount",
        price: [{ currency: "qort", value: -2.5 }],
        discount: { id: "a", code: "SPRING10", percent: 10, value: 2.5, coin: "QORT" },
      },
    });
    // ARRR at the node's rate, as the products are priced.
    expect(discountLine({ discount: base, lines: [mug], deliveryLine: null, coin: "ARRR", rate: 0.5, digital: false })?.amount).toBe(1);
  });

  it("makes delivery free too, says it's digital in an all-digital order, and rounds down to whole units in an asset that can't be split", () => {
    const both = discountLine({ discount: { ...base, freeDelivery: true }, lines: [mug], deliveryLine: delivery, coin: "QORT", rate: null, digital: false });
    expect(both?.amount).toBe(5);
    const only = discountLine({ discount: { id: "b", code: H1, percent: 0, freeDelivery: true }, lines: [mug], deliveryLine: delivery, coin: "QORT", rate: null, digital: false });
    expect(only?.amount).toBe(3);
    expect(discountLine({ discount: base, lines: [mug], deliveryLine: null, coin: "QORT", rate: null, digital: true })?.line.product?.type).toBe("digital");
    const gold = line("bar", 0, 3, { price: [{ currency: "ASSET:7", value: 4 }] });
    // 10 % of 12 Gold is 1.2: 1 whole unit off.
    expect(discountLine({ discount: base, lines: [gold], deliveryLine: null, coin: "ASSET:7", rate: null, digital: false, wholeUnits: true })?.amount).toBe(1);
    expect(discountLine({ discount: { ...base, percent: 5 }, lines: [line("pin", 0, 1, { price: [{ currency: "ASSET:7", value: 4 }] })], deliveryLine: null, coin: "ASSET:7", rate: null, digital: false, wholeUnits: true })).toBeNull();
  });

  it("finds a code's discount, and a name's own discount that needs no code (the largest in use)", () => {
    const d = doc([
      { id: "a", code: H1, percent: 10 },
      { id: "b", forName: H2, percent: 5 },
      { id: "c", forName: H2, percent: 15 },
      { id: "d", forName: H2, percent: 30, paused: true },
      { id: "e", code: H1, forName: H2, percent: 40 },
    ]);
    expect(discountForCode(d, H1)?.id).toBe("a");
    expect(discountForCode(d, H2)).toBeNull();
    expect(discountForName(d, H2, 1000)?.id).toBe("c");
    expect(discountForName(d, null, 1000)).toBeNull();
  });
});

describe("reading and publishing discount codes", () => {
  beforeEach(() => {
    resetQdnCaches();
    localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());
  const id = discountsIdentifier("my-shop");
  const json = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });

  it("asks QDN first and fetches only a shop's codes that are there, with its rates for a minimum in a currency", async () => {
    const published = doc([{ id: "a", code: H1, percent: 10, minTotal: 20 }], { currency: "USD" });
    let there = false;
    const fetch = vi.fn(async (url: string) => {
      if (url.startsWith("/arbitrary/resources/search?")) return json(there ? [{ name: OWNER, service: "DOCUMENT", identifier: id }] : []);
      if (url === resourcePath("DOCUMENT", OWNER, id)) return json(published);
      if (url === resourcePath("DOCUMENT", OWNER, `${STORE}-datacontainer`)) return json({ fiatPricing: { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } });
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    expect(await loadShopDiscounts(OWNER, STORE)).toEqual({ doc: null, pricing: null });
    expect(fetch).toHaveBeenCalledTimes(1);
    resetQdnCaches();
    there = true;
    expect(await loadShopDiscounts(OWNER, STORE)).toEqual({ doc: published, pricing: { currency: "USD", rates: { QORT: 0.2 }, updated: 1 } });
  });

  it("publishes them as one DOCUMENT of the seller's, and keeps the seller's list encrypted to them and on the device", async () => {
    const d = doc([{ id: "a", code: H1, percent: 10 }]);
    const request = buildDiscountsPublish({ name: OWNER, doc: d });
    expect(request).toMatchObject({ action: "PUBLISH_QDN_RESOURCE", name: OWNER, service: "DOCUMENT", identifier: id, filename: "discounts.json" });
    expect(JSON.parse(atob(request.data64))).toEqual(d);
    const q = installQortalMock({
      ENCRYPT_DATA: async (p) => `enc:${String((p as Record<string, unknown>).data64)}`,
      DECRYPT_DATA: async (p) => String((p as Record<string, unknown>).encryptedData).slice(4),
    });
    const secret = { codes: { a: "SPRING10" }, names: {} };
    const encrypted = await encryptDiscountSecret(secret, "PK");
    expect(q.callsFor("ENCRYPT_DATA")[0]).toMatchObject({ publicKeys: ["PK"] });
    expect(await decryptDiscountSecret({ ...d, secret: encrypted ?? "" }, "PK")).toEqual(secret);
    expect(await decryptDiscountSecret(d, "PK")).toEqual({ codes: {}, names: {} });
    keepDiscountSecret(STORE, secret);
    expect(localDiscountSecret(STORE)).toEqual(secret);
  });
});

describe("the seller's check of an order's discount", () => {
  const item = (productId: string, total: number, extra: Record<string, unknown> = {}) => ({
    productId,
    title: productId,
    quantity: 1,
    pricePerUnit: total,
    totalProductPrice: total,
    catalogueId: "c",
    image: undefined,
    product: { price: [{ currency: "qort", value: total }], ...extra },
  });
  const items = [item("mug", 20), item("lamp", 10)];
  const check = async (claim: Parameters<typeof checkOrderDiscount>[0]["claim"], discount: Discount, over: Partial<Parameters<typeof checkOrderDiscount>[0]> = {}) =>
    checkOrderDiscount({ claim, doc: doc([discount]), storeId: STORE, buyer: "Ann", items, deliveryFee: 3, at: 1000, pricing: null, ...over });

  it("matches the seller's code: its fingerprint, percentage, products, dates, name and minimum", async () => {
    const code = await codeHash(STORE, "SPRING10");
    const spring: Discount = { id: "a", code, percent: 10 };
    const claim = { title: "Discount SPRING10: 10% off", amount: 3, code: "SPRING10", id: "a", percent: 10 };
    expect(await check(claim, spring)).toEqual({ ok: true });
    expect(await check({ ...claim, code: "SPRING11" }, spring)).toEqual({ ok: false, message: "The code in this order isn't your code." });
    expect(await check({ ...claim, id: "b" }, spring)).toMatchObject({ ok: false, message: expect.stringMatching(/isn't one of your codes now/) });
    expect(await check({ ...claim, percent: 20, amount: 6 }, spring)).toEqual({ ok: false, message: "It takes off more than your code gives." });
    expect(await check({ ...claim, amount: 3.5 }, spring)).toEqual({ ok: false, message: "It takes off more than your code gives." });
    // Only the mug: 10 % of 20.
    expect(await check({ ...claim, amount: 2 }, { ...spring, products: ["mug"] })).toEqual({ ok: true });
    expect(await check(claim, { ...spring, products: ["mug"] })).toEqual({ ok: false, message: "It takes off more than your code gives." });
    expect(await check(claim, { ...spring, ends: 500 })).toEqual({ ok: false, message: "It was used outside your code's dates." });
    expect(await check(claim, { ...spring, minTotal: 40 })).toEqual({ ok: false, message: "The order is under your code's minimum." });
    expect(await check(claim, { ...spring, forName: await nameHash(STORE, "Bob") })).toEqual({ ok: false, message: "This discount is for another Qortal name than the buyer's." });
    expect(await check(claim, spring, { doc: null })).toMatchObject({ ok: false });
  });

  it("lets free delivery take the delivery fee off, only when the code gives it", async () => {
    const vip: Discount = { id: "v", forName: await nameHash(STORE, "Ann"), percent: 0, freeDelivery: true };
    const claim = { title: "Your discount: free delivery", amount: 3, id: "v", percent: 0, freeDelivery: true };
    expect(await check(claim, vip)).toEqual({ ok: true });
    expect(await check(claim, { ...vip, freeDelivery: undefined, percent: 10 })).toEqual({ ok: false, message: "It takes off more than your code gives." });
  });
});
