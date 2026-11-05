/**
 * Shop collections (round 5, Simon): the seller groups the shop's products
 * into collections, each with a title, a description and a picture. New
 * data, additive only (CLAUDE.md rule 1); the original Q-Shop never reads or
 * writes any of it:
 * - DOCUMENT `q-store-collections-<shortStoreId>` under the seller's name,
 *   `filename: "collections.json"`:
 *   `{ storeId, collections: [{ id, title, description, image?, products: [productId…], created, updated }] }`,
 *   in the order the seller set; `image` is a WebP data URL, as logos and
 *   product pictures are;
 * - the product index (`<storeId>-datacontainer`) gains `collectionsId`, that
 *   document's identifier, so a shop page reads the document only for a shop
 *   that has one. Both apps' product publishes keep the index's other fields
 *   (they spread it), so the pointer stays; "Recreate shop data" drops it,
 *   and the next save of the collections puts it back.
 * Membership is by product id: a product can be in several collections, and
 * a deleted product just stops showing (the next save leaves it out).
 */
import { collectionsIdentifier, dataContainerIdentifier, shortStoreIdOf } from "./identifiers";
import { jsonToBase64, type DataContainerDoc, type PublishResource } from "./payloads";

export const MAX_COLLECTIONS = 24;
export const MAX_COLLECTION_TITLE = 60;
export const MAX_COLLECTION_DESCRIPTION = 500;
/** Collection pictures show as cards, so they are kept smaller than product pictures (1200 px). */
export const COLLECTION_IMAGE_MAX_WIDTH = 640;

export interface ShopCollection {
  /** Unique within the shop (a ShortUniqueId); also the `?collection=` of its link. */
  id: string;
  title: string;
  description: string;
  /** A WebP data URL, or none. */
  image?: string;
  /** Product ids, in the order the seller picked them. */
  products: string[];
  created: number;
  updated: number;
}

export interface CollectionsDoc {
  storeId: string;
  collections: ShopCollection[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const time = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

/**
 * A collections document as the app can show it. Any name can publish JSON
 * under the identifier, so every field is checked: an entry needs an id and
 * a title; text is trimmed to its limit, a picture must be an image data URL
 * (nothing outside Qortal is ever loaded), product ids are text, once each;
 * at most MAX_COLLECTIONS, ids once each.
 */
export function normalizeCollections(json: unknown): ShopCollection[] {
  const list = isRecord(json) && Array.isArray(json.collections) ? json.collections : [];
  const seen = new Set<string>();
  const out: ShopCollection[] = [];
  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id = text(entry.id, 40);
    const title = text(entry.title, MAX_COLLECTION_TITLE);
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const image = typeof entry.image === "string" && entry.image.startsWith("data:image/") ? entry.image : undefined;
    const products = Array.isArray(entry.products)
      ? [...new Set(entry.products.filter((p): p is string => typeof p === "string" && p.length > 0))]
      : [];
    out.push({
      id,
      title,
      description: text(entry.description, MAX_COLLECTION_DESCRIPTION),
      ...(image && { image }),
      products,
      created: time(entry.created),
      updated: time(entry.updated),
    });
    if (out.length >= MAX_COLLECTIONS) break;
  }
  return out;
}

/** The collections document's identifier when the product index points at this shop's, else null. */
export function collectionsPointer(index: object | null | undefined, storeId: string): string | null {
  const expected = collectionsIdentifier(shortStoreIdOf(storeId));
  return (index as { collectionsId?: unknown } | null | undefined)?.collectionsId === expected ? expected : null;
}

/** Each collection with only the products the shop still lists, in their order. */
export function pruneCollections(collections: ShopCollection[], listed: (productId: string) => boolean): ShopCollection[] {
  return collections.map((c) => ({ ...c, products: c.products.filter(listed) }));
}

/**
 * Save the collections: the document, and (when the index doesn't point at
 * it yet, `dataContainer` given) the product index with `collectionsId`
 * added, its original shape otherwise unchanged. The document goes first: an
 * index pointing at a document that didn't land would only show no
 * collections, never someone else's.
 */
export function buildCollectionsPublish(args: {
  name: string;
  storeId: string;
  collections: ShopCollection[];
  /** The product index to point at the document, when it doesn't yet. */
  dataContainer?: DataContainerDoc | null;
}) {
  const { name, storeId } = args;
  const identifier = collectionsIdentifier(shortStoreIdOf(storeId));
  const doc: CollectionsDoc = {
    storeId,
    collections: args.collections.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      ...(c.image && { image: c.image }),
      products: c.products,
      created: c.created,
      updated: c.updated,
    })),
  };
  const resources: PublishResource[] = [
    { name, service: "DOCUMENT", identifier, filename: "collections.json", data64: jsonToBase64(doc) },
  ];
  let dataContainer: DataContainerDoc | null = null;
  if (args.dataContainer && args.dataContainer.collectionsId !== identifier) {
    dataContainer = { ...args.dataContainer, collectionsId: identifier };
    resources.push({
      name,
      service: "DOCUMENT",
      identifier: dataContainer.id || dataContainerIdentifier(storeId),
      filename: "datacontainer.json",
      data64: jsonToBase64(dataContainer),
    });
  }
  return { identifier, doc, dataContainer, resources };
}
