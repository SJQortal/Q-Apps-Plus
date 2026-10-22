import { describe, expect, it } from "vitest";
import {
  buildPriceList,
  editedProductDraft,
  formValuesFor,
  initialPriceText,
  newProductDraft,
  parseAmount,
  productForEdit,
  productFromIndexRow,
  sanitizeAmountInput,
  validateProductForm,
  type ProductFormValues,
} from "./productDraft";
import { CATALOGUE_ID, SELLER, SHORT_STORE_ID, STORE_ID, dataContainer, mug, poster } from "../test/fixtures/shop";

const coins = ["QORT", "ARRR"];

function values(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    title: "Tea cup",
    description: "A cup",
    images: ["data:image/webp;base64,Q1VQ"],
    type: "physical",
    category: "Home & Garden",
    status: "AVAILABLE",
    prices: { QORT: "2.5", ARRR: "" },
    ...overrides,
  };
}

describe("amount fields", () => {
  it("cleans what is typed: comma to dot, one dot, 8 decimals", () => {
    expect(sanitizeAmountInput("1,5")).toBe("1.5");
    expect(sanitizeAmountInput("1.2.3")).toBe("1.23");
    expect(sanitizeAmountInput("abc12x")).toBe("12");
    expect(sanitizeAmountInput("0.123456789")).toBe("0.12345678");
    expect(sanitizeAmountInput(".")).toBe(".");
  });

  it("parses amounts the way the original's Number() did, and rejects the rest", () => {
    expect(parseAmount("1.5")).toBe(1.5);
    expect(parseAmount("0.1")).toBe(0.1);
    expect(parseAmount(".5")).toBe(0.5);
    expect(parseAmount("")).toBeNaN();
    expect(parseAmount(".")).toBeNaN();
    expect(parseAmount("1e3")).toBeNaN();
  });
});

describe("a new product (the original's shape)", () => {
  it("builds the same object as NewProduct.addProduct, keys in the same order", () => {
    const draft = newProductDraft({ values: values(), coins, storeId: STORE_ID, name: SELLER, uid: "UIDxxxxxx1", now: 1762000000000 });
    expect(Object.keys(draft)).toEqual([
      "title",
      "description",
      "created",
      "version",
      "images",
      "mainImageIndex",
      "type",
      "price",
      "storeId",
      "shortStoreId",
      "category",
      "id",
      "status",
      "user",
    ]);
    expect(draft).toEqual({
      title: "Tea cup",
      description: "A cup",
      created: 1762000000000,
      version: 1,
      images: ["data:image/webp;base64,Q1VQ"],
      mainImageIndex: 0,
      type: "physical",
      price: [{ currency: "qort", value: 2.5 }],
      storeId: STORE_ID,
      shortStoreId: SHORT_STORE_ID,
      category: "Home & Garden",
      id: `q-store-product-${SHORT_STORE_ID}-UIDxxxxxx1`,
      status: "AVAILABLE",
      user: SELLER,
    });
  });

  it("writes other coins' prices after QORT, ARRR as the original did, and assets as ASSET:<id>", () => {
    const shopCoins = ["QORT", "ARRR", "BTC", "ASSET:81"];
    const price = buildPriceList({ QORT: "3", ARRR: "0.25", BTC: "", "ASSET:81": "12" }, shopCoins);
    expect(price).toEqual([
      { currency: "qort", value: 3 },
      { currency: "ARRR", value: 0.25 },
      { currency: "ASSET:81", value: 12 },
    ]);
  });
});

