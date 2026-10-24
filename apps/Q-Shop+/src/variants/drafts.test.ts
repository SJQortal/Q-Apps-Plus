import { describe, expect, it } from "vitest";
import type { ProductFormValues } from "../seller/productDraft";
import { itemPicture, variantDrafts, variantFormProblem, type VariantFormValues } from "./drafts";
import { valuesKey } from "./model";

const A = "data:image/webp;base64,AAA";
const B = "data:image/webp;base64,BBB";
const C = "data:image/webp;base64,CCC";
const ROUND = "data:image/webp;base64,ROUND";
const ORANGE = "data:image/webp;base64,ORANGE";
const values: ProductFormValues = {
  title: "Glasses",
  description: "Blue-light blocking.",
  images: [A, B, C],
  type: "physical",
  category: "Health & Beauty",
  status: "AVAILABLE",
  prices: { QORT: "10" },
};
const form = (over: Partial<VariantFormValues> = {}): VariantFormValues => ({
  options: [
    { name: "Round", values: [{ name: "Pale" }, { name: "Orange", color: "#f97316" }], picture: ROUND },
    { name: "Square", values: [{ name: "Pale" }], picture: null },
  ],
  display: "bundle",
  rows: {},
  ...over,
});
let n = 0;
const uid = () => `UID${String(++n).padStart(7, "0")}`;

describe("the form's variants", () => {
  it("say what's missing or wrong", () => {
    expect(variantFormProblem(form({ options: [{ name: "", values: [{ name: "Pale" }] }] }), values, null)).toBe("Name each variant (Round, Large…).");
    expect(variantFormProblem(form({ options: [{ name: "Round", values: [{ name: "Pale" }] }] }), values, null)).toBe(
      "Variants need at least two choices: two variants, or a variant with two values."
    );
    expect(variantFormProblem(form({ options: [{ name: "Round", values: [{ name: "Pale" }, { name: "pale" }] }] }), values, null)).toBe("Round has the same value twice.");
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `V${i}` }));
    expect(variantFormProblem(form({ options: [{ name: "A", values: many }, { name: "B", values: many }, { name: "C", values: many }] }), values, null)).toBe(
      "That makes 36 items: 30 at most. Use fewer values."
    );
    expect(variantFormProblem(form({ rows: { [valuesKey(["Round", "Pale"])]: { price: "abc", picture: null } } }), values, null)).toBe("Check the price of Round / Pale.");
    // Without the product's pictures, every item needs one: Square / Pale has none.
    expect(variantFormProblem(form(), { ...values, images: [] }, null)).toBe("Add a picture for Square / Pale: its own, its variant's, or the product's.");
    expect(variantFormProblem(form(), values, null)).toBeNull();
  });

  it("take an item's own picture, else its variant's, else the product's first", () => {
    const f = form({ rows: { [valuesKey(["Round", "Orange"])]: { price: "", picture: ORANGE } } });
    expect(itemPicture(f, values, ["Round", "Orange"])).toBe(ORANGE);
    expect(itemPicture(f, values, ["Round", "Pale"])).toBe(ROUND);
    expect(itemPicture(f, values, ["Square", "Pale"])).toBe(A);
  });

  it("make one product per item, named for its variant and value, at its own price or the product's", () => {
    n = 0;
    const drafts = variantDrafts({
      values,
      form: form({ rows: { [valuesKey(["Round", "Orange"])]: { price: "12", picture: ORANGE } } }),
      coins: ["QORT"],
      storeId: "q-store-general-my-shop",
      name: "Seller Name",
      uid,
      now: 1000,
    });
    expect(drafts.map((d) => d.title)).toEqual(["Glasses — Round / Pale", "Glasses — Round / Orange", "Glasses — Square / Pale"]);
    expect(drafts.map((d) => (d.price as { value: number }[])[0].value)).toEqual([10, 12, 10]);
    // The lead: its own (the variant's) picture, then the product's; the others theirs only.
    expect(drafts[0].images).toEqual([ROUND, A, B, C]);
    expect(drafts[1].images).toEqual([ORANGE]);
    expect(drafts[2].images).toEqual([A]);
    expect(drafts[1].variant).toEqual({
      group: "UID0000001",
      title: "Glasses",
      // The form's pictures aren't stored with the options; the colours are.
      options: [
        { name: "Round", values: [{ name: "Pale" }, { name: "Orange", color: "#f97316" }] },
        { name: "Square", values: [{ name: "Pale" }] },
      ],
      values: ["Round", "Orange"],
      display: "bundle",
      lead: "q-store-product-my-shop-UID0000002",
    });
  });

  it("need no product pictures when every item has one: 3 variants of 4 values, 12 pictures of their own", () => {
    n = 0;
    const pictures = (v: string) => Array.from({ length: 4 }, (_, i) => ({ name: `${v}${i}` }));
    const f: VariantFormValues = { options: ["X", "Y", "Z"].map((name) => ({ name, values: pictures(name), picture: `data:image/webp;base64,${name}` })), display: "separate", rows: {} };
    const noPictures = { ...values, images: [] };
    expect(variantFormProblem(f, noPictures, null)).toBeNull();
    const drafts = variantDrafts({ values: noPictures, form: f, coins: ["QORT"], storeId: "q-store-general-my-shop", name: "S", uid, now: 1 });
    expect(drafts).toHaveLength(12);
    expect(drafts.every((d) => d.images.length === 1)).toBe(true);
  });

  it("price each in the shop's currency when the product is", () => {
    n = 0;
    const pricing = { currency: "USD", rates: { QORT: 0.2 }, updated: 1 };
    const drafts = variantDrafts({
      values: { ...values, fiat: "5" },
      form: form({ rows: { [valuesKey(["Round", "Orange"])]: { price: "6", picture: null } } }),
      coins: ["QORT"],
      storeId: "q-store-general-my-shop",
      name: "Seller Name",
      uid,
      now: 1000,
      pricing,
    });
    expect(drafts.map((d) => (d as { fiatPrice?: { value: number } }).fiatPrice?.value)).toEqual([5, 6, 5]);
    expect(drafts.map((d) => (d.price as { value: number }[])[0].value)).toEqual([25, 30, 25]);
  });
});
