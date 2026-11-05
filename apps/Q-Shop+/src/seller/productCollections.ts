/**
 * A product's collections, chosen in its form (the Collections field): the
 * shop's collections document (qdn/collections.ts) lists product ids, so
 * putting a product in a collection adds its ids there, after the others,
 * and taking it out removes them. A product in variants is in a collection
 * with all its items.
 */
import type { ShopCollection } from "../qdn/collections";

/** The ids of the collections that hold any of these products, in the shop's order. */
export function collectionsWith(collections: ShopCollection[], productIds: string[]): string[] {
  const ids = new Set(productIds);
  return collections.filter((c) => c.products.some((id) => ids.has(id))).map((c) => c.id);
}

/**
 * The products in the chosen collections (added at the end, in the order
 * given) and in none of the others. A collection that doesn't change is the
 * same object, so a choice that changes nothing leaves the list as it was.
 */
export function placeInCollections(collections: ShopCollection[], productIds: string[], chosen: string[], now: number): ShopCollection[] {
  const picked = new Set(chosen);
  const ids = new Set(productIds);
  return collections.map((c) => {
    if (picked.has(c.id)) {
      const missing = productIds.filter((id, i) => !c.products.includes(id) && productIds.indexOf(id) === i);
      return missing.length > 0 ? { ...c, products: [...c.products, ...missing], updated: now } : c;
    }
    const kept = c.products.filter((id) => !ids.has(id));
    return kept.length !== c.products.length ? { ...c, products: kept, updated: now } : c;
  });
}
