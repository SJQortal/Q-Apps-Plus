/**
 * The order a seller arranges their shop's products in (community request,
 * 2026-10-22: "determine the order my products are displayed to the shopper
 * in"). New data, additive only (CLAUDE.md rule 1): the product index
 * (`<storeId>-datacontainer`) gains `productOrder`, the product ids in the
 * seller's order. Both apps' product publishes spread the index and keep it;
 * the original never reads it, and its "Recreate shop data" drops it (the
 * shop then lists newest first again until the seller arranges it).
 *
 * Shop pages offer it as the "Collections" sort, the default when there is one:
 * the arranged products in their order, then any the seller added since,
 * newest first. A collection's own order is the order of its own `products`
 * (qdn/collections.ts).
 */
import { dataContainerIdentifier } from "./identifiers";
import { jsonToBase64, type DataContainerDoc, type PublishResource } from "./payloads";

/** The most products an order keeps (a shop with more lists the rest after them, newest first). */
export const MAX_PRODUCT_ORDER = 1000;

/** The seller's order as the index holds it: product ids, once each. Anything malformed is skipped. */
export function productOrderOf(index: object | null | undefined): string[] {
  const list = (index as { productOrder?: unknown } | null | undefined)?.productOrder;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  for (const id of list) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    if (seen.size >= MAX_PRODUCT_ORDER) break;
  }
  return [...seen];
}

/**
 * The shop's listed products in its order: those the order names first, in
 * that order, then the rest as `rest` has them (newest first on the seller
 * page). Ids the shop no longer lists are left out.
 */
export function arrangeProducts(order: string[], rest: string[]): string[] {
  const listed = new Set(rest);
  const first = order.filter((id) => listed.has(id));
  const placed = new Set(first);
  return [...first, ...rest.filter((id) => !placed.has(id))];
}

/**
 * Featured with collections (Simon, 2026-10-24: "the products list should be
 * ordered according how the user has collections ordered"): each
 * collection's products in the collection's own order, the collections in
 * the order the seller gave them, each product once (at its first
 * collection); then the rest in the shop's arranged order. `sectionOf` says
 * which collection placed a product (its index); products it doesn't name
 * belong to none. Reading only: nothing new is published.
 */
export function featuredOrder(
  collections: readonly { products: readonly string[] }[],
  shopOrder: readonly string[]
): { order: string[]; sectionOf: Map<string, number> } {
  const sectionOf = new Map<string, number>();
  const order: string[] = [];
  collections.forEach((collection, i) => {
    for (const id of collection.products) {
      if (typeof id !== "string" || !id || sectionOf.has(id)) continue;
      sectionOf.set(id, i);
      order.push(id);
    }
  });
  for (const id of shopOrder) if (!sectionOf.has(id)) order.push(id);
  return { order: [...new Set(order)], sectionOf };
}

/**
 * Save the order: the product index with `productOrder`, its original shape
 * otherwise unchanged. Going back to newest first saves an empty order rather
 * than none, so a copy loaded before can't bring the old order back
 * (seller/productIndex.ts mergeProductIndexes).
 */
export function buildProductOrderPublish(args: { name: string; storeId: string; dataContainer: DataContainerDoc; order: string[] }) {
  const order = [...new Set(args.order.filter((id) => typeof id === "string" && id))].slice(0, MAX_PRODUCT_ORDER);
  const dataContainer: DataContainerDoc = { ...args.dataContainer, productOrder: order };
  const resources: PublishResource[] = [
    {
      name: args.name,
      service: "DOCUMENT",
      identifier: dataContainer.id || dataContainerIdentifier(args.storeId),
      filename: "datacontainer.json",
      data64: jsonToBase64(dataContainer),
    },
  ];
  return { dataContainer, resources };
}
