import { describe, expect, it } from "vitest";
import {
  buildPriceList,
  editedProductDraft,
  formValuesFor,
  initialPriceText,
  newProductDraft,
  parseAmount,
  productForEdit,
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
    category: "Kitchen",
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
      category: "Kitchen",
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
    expect(validateProductForm(values({ category: "" }), coins)).toBe("Pick or type a category");
    expect(validateProductForm(values({ prices: { QORT: "0" } }), coins)).toBe("Set a price in QORT above 0");
    expect(validateProductForm(values({ prices: { QORT: "1", ARRR: "." } }), coins)).toBe("Check the ARRR price");
    expect(validateProductForm(values(), coins)).toBeNull();
  });
});
