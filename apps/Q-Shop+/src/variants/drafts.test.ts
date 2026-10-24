import { describe, expect, it } from "vitest";
import type { ProductFormValues } from "../seller/productDraft";
import { formValuesFor, validateProductForm } from "../seller/productDraft";
import { groupEditDrafts, groupFormValues, itemPicture, removedMembers, rowKey, variantDrafts, variantFormProblem, variantPriceUnit, type VariantFormValues } from "./drafts";
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

describe("editing a published group", () => {
  const CAT = "q-store-catalogue-my-shop-CAT0000001";
  /** The group as published: Round / Pale (the lead), Round / Orange at 12 with its picture, Square / Pale. */
  function published() {
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
    // As the edit form gets them (seller/productDraft.ts productForEdit): with their catalogue.
    return drafts.map((d, i) => ({ ...d, catalogueId: CAT, status: i === 2 ? "OUT_OF_STOCK" : "AVAILABLE" })) as (Record<string, any> & { id: string })[];
  }

  it("starts from its items: the lead's fields, each item's product, stock, own price and own picture", () => {
    const members = published();
    const lead = { ...formValuesFor(members[0], ["QORT"]), title: "Glasses" };
    const f = groupFormValues({ variant: members[0].variant, members, lead, coins: ["QORT"] });
    expect(f.options.map((o) => [o.name, o.values])).toEqual([
      ["Round", [{ name: "Pale" }, { name: "Orange", color: "#f97316" }]],
      ["Square", [{ name: "Pale" }]],
    ]);
    const round = f.options[0];
    const square = f.options[1];
    // The lead's pictures are the product's (Round's picture first), so its row has none of its own;
    // Square / Pale's picture is one of the product's.
    expect(lead.images).toEqual([ROUND, A, B, C]);
    expect(f.rows).toEqual({
      [rowKey(round, "Pale")]: { productId: members[0].id, status: "AVAILABLE", price: "", picture: null },
      [rowKey(round, "Orange")]: { productId: members[1].id, status: "AVAILABLE", price: "12", picture: ORANGE },
      [rowKey(square, "Pale")]: { productId: members[2].id, status: "OUT_OF_STOCK", price: "", picture: A },
    });
    expect(removedMembers(f, members)).toEqual([]);
  });

  it("saves every item: renamed, re-priced, a new value, one taken out (retired, out of the group)", () => {
    const members = published();
    const lead = { ...formValuesFor(members[0], ["QORT"]), title: "Glasses" };
    const start = groupFormValues({ variant: members[0].variant, members, lead, coins: ["QORT"] });
    // Round is renamed Oval (its items keep their products); Orange goes; Blue comes; Square is back in stock.
    const [round, square] = start.options;
    const edited: VariantFormValues = {
      ...start,
      display: "separate",
      options: [
        { ...round, name: "Oval", values: [{ name: "Pale" }, { name: "Blue", color: "#2563eb" }] },
        square,
      ],
      rows: { ...start.rows, [rowKey(square, "Pale")]: { ...start.rows[rowKey(square, "Pale")], status: "AVAILABLE" } },
    };
    expect(removedMembers(edited, members).map((m) => m.id)).toEqual([members[1].id]);
    const { drafts, dropped } = groupEditDrafts({
      values: { ...lead, title: "Blue-light glasses", prices: { QORT: "11" } },
      form: edited,
      group: members[0].variant.group,
      members,
      coins: ["QORT"],
      storeId: "q-store-general-my-shop",
      name: "Seller Name",
      uid,
      now: 2000,
    });
    expect(dropped).toEqual([]);
    expect(drafts.map((d) => [d.id, d.title, d.price[0].value, d.status, d.isUpdate ?? false])).toEqual([
      [members[0].id, "Blue-light glasses — Oval / Pale", 11, "AVAILABLE", true],
      ["q-store-product-my-shop-UID0000005", "Blue-light glasses — Oval / Blue", 11, "AVAILABLE", false],
      [members[2].id, "Blue-light glasses — Square / Pale", 11, "AVAILABLE", true],
      // Taken out: retired as it was, no longer in the group.
      [members[1].id, "Glasses — Round / Orange", 12, "RETIRED", true],
    ]);
    expect(drafts[3].variant).toBeUndefined();
    const group = members[0].variant.group;
    for (const d of drafts.slice(0, 3)) {
      expect(d.variant).toMatchObject({
        group,
        title: "Blue-light glasses",
        options: [
          { name: "Oval", values: [{ name: "Pale" }, { name: "Blue", color: "#2563eb" }] },
          { name: "Square", values: [{ name: "Pale" }] },
        ],
        display: "separate",
        lead: members[0].id,
      });
    }
    // The lead keeps the product's pictures; the new item shows the product's first, Square its own.
    expect(drafts[0].images).toEqual([ROUND, A, B, C]);
    expect(drafts[1].images).toEqual([ROUND]);
    expect(drafts[2].images).toEqual([A]);
  });

  it("an item moved first leads, and a group never published leaves its taken-out drafts", () => {
    const members = published().map(({ catalogueId: _c, ...d }) => d as Record<string, any> & { id: string });
    const lead = { ...formValuesFor(members[0], ["QORT"]), title: "Glasses" };
    const start = groupFormValues({ variant: members[0].variant, members, lead, coins: ["QORT"] });
    const [round, square] = start.options;
    const edited: VariantFormValues = { ...start, options: [square, { ...round, values: [{ name: "Pale" }] }] };
    const { drafts, dropped } = groupEditDrafts({
      values: lead,
      form: edited,
      group: members[0].variant.group,
      members,
      coins: ["QORT"],
      storeId: "q-store-general-my-shop",
      name: "Seller Name",
      uid,
      now: 2000,
    });
    expect(dropped).toEqual([members[1].id]);
    expect(drafts.map((d) => d.id)).toEqual([members[2].id, members[0].id]);
    expect(drafts.every((d) => d.variant.lead === members[2].id)).toBe(true);
    // Square / Pale now carries its picture, then the product's; the old lead shows the product's first.
    expect(drafts[0].images).toEqual([A, ROUND, B, C]);
    expect(drafts[1].images).toEqual([ROUND]);
    // Still drafts of new products.
    expect(drafts.every((d) => !d.isUpdate)).toBe(true);
  });
});

