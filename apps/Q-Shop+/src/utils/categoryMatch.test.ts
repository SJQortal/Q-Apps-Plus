import { describe, expect, it } from "vitest";
import { SHOP_CATEGORIES } from "../constants/categories";
import { CATEGORY_TERMS } from "../constants/categoryTerms";
import { normalizeWords, searchCategories, singular, suggestCategory, termCount } from "./categoryMatch";

describe("the term list", () => {
  it("puts each term in one category, and holds about 2,100 of them", () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const category of SHOP_CATEGORIES) {
      for (const raw of CATEGORY_TERMS[category].split(",")) {
        const term = normalizeWords(raw);
        if (!term) continue;
        if (seen.has(term) && seen.get(term) !== category) twice.push(`${term}: ${seen.get(term)} / ${category}`);
        seen.set(term, category);
      }
    }
    expect(twice).toEqual([]);
    expect(termCount()).toBeGreaterThan(2000);
  });
});

describe("a category from a product title", () => {
  it.each([
    ["Blue Light Blocking Glasses | Night", "Health & Beauty"],
    ["Icelandic Grass-Fed Ghee | 800g", "Food & Drink"],
    ["Sterling Silver Necklace with Pendant", "Jewelry & Watches"],
    ["1 oz Silver Round - .999 fine", "Coins & Bullion"],
    ["Goldback 5 Aurum (Utah)", "Coins & Bullion"],
    ["Silver personal care products", "Health & Beauty"],
    ["Organic Cotton Hoodie, black", "Clothing, Shoes & Accessories"],
    ["Polarized Sunglasses for men", "Clothing, Shoes & Accessories"],
    ["Crystal Wine Glasses, set of 6", "Home & Garden"],
    ["Raspberry Pi 5 Starter Kit", "Electronics & Computers"],
    ["Single board computers - Orange Pi", "Electronics & Computers"],
    ["Heirloom Tomato Seeds, 50 pack", "Home & Garden"],
    ["Wild Melons", "Food & Drink"],
    ["Dog Harness, reflective", "Pet Supplies"],
    ["1 hour online coaching session", "Services"],
    ["Voice/Video Call (30 min)", "Services"],
    ["Bitcoin Guide PDF - digital download", "Digital Goods & Software"],
    ["Amazon Gift Card $50", "Gift Cards & Coupons"],
    ["Festival Pass 2027", "Tickets & Travel"],
    ["Wooden Chess Set", "Toys & Hobbies"],
    ["Tarot Deck with guidebook", "Toys & Hobbies"],
    ["Brake Pads for Toyota Corolla", "Vehicles & Parts"],
    ["Yoga Mat, non-slip", "Sporting Goods"],
    ["Signed Vinyl Record - limited edition", "Books, Movies & Music"],
    ["Briar Tobacco Pipe", "Everything Else"],
    ["Newborn Swaddle Blanket", "Baby"],
    ["Hand-painted oil painting on canvas", "Collectibles & Art"],
    ["Industrial Air Compressor 50L", "Business & Industrial"],
    ["Raw honey 500g", "Food & Drink"],
    ["Hardware wallet for Bitcoin", "Electronics & Computers"],
  ])("%s → %s", (title, category) => {
    expect(suggestCategory(title)).toBe(category);
  });

  it("suggests nothing when no word is known", () => {
    expect(suggestCategory("Füüsilised asjad")).toBeNull();
    expect(suggestCategory("")).toBeNull();
  });
});

describe("searching categories as one types", () => {
  it("finds the category a word belongs to, then others that word starts", () => {
    expect(searchCategories("glasses")[0]).toEqual({ category: "Health & Beauty", via: "glasses" });
    expect(searchCategories("Glasses").map((h) => h.category)).toContain("Clothing, Shoes & Accessories");
    expect(searchCategories("ghee")[0]).toEqual({ category: "Food & Drink", via: "ghee" });
    expect(searchCategories("hoodies")[0]).toEqual({ category: "Clothing, Shoes & Accessories", via: "hoodie" });
    // A category's own name, as typed.
    expect(searchCategories("toy")[0].category).toBe("Toys & Hobbies");
    expect(searchCategories("ba")[0]).toEqual({ category: "Baby" });
    expect(searchCategories("")).toHaveLength(SHOP_CATEGORIES.length);
    expect(searchCategories("zzzzqq")).toEqual([]);
  });

  it("reads words as shop titles write them", () => {
    expect(normalizeWords("T-Shirt & Café's")).toBe("t shirt and cafes");
    expect(singular("berries")).toBe("berry");
    expect(singular("boxes")).toBe("box");
    expect(singular("glass")).toBe("glass");
    expect(singular("melons")).toBe("melon");
  });
});
