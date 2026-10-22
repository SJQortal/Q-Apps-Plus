/**
 * The shop's product index (the data container) as the seller page holds it
 * and as QDN serves it now. A publish rebuilds the whole index, so it must
 * start from the newest one: one loaded with the page may predate a publish
 * from another tab or device, and building on it would drop the products that
 * publish added (docs/apps/Q-Shop+.md → Data contract: the index is the only
 * list of a shop's products).
 *
 * Nothing here changes what is written: the merged index has the original's
 * shape, and only says which products and catalogues it names.
 */
import type { DataContainerDoc } from "../qdn/payloads";

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

/** What an index names (its products and catalogues), as a string two copies can be compared by. */
export function indexKey(index: Pick<DataContainerDoc, "products" | "catalogues">): string {
  return canonical({ products: index.products ?? {}, catalogues: index.catalogues ?? [] });
}

/**
 * The two copies merged so that nothing either one names is lost. The fresh
 * copy (on QDN now) is the base and wins for a product both have; a product
 * or catalogue only the seen copy has is kept (the node may not serve this
 * tab's own latest publish yet, or another device may have published from a
 * stale copy). A product is listed only under the catalogue its entry names.
 */
export function mergeProductIndexes(seen: DataContainerDoc, fresh: DataContainerDoc): DataContainerDoc {
  const products: Record<string, IndexEntry> = structuredClone(fresh.products ?? {});
  for (const [id, entry] of Object.entries(seen.products ?? {})) {
    if (!(id in products)) products[id] = structuredClone(entry);
  }
  const catalogues: CatalogueEntry[] = structuredClone(fresh.catalogues ?? []);
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
 * What this session last published per shop: the index it built on and the
 * one it sent. Right after a publish the node may still serve the index from
 * before it; that is this session's own base, not a change from elsewhere.
 */
const lastPublished = new Map<string, { base: string; sent: string }>();

export function notePublishedIndex(storeId: string, base: string, sent: string): void {
  lastPublished.set(storeId, { base, sent });
}

/** True when `freshKey` is the index this session's last publish replaced and `seenKey` the one it sent. */
export function isOwnPublishNotServedYet(storeId: string, seenKey: string, freshKey: string): boolean {
  const last = lastPublished.get(storeId);
  return !!last && last.sent === seenKey && last.base === freshKey;
}

/** For tests. */
export function resetPublishedIndexes(): void {
  lastPublished.clear();
}