describe("item prices in the shop's currency", () => {
  const pricing = { currency: "USD", rates: { QORT: 0.2 }, updated: 1 };
  const noPrice: ProductFormValues = { ...values, prices: { QORT: "" }, fiat: "" };

  it("are in the currency whenever the shop has one, with a product price or not", () => {
    expect(variantPriceUnit(noPrice, pricing)).toBe("USD");
    expect(variantPriceUnit(values, pricing)).toBe("USD");
    expect(variantPriceUnit(values, null)).toBe("QORT");
  });

  it("need no product price when every item has one; else they say which lacks one", () => {
    const priced = form({ rows: { [valuesKey(["Round", "Pale"])]: { price: "5", picture: null }, [valuesKey(["Round", "Orange"])]: { price: "6", picture: null } } });
    expect(variantFormProblem(priced, noPrice, pricing)).toBe("Set a price for Square / Pale, or one for the product.");
    const all = form({ rows: { ...priced.rows, [valuesKey(["Square", "Pale"])]: { price: "7", picture: null } } });
    expect(variantFormProblem(all, noPrice, pricing)).toBeNull();
    expect(validateProductForm(noPrice, ["QORT"], { pricing, priceOptional: true })).toBeNull();
    expect(validateProductForm(noPrice, ["QORT"], { pricing })).toBe("Set a price in QORT above 0");
    n = 0;
    const drafts = variantDrafts({ values: noPrice, form: all, coins: ["QORT"], storeId: "q-store-general-my-shop", name: "S", uid, now: 1, pricing });
    expect(drafts.map((d) => [(d as { fiatPrice?: { value: number } }).fiatPrice?.value, (d.price as { value: number }[])[0].value])).toEqual([
      [5, 25],
      [6, 30],
      [7, 35],
    ]);
  });

  it("an edited item priced in QORT only keeps that price until one is typed in the currency", () => {
    n = 0;
    const qortGroup = variantDrafts({ values, form: form({ rows: { [valuesKey(["Round", "Orange"])]: { price: "12", picture: ORANGE } } }), coins: ["QORT"], storeId: "q-store-general-my-shop", name: "S", uid, now: 1 });
    const members = qortGroup.map((d) => ({ ...d, catalogueId: "CAT" })) as (Record<string, any> & { id: string })[];
    // The shop has prices in USD since; the lead gets one, the others not yet.
    members[0] = { ...members[0], fiatPrice: { currency: "USD", value: 2, qort: 10 } };
    const lead = { ...formValuesFor(members[0], ["QORT"], pricing), title: "Glasses" };
    const f = groupFormValues({ variant: members[0].variant, members, lead, coins: ["QORT"], pricing });
    const [round, square] = f.options;
    expect(f.rows[rowKey(round, "Orange")]).toMatchObject({ price: "", qort: "12" });
    expect(f.rows[rowKey(square, "Pale")]).toMatchObject({ price: "", qort: "10" });
    const typed: VariantFormValues = { ...f, rows: { ...f.rows, [rowKey(square, "Pale")]: { ...f.rows[rowKey(square, "Pale")], price: "3" } } };
    const { drafts } = groupEditDrafts({ values: lead, form: typed, group: members[0].variant.group, members, coins: ["QORT"], storeId: "q-store-general-my-shop", name: "S", uid, now: 2, pricing });
    expect(drafts.map((d) => [d.id, (d.fiatPrice as { value: number } | undefined)?.value ?? null, d.price[0].value])).toEqual([
      [members[0].id, 2, 10],
      [members[1].id, null, 12],
      [members[2].id, 3, 15],
    ]);
  });
});

