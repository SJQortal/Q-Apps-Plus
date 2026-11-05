/**
 * Product categories (Follow-up 19 and Simon's follow-up: "a set of
 * categories to be selected from, not every user making up their own"). The
 * product form offers this one list, the same for every shop, and nothing
 * else, so the same kind of product has the same category in every shop and
 * the Products page can filter all of them by it.
 *
 * The list is eBay's top level (ebay.com/n/all-categories, 2026-10-22), with
 * Amazon's department names where they read better ("Electronics &
 * Computers", "Food & Drink"). eBay Motors and Real Estate became Vehicles &
 * Parts and are otherwise left out, and three were added for what Qortal shops
 * sell (the local node's products, 2026-10-22, read-only): Digital Goods &
 * Software, Services, and Coins & Bullion (eBay files them under Collectibles,
 * but the biggest shops on the node sell little else).
 *
 * Data: a product's `category` is still the plain text the original writes
 * (one of these names). Products saved before keep their own text: both apps
 * show it, the Products page lists it under "Other categories", and editing
 * such a product here keeps it until the seller picks one from the list.
 */
export const SHOP_CATEGORIES = [
  "Baby",
  "Books, Movies & Music",
  "Business & Industrial",
  "Clothing, Shoes & Accessories",
  "Coins & Bullion",
  "Collectibles & Art",
  "Digital Goods & Software",
  "Electronics & Computers",
  "Food & Drink",
  "Gift Cards & Coupons",
  "Health & Beauty",
  "Home & Garden",
  "Jewelry & Watches",
  "Pet Supplies",
  "Services",
  "Sporting Goods",
  "Tickets & Travel",
  "Toys & Hobbies",
  "Vehicles & Parts",
  "Everything Else",
] as const;

export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

/** The same category whatever its case and spaces ("Baby" and " baby "). */
export function categoryKey(category: string | null | undefined): string {
  return (category ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

const BY_KEY = new Map<string, ShopCategory>(SHOP_CATEGORIES.map((c) => [categoryKey(c), c]));

/** The listed category this text names (any case and spacing), or null. */
export function listedCategory(text: string | null | undefined): ShopCategory | null {
  return BY_KEY.get(categoryKey(text)) ?? null;
}

export function isListedCategory(text: string | null | undefined): boolean {
  return listedCategory(text) !== null;
}

/**
 * A product's saved category that isn't one of the list (typed before the
 * list existed, or in the original): kept while its product is edited, until
 * the seller picks a listed one. Null for a listed or empty category.
 */
export function oldCategoryOf(product: Record<string, unknown> | null | undefined): string | null {
  const text = typeof product?.category === "string" ? product.category.trim() : "";
  return text && !isListedCategory(text) ? text : null;
}
