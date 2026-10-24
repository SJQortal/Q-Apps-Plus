/**
 * The Overview's recent activity (Simon, 2026-10-24: "I want the overview to
 * be a place where all kinds of recent actions show up, for example if
 * someone gave a review or liked your shop or product"): new orders, buyers
 * marking an order delivered, reviews and favourites, newest first.
 *
 * Orders, their Delivered and the reviews come from what the seller page
 * reads anyway (the orders' first page, the Reviews tab's search). The
 * favourites take two small searches of their own (favorites/model.ts): the
 * shop's `q-store-favs-<shortStoreId>` and its products'
 * `q-store-favp-<shortStoreId>-`, 20 rows each, newest first, with metadata
 * so nothing is fetched. The prefix also matches longer shop ids, so the
 * shop and the owner a favourite names are compared exactly; the owner's
 * own favourites and removed ones (tombstones) are left out.
 */
import { useEffect, useState } from "react";
import { FAV_PRODUCT_BASE, favShopIdentifier, favoriteOfRow } from "../favorites/model";
import { searchQdn } from "../qdn/search";
import { sameName } from "../orders/reads";
import type { OrderListItem } from "../orders/selectors";
import type { ShopReview } from "../pages/Store/reviewsData";

export const FAVORITE_ACTIVITY_LIMIT = 20;

export interface ShopFavorite {
  /** Who keeps it. */
  name: string;
  at: number;
  kind: "shop" | "product";
  productId?: string;
  catalogueId?: string;
}

export type ActivityItem =
  | { key: string; kind: "order" | "delivered"; at: number; name: string; item: OrderListItem }
  | { key: string; kind: "review"; at: number; name: string; review: ShopReview }
  | { key: string; kind: "favorite"; at: number; name: string; favorite: ShopFavorite };

/** The latest favourites of the shop and its products, by other names. */
export async function fetchShopFavorites(owner: string, shortStoreId: string, options: { fresh?: boolean } = {}): Promise<ShopFavorite[]> {
  if (!owner || !shortStoreId) return [];
  const search = (identifier: string) =>
    searchQdn({ service: "DOCUMENT", identifier, prefix: true, includemetadata: true, reverse: true, limit: FAVORITE_ACTIVITY_LIMIT }, options);
  const [shop, products] = await Promise.all([search(favShopIdentifier(shortStoreId)), search(`${FAV_PRODUCT_BASE}-${shortStoreId}-`)]);
  const out: ShopFavorite[] = [];
  for (const row of [...shop, ...products]) {
    const fav = favoriteOfRow(row);
    if (!fav || fav.shortStoreId !== shortStoreId || !sameName(fav.owner, owner) || !row.name || sameName(row.name, owner)) continue;
    const at = Math.max(row.created ?? 0, row.updated ?? 0);
    out.push(fav.kind === "shop" ? { name: row.name, at, kind: "shop" } : { name: row.name, at, kind: "product", productId: fav.productId, catalogueId: fav.catalogueId });
  }
  return out;
}

export function useShopFavorites(owner: string, shortStoreId: string): { status: "loading" | "ready" | "error"; favorites: ShopFavorite[] } {
  const key = `${owner}\n${shortStoreId}`;
  const [result, setResult] = useState<{ key: string; status: "ready" | "error"; favorites: ShopFavorite[] } | null>(null);
  useEffect(() => {
    if (!owner || !shortStoreId) return;
    let alive = true;
    fetchShopFavorites(owner, shortStoreId).then(
      (favorites) => alive && setResult({ key, status: "ready", favorites }),
      () => alive && setResult({ key, status: "error", favorites: [] })
    );
    return () => {
      alive = false;
    };
  }, [key, owner, shortStoreId]);
  const current = result?.key === key ? result : null;
  return { status: !owner || !shortStoreId ? "ready" : (current?.status ?? "loading"), favorites: current?.favorites ?? [] };
}

/** Everything, newest first. Orders count from when they were placed; Delivered from when the buyer said so. */
export function buildActivity(args: { orders: OrderListItem[]; reviews: ShopReview[]; favorites: ShopFavorite[] }): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const item of args.orders) {
    if (item.row.created) out.push({ key: `order\n${item.row.id}`, kind: "order", at: item.row.created, name: item.row.user, item });
    if (item.delivered?.at && !item.delivered.sending) {
      out.push({ key: `delivered\n${item.row.id}`, kind: "delivered", at: item.delivered.at, name: item.row.user, item });
    }
  }
  for (const review of args.reviews) {
    out.push({ key: `review\n${review.name}\n${review.id}`, kind: "review", at: Math.max(review.created ?? 0, review.updated ?? 0), name: review.name, review });
  }
  for (const favorite of args.favorites) {
    out.push({ key: `favorite\n${favorite.name}\n${favorite.productId ?? "shop"}`, kind: "favorite", at: favorite.at, name: favorite.name, favorite });
  }
  return out.sort((a, b) => b.at - a.at);
}
