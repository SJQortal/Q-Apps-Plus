import { describe, expect, it } from "vitest";
import { defaultAuctionValues, editedProductDraft, formValuesFor, newProductDraft, type ProductFormValues } from "../seller/productDraft";
import { variantDrafts, variantFormProblem, type VariantFormValues } from "../variants/drafts";
import { valuesKey } from "../variants/model";
import { stockFormOf, stockFormProblem, withStockRows } from "./catalog";

const IMG = "data:image/webp;base64,AAA";
const values: ProductFormValues = { ...formValuesFor(null, ["QORT"]), title: "Mug", description: "A mug.", images: [IMG], category: "Home & Garden", prices: { QORT: "2" } };
const draft = (v: ProductFormValues, now = 5000) =>
  newProductDraft({ values: v, coins: ["QORT"], storeId: "q-store-general-my-shop", name: "Seller", uid: "PRODxxxxx1", now }) as Record<string, any>;

describe("the seller's stock count", () => {
  it("is off for a new product: no count is written", () => {
    expect(values.stock).toEqual({ tracked: false, quantity: "" });
    expect("stock" in draft(values)).toBe(false);
  });

  it("counts from when it is saved", () => {
    expect(draft({ ...values, stock: { tracked: true, quantity: "12" } }).stock).toEqual({ v: 1, quantity: 12, since: 5000 });
  });

  it("says what's missing or wrong", () => {
    expect(stockFormProblem({ tracked: true, quantity: "" })).toBe("Type the units in stock.");
    expect(stockFormProblem({ tracked: true, quantity: "2.5" }, "Mug — Large")).toBe("Type the units in stock of Mug — Large as a whole number.");
    expect(stockFormProblem({ tracked: true, quantity: "", saved: { v: 1, quantity: 3, since: 1 } })).toBeNull();
    expect(stockFormProblem({ tracked: false, quantity: "x" })).toBeNull();
  });

  it("keeps an edited product's count and time when no number is typed, with the orders voided since; a number recounts from then", () => {
    const base = { ...draft({ ...values, stock: { tracked: true, quantity: "5" } }, 1000), catalogueId: "q-store-catalogue-my-shop-CATxxxxxx1", isUpdate: true } as unknown as Record<string, any> & { id: string };
    const opened = formValuesFor(base, ["QORT"]);
    expect(opened.stock).toEqual(stockFormOf(base));
    expect(opened.stock).toEqual({ tracked: true, quantity: "", saved: { v: 1, quantity: 5, since: 1000 }, voided: [] });
    const edit = (stock: ProductFormValues["stock"]) => editedProductDraft({ base, values: { ...opened, stock }, coins: ["QORT"], name: "Seller", now: 9000 }) as Record<string, any>;
    expect(edit(opened.stock).stock).toEqual({ v: 1, quantity: 5, since: 1000 });
    expect(edit({ ...opened.stock!, voided: ["ORDERxxxx1"] }).stock).toEqual({ v: 1, quantity: 5, since: 1000, voided: ["ORDERxxxx1"] });
    expect(edit({ ...opened.stock!, quantity: "8" }).stock).toEqual({ v: 1, quantity: 8, since: 9000 });
    expect("stock" in edit({ tracked: false, quantity: "" })).toBe(false);
    // An auction sells one of a kind: its count goes.
    expect("stock" in (editedProductDraft({ base, values: { ...opened, sale: "auction", auction: { ...defaultAuctionValues(9000), startingBid: "1" } }, coins: ["QORT"], name: "Seller", now: 9000 }) as Record<string, any>)).toBe(false);
  });

  it("puts each counted product's count on its list row, and takes it off a row whose product has none", () => {
    const counted = draft({ ...values, stock: { tracked: true, quantity: "3" } });
    const plain = { ...draft(values), id: "q-store-product-my-shop-PRODxxxxx2" };
    const dataContainer = {
      id: "q-store-general-my-shop-datacontainer",
      products: { [counted.id]: { catalogueId: "c", status: "AVAILABLE" }, [plain.id]: { catalogueId: "c", status: "AVAILABLE", stock: { v: 1, quantity: 9, since: 1 } } },
    } as never;
    const built = withStockRows({ dataContainer, resources: [], catalogues: [] }, { [counted.id]: counted, [plain.id]: plain } as never);
    const rows = (built.dataContainer as { products: Record<string, Record<string, unknown>> }).products;
    expect(rows[counted.id].stock).toEqual({ v: 1, quantity: 3, since: 5000 });
    expect("stock" in rows[plain.id]).toBe(false);
  });

  it("counts each variant item on its own", () => {
    const form: VariantFormValues = {
      options: [{ name: "Size", values: [{ name: "Small" }, { name: "Large" }], picture: null }],
      display: "bundle",
      rows: { [valuesKey(["Size", "Small"])]: { price: "", picture: null, stock: "4" }, [valuesKey(["Size", "Large"])]: { price: "", picture: null, stock: "" } },
    };
    const tracked = { ...values, stock: { tracked: true, quantity: "" } };
    expect(variantFormProblem(form, tracked, null)).toBe("Type the units in stock of Size / Large.");
    form.rows[valuesKey(["Size", "Large"])].stock = "0";
    let n = 0;
    const drafts = variantDrafts({ values: tracked, form, coins: ["QORT"], storeId: "q-store-general-my-shop", name: "Seller", uid: () => `UID${++n}xxxxxx`, now: 7000 }) as Record<string, any>[];
    expect(drafts.map((d) => d.stock)).toEqual([
      { v: 1, quantity: 4, since: 7000 },
      { v: 1, quantity: 0, since: 7000 },
    ]);
  });
});
