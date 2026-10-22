/**
 * "New products" on the home page: the products in the four newest
 * catalogues (DOCUMENT `q-store-catalogue-<shortStoreId>-<uid>`, up to ten
 * products each, images inside; docs/apps/Q-Shop+.md → Data contract). Read
 * only when the strip scrolls into view: one search of 4 rows, then each
 * catalogue with FETCH_QDN_RESOURCE, as the original's fetchCatalogues does.
 *
 * Trust (docs/QORTAL.md → pitfall 15): another name can publish a catalogue
 * under any identifier, so a product is shown only for a shop that is in the
 * shop index under the same name that published the catalogue, and it links
 * to that name's shop. Nothing here goes into the app's catalogue cache,
 * which the cart reads prices from.
 */
import { CATALOGUE_BASE, storeIdentifier } from "../qdn/identifiers";
import { mapWithConcurrency, QDN_SEARCH_TTL_MS, searchQdn, type QdnResourceSummary } from "../qdn/search";
import { checkStructure } from "../utils/checkStructure";
import { HIDDEN_TEST_SHOP_OWNER } from "./shopIndex";

export const NEW_CATALOGUES = 4;
export const NEW_PRODUCTS_MAX = 12;

const PREFIX = `${CATALOGUE_BASE}-`;

/** A product as a catalogue holds it (the fields the strip reads). */
export interface CatalogueProduct {
  id: string;
  title: string;
  description?: string;
  created: number;
  type?: string;
  images: string[];
  mainImageIndex?: number;
  price: { currency: string; value: number }[];
  status?: string;
}

export interface NewProduct {
  /** Owner, catalogue and product: unique. */
  key: string;
  owner: string;
  storeId: string;
  catalogueId: string;
  product: CatalogueProduct;
  /** The product's main image, a data URL. */
  image: string;
}

/** The short shop id inside `q-store-catalogue-<shortStoreId>-<uid>` (the uid has no dashes), or null. */
export function shortStoreIdOfCatalogue(identifier: string): string | null {
  if (!identifier.startsWith(PREFIX)) return null;
  const parts = identifier.slice(PREFIX.length).split("-");
  if (parts.length < 2) return null;
  return parts.slice(0, -1).join("-") || null;
}

function mainImage(product: CatalogueProduct): string | null {
  const images = Array.isArray(product.images) ? product.images : [];
  const index = Number.isInteger(product.mainImageIndex) ? (product.mainImageIndex as number) : 0;
  const image = images[index] ?? images[0];
  return typeof image === "string" && image.startsWith("data:image/") ? image : null;
}

/**
 * The products worth showing from fetched catalogues, newest first: valid
 * products (the original's check), not retired, with an image, from listed
 * shops only.
 */
export function newProductsFrom(
  catalogues: { row: QdnResourceSummary; json: unknown }[],
  isListedShop: (owner: string, storeId: string) => boolean
): NewProduct[] {
  const items: NewProduct[] = [];
  for (const { row, json } of catalogues) {
    const short = shortStoreIdOfCatalogue(row.identifier);
    if (!short || row.name === HIDDEN_TEST_SHOP_OWNER) continue;
    const storeId = storeIdentifier(short);
    if (!isListedShop(row.name, storeId)) continue;
    const products = (json as { products?: Record<string, CatalogueProduct> } | null)?.products;
    if (!products || typeof products !== "object") continue;
    for (const [productId, product] of Object.entries(products)) {
      if (!product || typeof product !== "object" || !checkStructure(product)) continue;
      if (product.status === "RETIRED") continue;
      const image = mainImage(product);
      if (!image) continue;
      items.push({
        key: `${row.name}\u0000${row.identifier}\u0000${productId}`,
        owner: row.name,
        storeId,
        catalogueId: row.identifier,
        product: { ...product, id: productId },
        image,
      });
    }
  }
  return items.sort((a, b) => b.product.created - a.product.created).slice(0, NEW_PRODUCTS_MAX);
}

const catalogueCache = new Map<string, { value: unknown; expires: number }>();

/** A catalogue's JSON through Hub (FETCH_QDN_RESOURCE), kept for the session TTL by name and identifier. */
async function fetchCatalogue(name: string, identifier: string, fresh: boolean): Promise<unknown> {
  const key = `${name}\u0000${identifier}`;
  const hit = catalogueCache.get(key);
  if (!fresh && hit && hit.expires > Date.now()) return hit.value;
  let value: unknown = await qortalRequest({ action: "FETCH_QDN_RESOURCE", name, service: "DOCUMENT", identifier });
  if (typeof value === "string") value = JSON.parse(value);
  catalogueCache.set(key, { value, expires: Date.now() + QDN_SEARCH_TTL_MS });
  return value;
}

/** The newest products, or [] when there are none. Rejects only when the search itself fails. */
export async function loadNewProducts(
  isListedShop: (owner: string, storeId: string) => boolean,
  options: { fresh?: boolean } = {}
): Promise<NewProduct[]> {
  const rows = await searchQdn(
    { service: "DOCUMENT", identifier: PREFIX, prefix: true, reverse: true, limit: NEW_CATALOGUES, excludeblocked: true },
    { fresh: options.fresh }
  );
  const wanted = rows.filter((row) => {
    const short = shortStoreIdOfCatalogue(row.identifier ?? "");
    return short && row.name && isListedShop(row.name, storeIdentifier(short));
  });
  const catalogues = await mapWithConcurrency(wanted, NEW_CATALOGUES, async (row) => {
    try {
      return { row, json: await fetchCatalogue(row.name, row.identifier, Boolean(options.fresh)) };
    } catch {
      // Not on the node yet, or not JSON: its products just don't show.
      return null;
    }
  });
  return newProductsFrom(
    catalogues.filter((c): c is { row: QdnResourceSummary; json: unknown } => c !== null),
    isListedShop
  );
}

/** For tests. */
export function resetNewProductsCache(): void {
  catalogueCache.clear();
}