describe("editing a product (bug 3: prices are kept)", () => {
  const row = { ...dataContainer.products[poster.id], productId: poster.id, user: SELLER };

  it("starts the form from every price the product has", () => {
    const base = productForEdit(row, poster);
    const form = formValuesFor(base, coins);
    expect(form.prices).toEqual({ QORT: "0.1", ARRR: "0.25" });
    expect(initialPriceText(mug, ["QORT", "ARRR", "BTC"])).toEqual({ QORT: "1.5", ARRR: "", BTC: "" });
  });

  it("saving without touching the prices keeps the ARRR price (the original dropped it)", () => {
    const base = productForEdit(row, poster);
    const form = formValuesFor(base, coins);
    const edited = editedProductDraft({ base, values: { ...form, title: "Big poster" }, coins, name: SELLER });
    expect(edited.price).toEqual([
      { currency: "qort", value: 0.1 },
      { currency: "ARRR", value: 0.25 },
    ]);
  });

  it("builds the same object as the original's edit: loaded product, form fields, isUpdate, status, user", () => {
    const base = productForEdit(row, poster);
    const form = formValuesFor(base, coins);
    const edited = editedProductDraft({
      base,
      values: { ...form, title: "Big poster", status: "OUT_OF_STOCK", prices: { QORT: "0.2", ARRR: "" } },
      coins,
      name: SELLER,
    });
    expect(edited).toEqual({
      ...poster,
      title: "Big poster",
      price: [{ currency: "qort", value: 0.2 }],
      isUpdate: true,
      status: "OUT_OF_STOCK",
      user: SELLER,
      catalogueId: CATALOGUE_ID,
    });
  });

  it("keeps prices for coins the shop no longer shows, and drops one the seller cleared", () => {
    const product = { ...mug, price: [{ currency: "qort", value: 1 }, { currency: "LTC", value: 0.5 }, { currency: "ARRR", value: 2 }] };
    const base = productForEdit({ ...row, productId: mug.id }, product);
    const edited = editedProductDraft({ base, values: values({ prices: { QORT: "1", ARRR: "" } }), coins, name: SELLER });
    expect(edited.price).toEqual([
      { currency: "qort", value: 1 },
      { currency: "LTC", value: 0.5 },
    ]);
  });

  it("a product missing from its catalogue starts from its index row, and saving makes a whole product again", () => {
    const indexRow = { ...dataContainer.products[mug.id], productId: mug.id, user: SELLER, status: "OUT_OF_STOCK" };
    const base = productFromIndexRow(indexRow, STORE_ID);
    const form = formValuesFor(base, coins);
    expect(form).toMatchObject({ title: "", images: [], category: "Kitchen", status: "OUT_OF_STOCK", prices: { QORT: "1.5", ARRR: "" } });
    const edited = editedProductDraft({
      base,
      values: { ...form, title: "Mug", images: ["data:image/webp;base64,SU1H"] },
      coins,
      name: SELLER,
    });
    expect(edited).toEqual({
      created: mug.created,
      catalogueId: CATALOGUE_ID,
      id: mug.id,
      user: SELLER,
      status: "OUT_OF_STOCK",
      version: 1,
      price: [{ currency: "qort", value: 1.5 }],
      storeId: STORE_ID,
      shortStoreId: SHORT_STORE_ID,
      category: "Kitchen",
      title: "Mug",
      description: "",
      images: ["data:image/webp;base64,SU1H"],
      mainImageIndex: 0,
      // The row has no type: physical, as checkout reads a product without one.
      type: "physical",
      isUpdate: true,
    });
    // No usable price in the row: the field starts empty.
    expect(formValuesFor(productFromIndexRow({ ...indexRow, priceQort: 0 }, STORE_ID), coins).prices.QORT).toBe("");
  });

  it("an edit of a new draft stays a new product", () => {
    const draft = newProductDraft({ values: values(), coins, storeId: STORE_ID, name: SELLER, uid: "UIDxxxxxx1", now: 1 });
    const edited = editedProductDraft({ base: draft, values: values({ title: "Mug 2" }), coins, name: SELLER });
    expect(edited).not.toHaveProperty("isUpdate");
    expect(edited).toMatchObject({ id: draft.id, title: "Mug 2", status: "AVAILABLE", created: 1 });
  });
});

