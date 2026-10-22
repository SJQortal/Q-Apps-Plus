/**
 * The shop's product index (the data container) as the seller page holds it
 * and as QDN serves it now. A publish rebuilds the whole index, so it must
 * start from the newest one: one loaded with the page may predate a publish
 * from another tab or device, and building on it would drop the products that
 * publish added (docs/apps/Q-Shop+.md → Data contract: the index is the only
 * list of a shop's products).
 *
 * Nothing here changes the original's shape: the merged index is the
 * original's, plus two additive fields the + app writes and both apps'
 * publishes keep (they spread the index): `collectionsId`
 * (qdn/collections.ts) and `deletedProducts`, `{ productId: when }`, the
 * products a + app delete removed. Without that record a copy loaded before
 * a delete couldn't tell a deleted product from one added elsewhere, and its
 * next publish would bring the deleted product back.
 */
import { deletedProductsOf, mergeDeletions, type DataContainerDoc } from "../qdn/payloads";

export { MAX_DELETED_PRODUCTS, deletedProductsOf, mergeDeletions } from "../qdn/payloads";

type IndexEntry = DataContainerDoc["products"][string];
type CatalogueEntry = NonNullable<DataContainerDoc["catalogues"]>[number];

/** The same JSON, whatever the key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** True for a JSON body that is a product index (it has a products map). */
export function isProductIndexDoc(body: unknown): body is DataContainerDoc {
  const products = (body as { products?: unknown } | null)?.products;
  return !!body && typeof body === "object" && !!products && typeof products === "object" && !Array.isArray(products);
}

/**
 * What an index names (its products, catalogues, collections pointer and
 * deletions), as a string two copies can be compared by.
 */
export function indexKey(index: Pick<DataContainerDoc, "products" | "catalogues"> & { collectionsId?: unknown; deletedProducts?: unknown }): string {
  return canonical({
    products: index.products ?? {},
    catalogues: index.catalogues ?? [],
    collectionsId: typeof index.collectionsId === "string" ? index.collectionsId : null,
    deletedProducts: deletedProductsOf(index),
  });
}

/**
 * The two copies merged so that nothing either one names is lost, and
 * nothing either one deleted comes back. The fresh copy (on QDN now) is the
 * base and wins for a product both have; a product or catalogue only the
 * seen copy has is kept (the node may not serve this tab's own latest
 * publish yet, or another device may have published from a stale copy),
 * unless either copy records it as deleted. A product is listed only under
 * the catalogue its entry names. The collections pointer is the fresh
 * copy's, else the seen copy's.
 */
export function mergeProductIndexes(seen: DataContainerDoc, fresh: DataContainerDoc): DataContainerDoc {
  const deleted = mergeDeletions(deletedProductsOf(fresh), deletedProductsOf(seen));
  const products: Record<string, IndexEntry> = {};
  for (const [id, entry] of Object.entries(fresh.products ?? {})) {
    if (!(id in deleted)) products[id] = structuredClone(entry);
  }
  for (const [id, entry] of Object.entries(seen.products ?? {})) {
    if (!(id in products) && !(id in deleted)) products[id] = structuredClone(entry);
  }
  const catalogues: CatalogueEntry[] = structuredClone(fresh.catalogues ?? []).map((cat) => ({
    ...cat,
    products: Object.fromEntries(Object.entries(cat.products ?? {}).filter(([id]) => id in products)) as Record<string, true>,
  }));
  for (const cat of seen.catalogues ?? []) {
    let merged = catalogues.find((c) => c.id === cat.id);
    if (!merged) {
      merged = { id: cat.id, products: {} };
      catalogues.push(merged);
    }
    for (const id of Object.keys(cat.products ?? {})) {
      if (products[id]?.catalogueId === cat.id) merged.products[id] = true;
    }
  }
  const result: DataContainerDoc = { ...fresh, products };
  if (catalogues.length > 0 || fresh.catalogues) result.catalogues = catalogues;
  const pointer = typeof fresh.collectionsId === "string" ? fresh.collectionsId : seen.collectionsId;
  if (typeof pointer === "string") result.collectionsId = pointer;
  if (Object.keys(deleted).length > 0) result.deletedProducts = deleted;
  else delete result.deletedProducts;
  return result;
}

/**
 * Catalogues whose content may differ between the two copies: the catalogue
 * of every product the merged copy adds or changes, and every catalogue whose
 * product list changed. Copies of these held by the page are read again.
 */
export function changedCatalogueIds(seen: DataContainerDoc, merged: DataContainerDoc): string[] {
  const ids = new Set<string>();
  for (const [id, entry] of Object.entries(merged.products ?? {})) {
    const before = seen.products?.[id];
    if (!before || canonical(before) !== canonical(entry)) {
      if (entry?.catalogueId) ids.add(entry.catalogueId);
    }
  }
  for (const cat of merged.catalogues ?? []) {
    const before = seen.catalogues?.find((c) => c.id === cat.id);
    if (!before || canonical(before.products ?? {}) !== canonical(cat.products ?? {})) ids.add(cat.id);
  }
  return [...ids];
}

/**
 * What this session published per shop: every index its publishes replaced,
 * and the one it sent last. Right after a publish the node may still serve
 * an index from before it, even from before several publishes in a row
 * (or a shop deleted and created again); those are this session's own
 * earlier versions, not a change from elsewhere.
 */
const published = new Map<string, { replaced: Set<string>; latest: string }>();

/** A publish of the shop's index: `base` (what it replaced, when known) and `sent`. */
export function notePublishedIndex(storeId: string, base: string | null, sent: string): void {
  const previous = published.get(storeId);
  const entry = previous ?? { replaced: new Set<string>(), latest: sent };
  // A new publish replaces the one this session sent before, whatever it was built on.
  if (previous) entry.replaced.add(previous.latest);
  if (base !== null) entry.replaced.add(base);
  entry.replaced.delete(sent);
  entry.latest = sent;
  published.set(storeId, entry);
}

/** True when `seenKey` is the index this session sent last and `freshKey` one its publishes replaced. */
export function isOwnPublishNotServedYet(storeId: string, seenKey: string, freshKey: string): boolean {
  const entry = published.get(storeId);
  return !!entry && entry.latest === seenKey && entry.replaced.has(freshKey);
}

/** For tests. */
export function resetPublishedIndexes(): void {
  published.clear();
}
