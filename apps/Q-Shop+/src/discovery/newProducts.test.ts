import { beforeEach, describe, expect, it, vi } from "vitest";
import { installQortalMock } from "../test/qortalMock";
import { loadNewProducts, newProductsFrom, NEW_PRODUCTS_MAX, resetNewProductsCache, shortStoreIdOfCatalogue } from "./newProducts";
import type { QdnResourceSummary } from "../qdn/search";

const IMG = "data:image/webp;base64,SU1H";

function product(id: string, created: number, extra: Record<string, unknown> = {}) {
  return {
    title: `Product ${id}`,
    description: "A product",
    created,
    type: "physical",
    images: [IMG],
    mainImageIndex: 0,
    price: [{ currency: "qort", value: 5 }],
    status: "AVAILABLE",
    ...extra,
  };
}

const row = (name: string, identifier: string, created = 1): QdnResourceSummary => ({ name, service: "DOCUMENT", identifier, created });
const listedAll = () => true;

beforeEach(() => {
  resetNewProductsCache();
  vi.unstubAllGlobals();
});

describe("new products", () => {
  it("reads the short shop id of a catalogue", () => {
    expect(shortStoreIdOfCatalogue("q-store-catalogue-my-shop-ABCDEFGHIJ")).toBe("my-shop");
    expect(shortStoreIdOfCatalogue("q-store-catalogue-x-UID")).toBe("x");
    expect(shortStoreIdOfCatalogue("q-store-catalogue-UID")).toBeNull();
    expect(shortStoreIdOfCatalogue("q-store-review-x-UID-40")).toBeNull();
  });

  it("shows a group of variants listed as one once, by the group's title; variants listed apart each", () => {
    const options = [{ name: "Size", values: [{ name: "S" }, { name: "M" }] }];
    const v = (values: string[], display: string, group = "G1") => ({ variant: { group, title: "T-shirt", options, values: ["Size", ...values], display, lead: "p1" } });
    const items = newProductsFrom(
      [
        {
          row: row("Seller", "q-store-catalogue-shop-CAT0000001"),
          json: {
            products: {
              p1: product("1", 30, { title: "T-shirt — S", ...v(["S"], "bundle") }),
              p2: product("2", 30, { title: "T-shirt — M", ...v(["M"], "bundle") }),
              p3: product("3", 20, { title: "Mug — S", ...v(["S"], "separate", "G2") }),
              p4: product("4", 20, { title: "Mug — M", ...v(["M"], "separate", "G2") }),
            },
          },
        },
      ],
      listedAll
    );
    expect(items.map((i) => i.product.title)).toEqual(["T-shirt", "Mug — S", "Mug — M"]);
  });

  it("keeps valid, unretired products with an image, newest first, and links them to the publisher's shop", () => {
    const items = newProductsFrom(
      [
        {
          row: row("Seller Name", "q-store-catalogue-my-shop-CAT0000001"),
          json: {
            id: "q-store-catalogue-my-shop-CAT0000001",
            products: {
              a: product("a", 10),
              b: product("b", 30),
              retired: product("retired", 40, { status: "RETIRED" }),
              noImage: product("noImage", 50, { images: [] }),
              webImage: product("webImage", 50, { images: ["https://example.com/x.png"] }),
              broken: { title: "No price", created: 60 },
              soldOut: product("soldOut", 20, { status: "OUT_OF_STOCK" }),
            },
          },
        },
      ],
      listedAll
    );
    expect(items.map((i) => i.product.id)).toEqual(["b", "soldOut", "a"]);
    expect(items[0]).toMatchObject({
      owner: "Seller Name",
      storeId: "q-store-general-my-shop",
      catalogueId: "q-store-catalogue-my-shop-CAT0000001",
      image: IMG,
    });
  });

  it("leaves out products whose title isn't text, and keeps the fields it shows in their types", () => {
    const items = newProductsFrom(
      [
        {
          row: row("Seller Name", "q-store-catalogue-my-shop-CAT0000001"),
          json: {
            products: {
              objectTitle: product("objectTitle", 90, { title: { a: 1 } }),
              numberTitle: product("numberTitle", 80, { title: 5 }),
              blankTitle: product("blankTitle", 70, { title: "   " }),
              badDate: product("badDate", 60, { created: { at: 1 } }),
              textDate: product("textDate", "50" as unknown as number),
              oddStatus: product("oddStatus", 40, { status: { s: "AVAILABLE" } }),
              oddDescription: product("oddDescription", 30, { description: ["x"] }),
            },
          },
        },
      ],
      listedAll
    );
    expect(items.map((i) => i.product.id)).toEqual(["textDate", "oddStatus", "oddDescription"]);
    expect(items[0].product.created).toBe(50);
    expect(items[1].product.status).toBeUndefined();
    expect(items[2].product.description).toBeUndefined();
    for (const item of items) expect(typeof item.product.title).toBe("string");
  });

  it("keeps products without a description, which the product form allows", () => {
    const items = newProductsFrom(
      [
        {
          row: row("Seller Name", "q-store-catalogue-my-shop-CAT0000001"),
          json: {
            products: {
              empty: product("empty", 30, { description: "" }),
              missing: product("missing", 20, { description: undefined, type: undefined }),
              noPrice: product("noPrice", 10, { price: undefined }),
              noImages: product("noImages", 5, { images: "data:image/webp;base64,SU1H" }),
            },
          },
        },
      ],
      listedAll
    );
    expect(items.map((i) => i.product.id)).toEqual(["empty", "missing"]);
  });

  it("leaves out catalogues of shops that aren't listed under that name, and the hidden test shop", () => {
    const json = { products: { a: product("a", 10) } };
    const items = newProductsFrom(
      [
        { row: row("Impostor", "q-store-catalogue-my-shop-CAT0000001"), json },
        { row: row("Bester", "q-store-catalogue-test-CAT0000001"), json },
        { row: row("Seller Name", "q-store-catalogue-my-shop-CAT0000002"), json },
      ],
      (owner, storeId) => owner !== "Impostor" && storeId === "q-store-general-my-shop" || owner === "Bester"
    );
    expect(items.map((i) => i.owner)).toEqual(["Seller Name"]);
  });

  it("shows at most twelve", () => {
    const products = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`p${i}`, product(`p${i}`, i)]));
    const items = newProductsFrom([{ row: row("S", "q-store-catalogue-s-CAT0000001"), json: { products } }], listedAll);
    expect(items).toHaveLength(NEW_PRODUCTS_MAX);
    expect(items[0].product.id).toBe("p19");
  });

  it("searches the four newest catalogues and fetches each listed one through Hub, once per session", async () => {
    const rows = [
      row("Seller Name", "q-store-catalogue-my-shop-CAT0000001", 4),
      row("Other", "q-store-catalogue-other-CAT0000001", 3),
      row("Unlisted", "q-store-catalogue-gone-CAT0000001", 2),
    ];
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) }));
    vi.stubGlobal("fetch", fetchMock);
    const q = installQortalMock({
      FETCH_QDN_RESOURCE: async (p) => {
        if (p.name === "Other") throw { error: 1401, message: "Not found" };
        return { products: { a: product("a", 10) } };
      },
    });
    const listed = (owner: string) => owner !== "Unlisted";
    const items = await loadNewProducts(listed);
    const params = new URLSearchParams(fetchMock.mock.calls[0][0].split("?")[1]);
    expect(params.get("service")).toBe("DOCUMENT");
    expect(params.get("identifier")).toBe("q-store-catalogue-");
    expect(params.get("prefix")).toBe("true");
    expect(params.get("reverse")).toBe("true");
    expect(params.get("limit")).toBe("4");
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toEqual([
      { action: "FETCH_QDN_RESOURCE", name: "Seller Name", service: "DOCUMENT", identifier: "q-store-catalogue-my-shop-CAT0000001" },
      { action: "FETCH_QDN_RESOURCE", name: "Other", service: "DOCUMENT", identifier: "q-store-catalogue-other-CAT0000001" },
    ]);
    // One catalogue failing leaves the others.
    expect(items.map((i) => i.owner)).toEqual(["Seller Name"]);
    await loadNewProducts(listed);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The one that failed is asked again; the one that loaded isn't.
    expect(q.callsFor("FETCH_QDN_RESOURCE")).toHaveLength(3);
  });
});