describe("validation", () => {
  it("asks for an image, a title, a category and a QORT price above 0", () => {
    expect(validateProductForm(values({ images: [] }), coins)).toBe("Add at least one image");
    expect(validateProductForm(values({ title: "  " }), coins)).toBe("Add a title");
    expect(validateProductForm(values({ category: "" }), coins)).toBe("Pick a category");
    expect(validateProductForm(values({ prices: { QORT: "0" } }), coins)).toBe("Set a price in QORT above 0");
    expect(validateProductForm(values({ prices: { QORT: "1", ARRR: "." } }), coins)).toBe("Check the ARRR price");
    expect(validateProductForm(values(), coins)).toBeNull();
    // Only the list's categories, or the product's own old one while it is edited.
    expect(validateProductForm(values({ category: "Mugs" }), coins)).toBe("Pick a category from the list");
    expect(validateProductForm(values({ category: "Mugs" }), coins, { oldCategory: "Mugs" })).toBeNull();
    expect(validateProductForm(values({ category: "Mugs" }), coins, { oldCategory: "Cups" })).toBe("Pick a category from the list");
  });
});

describe("a price in the shop's currency (money/fiatPricing.ts)", () => {
  const pricing = { currency: "USD", rates: { QORT: 0.18, ARRR: 0.25 }, updated: 1 };

  it("gives a new product its QORT and ARRR prices, with fiatPrice after the original's keys", () => {
    const draft = newProductDraft({
      values: values({ fiat: "10", prices: { QORT: "", ARRR: "" } }),
      coins,
      storeId: STORE_ID,
      name: SELLER,
      uid: "UIDxxxxxx1",
      now: 1,
      pricing,
    });
    expect(Object.keys(draft)).toEqual([
      "title",
      "description",
      "created",
      "version",
      "images",
      "mainImageIndex",
      "type",
      "price",
      "storeId",
      "shortStoreId",
      "category",
      "id",
      "status",
      "user",
      "fiatPrice",
    ]);
    expect(draft.price).toEqual([
      { currency: "qort", value: 55.56 },
      { currency: "ARRR", value: 40 },
    ]);
    expect((draft as Record<string, unknown>).fiatPrice).toEqual({ currency: "USD", value: 10, qort: 55.56 });
  });

  it("without a price in the currency, the product is priced in QORT as before, and an edit stops following", () => {
    const plain = newProductDraft({ values: values({ fiat: "" }), coins, storeId: STORE_ID, name: SELLER, uid: "UIDxxxxxx1", now: 1, pricing });
    expect(plain).not.toHaveProperty("fiatPrice");
    expect(plain.price).toEqual([{ currency: "qort", value: 2.5 }]);
    const base = productForEdit({ ...dataContainer.products[mug.id], productId: mug.id, user: SELLER }, {
      ...mug,
      price: [{ currency: "qort", value: 55.56 }],
      fiatPrice: { currency: "USD", value: 10, qort: 55.56 },
    });
    expect(formValuesFor(base, coins, pricing).fiat).toBe("10.00");
    const edited = editedProductDraft({ base, values: values({ fiat: "", prices: { QORT: "60", ARRR: "" } }), coins, name: SELLER, pricing });
    expect(edited).not.toHaveProperty("fiatPrice");
    expect(edited.price).toEqual([{ currency: "qort", value: 60 }]);
    // A shop without pricing keeps what the product has (the form shows no price in a currency).
    const kept = editedProductDraft({ base, values: values({ prices: { QORT: "55.56", ARRR: "" } }), coins, name: SELLER });
    expect(kept).toHaveProperty("fiatPrice");
  });

  it("asks for whole units in an asset that can't be split", () => {
    const assetCoins = ["QORT", "ASSET:90"];
    const v = (price: string) => values({ prices: { QORT: "1", "ASSET:90": price } });
    expect(validateProductForm(v("1.5"), assetCoins, { wholeOnly: ["ASSET:90"] })).toBe(
      "Use whole units for the price in an asset that can't be split"
    );
    expect(validateProductForm(v("2"), assetCoins, { wholeOnly: ["ASSET:90"] })).toBeNull();
    expect(validateProductForm(v("1.5"), assetCoins)).toBeNull();
  });

  it("takes up to 8 decimals for a ticker of the seller's own", () => {
    const xau = { currency: "XAU", rates: { QORT: 0.0001 }, updated: 1 };
    expect(validateProductForm(values({ fiat: "0.00012", prices: { QORT: "" } }), coins, { pricing: xau })).toBeNull();
    const draft = newProductDraft({ values: values({ fiat: "0.0012" }), coins, storeId: STORE_ID, name: SELLER, uid: "UIDxxxxxx1", now: 1, pricing: xau });
    expect((draft as Record<string, unknown>).fiatPrice).toEqual({ currency: "XAU", value: 0.0012, qort: 12 });
    expect(formValuesFor({ ...draft }, coins, xau).fiat).toBe("0.0012");
  });

  it("asks for a valid price in the currency, and then no QORT price", () => {
    expect(validateProductForm(values({ fiat: "12.345", prices: { QORT: "" } }), coins, { pricing })).toBe("Check the USD price");
    expect(validateProductForm(values({ fiat: "12.34", prices: { QORT: "" } }), coins, { pricing })).toBeNull();
    expect(validateProductForm(values({ fiat: "", prices: { QORT: "" } }), coins, { pricing })).toBe("Set a price in QORT above 0");
  });
});

