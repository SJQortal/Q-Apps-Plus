import { describe, expect, it } from "vitest";
import { SENT_CATALOGUE_WINDOW_MS, isCatalogueBehind, noteSentCatalogue, sentCatalogue } from "./sentCatalogues";

describe("catalogues this session sent", () => {
  const sent = { id: "cat", products: { a: { title: "A" }, b: { title: "B" } } };

  it("counts a different copy as the node lagging, for a while after sending", () => {
    noteSentCatalogue("Seller", sent, 1000);
    expect(isCatalogueBehind("Seller", "cat", { id: "cat", products: { a: { title: "A" } } }, 2000)).toBe(true);
    // The same JSON in another key order, or with the app's own fields, is what was sent.
    expect(isCatalogueBehind("Seller", "cat", { products: { b: { title: "B" }, a: { title: "A" } }, id: "cat", user: "Seller", isValid: true }, 2000)).toBe(false);
    expect(isCatalogueBehind("Seller", "cat", { id: "cat", products: {} }, 1000 + SENT_CATALOGUE_WINDOW_MS + 1)).toBe(false);
    expect(isCatalogueBehind("Other", "cat", { id: "cat", products: {} }, 2000)).toBe(false);
  });

  it("hands back a copy of what was sent, within the window", () => {
    noteSentCatalogue("Seller", { ...sent, user: "Seller", isValid: true }, 1000);
    const copy = sentCatalogue("Seller", "cat", 2000)!;
    expect(copy).toEqual(sent);
    (copy.products as Record<string, unknown>).c = {};
    expect(sentCatalogue("Seller", "cat", 2000)).toEqual(sent);
    expect(sentCatalogue("Seller", "cat", 1000 + SENT_CATALOGUE_WINDOW_MS + 1)).toBeNull();
  });
});
