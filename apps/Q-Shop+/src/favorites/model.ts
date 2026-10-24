/**
 * Favourite shops and products (Simon, 2026-10-23: "add to favourites … a
 * new icon … with the favorite shops or products … sort by buyers
 * favorites"). A favourite is public, so shops can be sorted by how many
 * buyers keep them, the way Qortal apps count likes: one small DOCUMENT per
 * favourite, under the buyer's name (additive; the original never reads it):
 *
 *   shop:    q-store-favs-<shortStoreId>
 *   product: q-store-favp-<shortStoreId>-<productUid>   (the product id with
 *            q-store-product → q-store-favp)
 *   JSON {v: 1, kind, storeId, owner, productId?, catalogueId?, created},
 *   filename "favorite.json", metadata title "Favourite shop" / "Favourite
 *   product", description "fav:<owner>" (URI-encoded; a product's adds
 *   ";cat:<catalogueId>"), so a search row says everything: nothing is
 *   fetched to list or count them.
 *
 * Removing one republishes it as a tombstone titled "deleted" (qdn/
 * payloads.ts deletes), which the searches leave out.
 *
 * Counted (counts): one per name per shop or product, for the owner the
 * favourite names (two names can have shops with the same id), the owner's
 * own left out.
 */
import { PRODUCT_BASE, STORE_BASE } from "../qdn/identifiers";
import { jsonToBase64 } from "../qdn/payloads";
import { DELETED_TITLE, isDeletedRow } from "../qdn/deleted";
import type { QdnResourceSummary } from "../qdn/search";

export const FAV_BASE = "q-store-fav";
export const FAV_SHOP_BASE = `${FAV_BASE}s`;
export const FAV_PRODUCT_BASE = `${FAV_BASE}p`;

export interface FavoriteShop {
  kind: "shop";
  identifier: string;
  owner: string;
  storeId: string;
  shortStoreId: string;
}

export interface FavoriteProduct {
  kind: "product";
  identifier: string;
  owner: string;
  storeId: string;
  shortStoreId: string;
  productId: string;
  catalogueId: string;
}

export type Favorite = FavoriteShop | FavoriteProduct;

const shortOfStoreId = (storeId: string) => (storeId.startsWith(`${STORE_BASE}-`) ? storeId.slice(STORE_BASE.length + 1) : "");
const shortOfProductId = (productId: string, shortStoreId: string) =>
  productId.startsWith(`${PRODUCT_BASE}-${shortStoreId}-`) ? shortStoreId : "";

export function favShopIdentifier(shortStoreId: string): string {
  return `${FAV_SHOP_BASE}-${shortStoreId}`;
}

/** The product's favourite id, or null for an id not in the app's shape. */
export function favProductIdentifier(productId: string): string | null {
  return productId.startsWith(`${PRODUCT_BASE}-`) ? `${FAV_PRODUCT_BASE}-${productId.slice(PRODUCT_BASE.length + 1)}` : null;
}

export function favoriteShop(owner: string, storeId: string): FavoriteShop | null {
  const shortStoreId = shortOfStoreId(storeId);
  if (!owner || !shortStoreId) return null;
  return { kind: "shop", identifier: favShopIdentifier(shortStoreId), owner, storeId, shortStoreId };
}

export function favoriteProduct(owner: string, storeId: string, productId: string, catalogueId: string): FavoriteProduct | null {
  const shortStoreId = shortOfStoreId(storeId);
  const identifier = favProductIdentifier(productId);
  if (!owner || !shortStoreId || !identifier || !catalogueId || !shortOfProductId(productId, shortStoreId)) return null;
  return { kind: "product", identifier, owner, storeId, shortStoreId, productId, catalogueId };
}

/** The search row's description: who the favourite is for (and a product's catalogue). */
export function favoriteDescription(fav: Favorite): string {
  const owner = `fav:${encodeURIComponent(fav.owner)}`;
  return fav.kind === "product" ? `${owner};cat:${encodeURIComponent(fav.catalogueId)}` : owner;
}

const DESCRIPTION = /^fav:([^;]{1,200})(?:;cat:([^;]{1,200}))?$/;