describe("a formatted description (richtext/plainText.ts)", () => {
  const rich = "<h2>Ghee</h2><p>Slow-cooked <strong>Icelandic</strong> ghee.</p>";

  it("is stored as htmlDescription beside the original's plain description", () => {
    const draft = newProductDraft({ values: values({ description: rich }), coins, storeId: STORE_ID, name: SELLER, uid: "UIDxxxxxx1", now: 1 }) as Record<string, unknown>;
    expect(draft.description).toBe("Ghee\nSlow-cooked Icelandic ghee.");
    expect(draft.htmlDescription).toBe(rich);
    // Right after the description; every other key in the original's order.
    expect(Object.keys(draft).slice(0, 3)).toEqual(["title", "description", "htmlDescription"]);
  });

  it("plain text needs none, as the original writes it", () => {
    const draft = newProductDraft({ values: values({ description: "<p>Line one</p><p><br></p><p>Line two</p>" }), coins, storeId: STORE_ID, name: SELLER, uid: "UIDxxxxxx1", now: 1 }) as Record<string, unknown>;
    expect(draft.description).toBe("Line one\n\nLine two");
    expect("htmlDescription" in draft).toBe(false);
  });

  it("opens in the editor as it was, and goes when an edit makes it plain again", () => {
    const product = { ...poster, description: "Ghee\nSlow-cooked Icelandic ghee.", htmlDescription: rich };
    expect(formValuesFor(product, coins).description).toBe(rich);
    expect(formValuesFor(poster, coins).description).toBe(`<p>${poster.description}</p>`);
    const edited = editedProductDraft({ base: product, values: { ...formValuesFor(product, coins), description: "<p>Just text</p>" }, coins, name: SELLER }) as Record<string, unknown>;
    expect(edited.description).toBe("Just text");
    expect("htmlDescription" in edited).toBe(false);
    const kept = editedProductDraft({ base: product, values: formValuesFor(product, coins), coins, name: SELLER }) as Record<string, unknown>;
    expect(kept.htmlDescription).toBe(rich);
  });

  it("is refused when it is too long to publish", () => {
    expect(validateProductForm(values({ description: `<p>${"x".repeat(20_001)}</p>`, images: ["data:image/webp;base64,SU1H"], title: "T", category: "Baby" }), coins)).toMatch(/Shorten the description/);
  });
});
