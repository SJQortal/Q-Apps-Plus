import { describe, expect, it } from "vitest";
import { decodeData64 } from "../test/fixtures/shop";
import { bundleRows, colorOf, itemCount, itemForValue, itemForVariant, variantGroupsOf, variantItems, variantOf, variantSiblings, variantTitle, withVariantRows, type VariantGroup } from "./model";

// Glasses: Round in four lens colours, Square in one, and a gift box without values.
const options = [
  { name: "Round", values: [{ name: "Pale", color: "#f1f5f9" }, { name: "Orange", color: "#f97316" }, { name: "Red" }, { name: "Yellow" }] },
  { name: "Square", values: [{ name: "Pale" }] },
  { name: "Gift box", values: [] },
];
const variant = (values: string[], extra: Record<string, unknown> = {}) => ({ group: "G1", title: "Glasses", options, values, display: "bundle", lead: "p-round-pale", ...extra });

describe("variants", () => {
  it("are each variant's own values, or the variant alone, never mixed across variants", () => {
    expect(variantItems(options)).toEqual([["Round", "Pale"], ["Round", "Orange"], ["Round", "Red"], ["Round", "Yellow"], ["Square", "Pale"], ["Gift box"]]);
    expect(itemCount(options)).toBe(6);
    expect(variantTitle(" Glasses ", ["Round", "Pale"])).toBe("Glasses | Round / Pale");
    expect(colorOf(options, ["Round", "Orange"])).toBe("#f97316");
    expect(colorOf(options, ["Round", "Red"])).toBeUndefined();
  });

  it("are read from a product only when its item is one of its variants'", () => {
    expect(variantOf({ variant: variant(["Round", "Pale"]) })).toEqual(variant(["Round", "Pale"]));
    expect(variantOf({ variant: variant(["Gift box"]) })?.values).toEqual(["Gift box"]);
    // Square has no Orange; Round needs a value; a gift box has none.
    expect(variantOf({ variant: variant(["Square", "Orange"]) })).toBeNull();
    expect(variantOf({ variant: variant(["Round"]) })).toBeNull();
    expect(variantOf({ variant: variant(["Gift box", "Pale"]) })).toBeNull();
    // A colour that isn't one is dropped; the value stays.
    const odd = variantOf({ variant: variant(["Round", "Pale"], { options: [{ name: "Round", values: [{ name: "Pale", color: "red; x" }] }, { name: "Square", values: [] }] }) });
    expect(odd?.options[0].values[0]).toEqual({ name: "Pale" });
    expect(variantOf({ variant: { ...variant(["Round", "Pale"]), group: "bad group!" } })).toBeNull();
  });

  it("go into the product list: each row its item and its own status, the groups on the index", () => {
    const index = {
      storeId: "s",
      id: "s-datacontainer",
      products: {
        "p-round-pale": { created: 1, priceQort: 5, category: "", catalogueId: "c", status: "AVAILABLE" },
        "p-square-pale": { created: 1, priceQort: 6, category: "", catalogueId: "c", status: "AVAILABLE" },
        "p-plain": { created: 1, priceQort: 2, category: "", catalogueId: "c", status: "AVAILABLE", variant: { group: "OLD", values: ["x"] } },
      },
      variantGroups: { OLD: { title: "Old", options: [{ name: "x", values: [] }], display: "bundle", lead: "p-plain" } },
    };
    const built = { dataContainer: index as never, resources: [{ name: "n", service: "DOCUMENT", identifier: "s-datacontainer", data64: "" }], catalogues: [] };
    const drafts = {
      "p-round-pale": { id: "p-round-pale", status: "AVAILABLE", variant: variant(["Round", "Pale"]) },
      "p-square-pale": { id: "p-square-pale", status: "OUT_OF_STOCK", variant: variant(["Square", "Pale"]) },
      "p-plain": { id: "p-plain" },
    } as never;
    const out = withVariantRows(built, drafts);
    const dc = out.dataContainer as unknown as { products: Record<string, Record<string, unknown>>; variantGroups: Record<string, VariantGroup> };
    expect(dc.products["p-round-pale"].variant).toEqual({ group: "G1", values: ["Round", "Pale"] });
    expect(dc.products["p-square-pale"]).toMatchObject({ status: "OUT_OF_STOCK", variant: { group: "G1", values: ["Square", "Pale"] } });
    expect("variant" in dc.products["p-plain"]).toBe(false);
    expect(dc.variantGroups).toEqual({ G1: { title: "Glasses", options, display: "bundle", lead: "p-round-pale" } });
    expect(decodeData64(out.resources[0].data64)).toEqual(dc);
    expect(variantGroupsOf(dc).G1.options[0].values[1]).toEqual({ name: "Orange", color: "#f97316" });
    expect(variantSiblings(dc, "G1").map((s) => [s.productId, s.values.join("/"), s.status])).toEqual([
      ["p-round-pale", "Round/Pale", "AVAILABLE"],
      ["p-square-pale", "Square/Pale", "OUT_OF_STOCK"],
    ]);
  });

  it("bundle into one row (the first in the list's order) with their count and price range, or stay apart", () => {
    const rows = [
      { productId: "a", priceQort: 1 },
      { productId: "r-o", priceQort: 6, variant: { group: "G1", values: ["Round", "Orange"] } },
      { productId: "r-p", priceQort: 5, variant: { group: "G1", values: ["Round", "Pale"] } },
      { productId: "x1", priceQort: 3, variant: { group: "G2", values: ["x"] } },
      { productId: "x2", priceQort: 3, variant: { group: "G2", values: ["y"] } },
    ];
    const groups = {
      G1: { title: "Glasses", options, display: "bundle" as const, lead: "r-p" },
      G2: { title: "Mugs", options: [{ name: "x", values: [] }, { name: "y", values: [] }], display: "separate" as const, lead: "x1" },
    };
    const out = bundleRows(rows, groups);
    expect(out.map((r) => r.productId)).toEqual(["a", "r-o", "x1", "x2"]);
    expect(out[1].bundle).toEqual({ group: "G1", title: "Glasses", count: 2, minQort: 5, maxQort: 6 });
    expect(out[2].bundle).toBeUndefined();
  });

  it("lead a variant's choice to the same value there, else its first; a value's within the variant", () => {
    const siblings = [
      { productId: "rp", catalogueId: "c", values: ["Round", "Pale"], status: "AVAILABLE" },
      { productId: "ro", catalogueId: "c", values: ["Round", "Orange"], status: "AVAILABLE" },
      { productId: "sp", catalogueId: "c", values: ["Square", "Pale"], status: "AVAILABLE" },
      { productId: "gb", catalogueId: "c", values: ["Gift box"], status: "AVAILABLE" },
    ];
    expect(itemForVariant(siblings, ["Round", "Pale"], "Square")?.productId).toBe("sp");
    expect(itemForVariant(siblings, ["Round", "Orange"], "Square")?.productId).toBe("sp");
    expect(itemForVariant(siblings, ["Round", "Orange"], "Gift box")?.productId).toBe("gb");
    expect(itemForValue(siblings, ["Round", "Pale"], "Orange")?.productId).toBe("ro");
    expect(itemForValue(siblings, ["Square", "Pale"], "Orange")).toBeNull();
  });
});
