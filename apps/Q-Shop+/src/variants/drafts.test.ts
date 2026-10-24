import { describe, expect, it } from "vitest";
import type { ProductFormValues } from "../seller/productDraft";
import { variantDrafts, variantFormProblem, type VariantFormValues } from "./drafts";
import { valuesKey } from "./model";

const values: ProductFormValues = {
  title: "T-shirt",
  description: "Soft cotton.",
  images: ["data:image/webp;base64,AAA", "data:image/webp;base64,BBB", "data:image/webp;base64,CCC"],
  type: "physical",
  category: "Clothing, Shoes & Accessories",
  status: "AVAILABLE",
  prices: { QORT: "10" },
};
const form = (over: Partial<VariantFormValues> = {}): VariantFormValues => ({
  options: [
    { name: "Colour", values: ["Red", "Blue"] },
    { name: "Size", values: ["S", "M"] },
  ],
  display: "bundle",
  rows: {},
  ...over,
});
let n = 0;
const uid = () => `UID${String(++n).padStart(7, "0")}`;

describe("the form's variants", () => {
  it("say what's missing or wrong", () => {
    expect(variantFormProblem(form({ options: [{ name: "", values: ["S"] }] }), values, null)).toBe("Name each option (Size, Colour…).");
    expect(variantFormProblem(form({ options: [{ name: "Size", values: [] }] }), values, null)).toBe("Give each option its values (S, M, L…).");
    expect(variantFormProblem(form({ options: [{ name: "Size", values: ["S"] }] }), values, null)).toBe("Variants need at least two choices (two sizes, say).");
    expect(variantFormProblem(form({ options: [{ name: "Size", values: ["S", "s"] }] }), values, null)).toBe("Size has the same value twice.");
    const many = Array.from({ length: 5 }, (_, i) => `V${i}`);
    expect(variantFormProblem(form({ options: [{ name: "A", values: many }, { name: "B", values: many }] }), values, null)).toBe("That makes 25 variants: 24 at most. Use fewer values.");
    expect(variantFormProblem(form({ rows: { [valuesKey(["Red", "S"])]: { price: "abc", picture: null } } }), values, null)).toBe("Check the price of Red / S.");
    expect(variantFormProblem(form(), values, null)).toBeNull();
  });

  it("make one product per combination, named for it, at its own price or the product's, the first with every picture", () => {
    n = 0;
    const drafts = variantDrafts({
      values,
      form: form({ rows: { [valuesKey(["Red", "M"])]: { price: "12", picture: null }, [valuesKey(["Blue", "S"])]: { price: "", picture: 2 } } }),
      coins: ["QORT"],
      storeId: "q-store-general-my-shop",
      name: "Seller Name",
      uid,
      now: 1000,
    });
    expect(drafts.map((d) => d.title)).toEqual(["T-shirt — Red / S", "T-shirt — Red / M", "T-shirt — Blue / S", "T-shirt — Blue / M"]);
    expect(drafts.map((d) => d.id)).toEqual(["q-store-product-my-shop-UID0000002", "q-store-product-my-shop-UID0000003", "q-store-product-my-shop-UID0000004", "q-store-product-my-shop-UID0000005"]);
    expect(drafts.map((d) => (d.price as { currency: string; value: number }[])[0].value)).toEqual([10, 12, 10, 10]);
    // The lead keeps every picture; the others carry their own (or the product's first).
    expect(drafts[0].images).toEqual(values.images);
    expect(drafts[2].images).toEqual(["data:image/webp;base64,CCC"]);
    expect(drafts[3].images).toEqual(["data:image/webp;base64,AAA"]);
    expect(drafts[1].variant).toEqual({
      group: "UID0000001",
      title: "T-shirt",
      options: form().options,
      values: ["Red", "M"],
      display: "bundle",
      lead: "q-store-product-my-shop-UID0000002",
    });
    expect(drafts.every((d) => d.status === "AVAILABLE" && d.type === "physical" && d.category === values.category)).toBe(true);
  });

  it("price each in the shop's currency when the product is", () => {
    n = 0;
    const pricing = { currency: "USD", rates: { QORT: 0.2 }, updated: 1 };
    const drafts = variantDrafts({
      values: { ...values, fiat: "5" },
      form: form({ options: [{ name: "Size", values: ["S", "M"] }], rows: { [valuesKey(["M"])]: { price: "6", picture: null } } }),
      coins: ["QORT"],
      storeId: "q-store-general-my-shop",
      name: "Seller Name",
      uid,
      now: 1000,
      pricing,
    });
    expect(drafts.map((d) => (d as { fiatPrice?: { value: number } }).fiatPrice?.value)).toEqual([5, 6]);
    expect(drafts.map((d) => (d.price as { value: number }[])[0].value)).toEqual([25, 30]);
  });
});