const decode = (text: string) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return "";
  }
};

/** A favourite from its search row (with metadata), or null: not one, removed, or malformed. */
export function favoriteOfRow(row: QdnResourceSummary): Favorite | null {
  if (!row?.identifier || row.service !== "DOCUMENT" || isDeletedRow(row)) return null;
  const match = DESCRIPTION.exec(String(row.metadata?.description ?? ""));
  if (!match) return null;
  const owner = decode(match[1]);
  if (!owner) return null;
  if (row.identifier.startsWith(`${FAV_SHOP_BASE}-`)) {
    const shortStoreId = row.identifier.slice(FAV_SHOP_BASE.length + 1);
    return shortStoreId && !match[2] ? favoriteShop(owner, `${STORE_BASE}-${shortStoreId}`) : null;
  }
  if (row.identifier.startsWith(`${FAV_PRODUCT_BASE}-`) && match[2]) {
    const productId = `${PRODUCT_BASE}-${row.identifier.slice(FAV_PRODUCT_BASE.length + 1)}`;
    const catalogueId = decode(match[2]);
    // The product id holds the short shop id, which may hold dashes: the catalogue's names it whole.
    const short = /^q-store-catalogue-(.+)-[A-Za-z0-9_]+$/.exec(catalogueId)?.[1];
    if (!short) return null;
    return favoriteProduct(owner, `${STORE_BASE}-${short}`, productId, catalogueId);
  }
  return null;
}

export type FavoritePublishRequest = {
  action: "PUBLISH_QDN_RESOURCE";
  name: string;
  service: "DOCUMENT";
  identifier: string;
  filename: string;
  data64: string;
  title: string;
  description: string;
  tags?: string[];
};

export function buildFavoritePublish(args: { name: string; fav: Favorite; now: number }): FavoritePublishRequest {
  const { fav } = args;
  const body = {
    v: 1,
    kind: fav.kind,
    storeId: fav.storeId,
    owner: fav.owner,
    ...(fav.kind === "product" && { productId: fav.productId, catalogueId: fav.catalogueId }),
    created: args.now,
  };
  return {
    action: "PUBLISH_QDN_RESOURCE",
    name: args.name,
    service: "DOCUMENT",
    identifier: fav.identifier,
    filename: "favorite.json",
    data64: jsonToBase64(body),
    title: fav.kind === "shop" ? "Favourite shop" : "Favourite product",
    description: favoriteDescription(fav),
  };
}

/** Removing a favourite: its tombstone, titled and tagged "deleted" as every Q-Shop+ delete. */
export function buildUnfavoritePublish(args: { name: string; identifier: string }): FavoritePublishRequest {
  return {
    action: "PUBLISH_QDN_RESOURCE",
    name: args.name,
    service: "DOCUMENT",
    identifier: args.identifier,
    filename: "favorite.json",
    data64: jsonToBase64({ deleted: true }),
    title: DELETED_TITLE,
    description: DELETED_TITLE,
    tags: [DELETED_TITLE],
  };
}

export interface FavoriteCounts {
  shop: (owner: string, shortStoreId: string) => number;
  product: (owner: string, productId: string) => number;
  /** False when there were more favourites than were read. */
  complete: boolean;
}

/** How many names keep each shop and product, from every favourite's search row. */
export function buildFavoriteCounts(rows: QdnResourceSummary[], complete = true): FavoriteCounts {
  const shops = new Map<string, Set<string>>();
  const products = new Map<string, Set<string>>();
  for (const row of rows) {
    const fav = row?.name ? favoriteOfRow(row) : null;
    if (!fav || row.name === fav.owner) continue;
    const map = fav.kind === "shop" ? shops : products;
    const key = `${fav.owner}\n${fav.kind === "shop" ? fav.shortStoreId : fav.productId}`;
    const names = map.get(key) ?? new Set<string>();
    names.add(row.name);
    map.set(key, names);
  }
  return {
    complete,
    shop: (owner, shortStoreId) => shops.get(`${owner}\n${shortStoreId}`)?.size ?? 0,
    product: (owner, productId) => products.get(`${owner}\n${productId}`)?.size ?? 0,
  };
}
