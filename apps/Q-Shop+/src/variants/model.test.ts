import { describe, expect, it } from "vitest";
import { decodeData64 } from "../test/fixtures/shop";
import { bundleRows, combinations, variantFor, variantGroupsOf, variantOf, variantSiblings, variantTitle, withVariantRows, type VariantGroup } from "./model";

const options = [
  { name: "Colour", values: ["Red", "Blue"] },
  { name: "Size", values: ["S", "M", "L"] },
];
const variant = (values: string[], extra: Record<string, unknown> = {}) => ({ group: "G1", title: "T-shirt", options, values, display: "bundle", lead: "p-red-s", ...extra });

describe("variants", () => {
  it("are every combination of the options, named for their values", () => {
    expect(combinations(options)).toEqual([
      ["Red", "S"],
      ["Red", "M"],
      ["Red", "L"],
      ["Blue", "S"],
      ["Blue", "M"],
      ["Blue", "L"],
    ]);
    expect(combinations([])).toEqual([]);
    expect(variantTitle(" T-shirt ", ["Red", "S"])).toBe("T-shirt — Red / S");
  });

  it("are read from a product only when well formed", () => {
    expect(variantOf({ variant: variant(["Red", "S"]) })).toEqual({ ...variant(["Red", "S"]) });
    expect(variantOf({ variant: variant(["Green", "S"]) })).toBeNull();
    expect(variantOf({ variant: variant(["Red"]) })).toBeNull();
    expect(variantOf({ variant: { ...variant(["Red", "S"]), group: "bad group!" } })).toBeNull();
    expect(variantOf({})).toBeNull();
    // An unknown display is a bundle.
    expect(variantOf({ variant: variant(["Red", "S"], { display: "?" }) })?.display).toBe("bundle");
  });

  it("go into the product list: each row its group and values and its own status, the groups on the index", () => {
    const index = {
      storeId: "s",
      id: "s-datacontainer",
      products: {
        "p-red-s": { created: 1, priceQort: 5, category: "", catalogueId: "c", status: "AVAILABLE" },
        "p-red-m": { created: 1, priceQort: 6, category: "", catalogueId: "c", status: "AVAILABLE" },
        "p-plain": { created: 1, priceQort: 2, category: "", catalogueId: "c", status: "AVAILABLE", variant: { group: "OLD", values: ["x"] } },
      },
      variantGroups: { OLD: { title: "Old", options: [{ name: "x", values: ["x"] }], display: "bundle", lead: "p-plain" } },
    };
    const built = { dataContainer: index as never, resources: [{ name: "n", service: "DOCUMENT", identifier: "s-datacontainer", data64: "" }], catalogues: [] };
    const drafts = {
      "p-red-s": { id: "p-red-s", status: "AVAILABLE", variant: variant(["Red", "S"]) },
      "p-red-m": { id: "p-red-m", status: "OUT_OF_STOCK", variant: variant(["Red", "M"]) },
      // No longer a variant: its row and its (now empty) group go.
      "p-plain": { id: "p-plain" },
    } as never;
    const out = withVariantRows(built, drafts);
    const dc = out.dataContainer as unknown as { products: Record<string, Record<string, unknown>>; variantGroups: Record<string, VariantGroup> };
    expect(dc.products["p-red-s"].variant).toEqual({ group: "G1", values: ["Red", "S"] });
    expect(dc.products["p-red-m"]).toMatchObject({ status: "OUT_OF_STOCK", variant: { group: "G1", values: ["Red", "M"] } });
    expect("variant" in dc.products["p-plain"]).toBe(false);
    expect(dc.variantGroups).toEqual({ G1: { title: "T-shirt", options, display: "bundle", lead: "p-red-s" } });
    expect(decodeData64(out.resources[0].data64)).toEqual(dc);
    expect(variantGroupsOf(dc).G1.display).toBe("bundle");
    expect(variantSiblings(dc, "G1").map((s) => [s.productId, s.values.join("/"), s.status])).toEqual([
      ["p-red-s", "Red/S", "AVAILABLE"],
      ["p-red-m", "Red/M", "OUT_OF_STOCK"],
    ]);
  });

  it("bundle into one row (the first in the list's order) with their count and price range, or stay apart", () => {
    const rows = [
      { productId: "a", priceQort: 1 },
      { productId: "r-m", priceQort: 6, variant: { group: "G1", values: ["Red", "M"] } },
      { productId: "r-s", priceQort: 5, variant: { group: "G1", values: ["Red", "S"] } },
      { productId: "x1", priceQort: 3, variant: { group: "G2", values: ["x"] } },
      { productId: "x2", priceQort: 3, variant: { group: "G2", values: ["y"] } },
    ];
    const groups = {
      G1: { title: "T-shirt", options, display: "bundle" as const, lead: "r-s" },
      G2: { title: "Mugs", options: [{ name: "Kind", values: ["x", "y"] }], display: "separate" as const, lead: "x1" },
    };
    const out = bundleRows(rows, groups);
    expect(out.map((r) => r.productId)).toEqual(["a", "r-m", "x1", "x2"]);
    expect(out[1].bundle).toEqual({ group: "G1", title: "T-shirt", count: 2, minQort: 5, maxQort: 6 });
    expect(out[2].bundle).toBeUndefined();
  });

  it("lead a choice to the variant with that value, the others kept where they can be", () => {
    const siblings = [
      { productId: "rs", catalogueId: "c", values: ["Red", "S"], status: "AVAILABLE" },
      { productId: "rm", catalogueId: "c", values: ["Red", "M"], status: "AVAILABLE" },
      { productId: "bs", catalogueId: "c", values: ["Blue", "S"], status: "AVAILABLE" },
    ];
    expect(variantFor(siblings, ["Red", "S"], 1, "M")?.productId).toBe("rm");
    expect(variantFor(siblings, ["Red", "M"], 0, "Blue")?.productId).toBe("bs");
    expect(variantFor(siblings, ["Red", "S"], 1, "L")).toBeNull();
  });
});
