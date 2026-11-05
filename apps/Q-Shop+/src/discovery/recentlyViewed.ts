/**
 * The products someone opened lately, newest first, so they find them again
 * (the Products page's Recently viewed). On this device only: never
 * published, not in Settings → Sync. At most 12; Clear forgets them. A
 * product in variants is there once, as the item seen last (Simon,
 * 2026-10-29: "if recently viewed was the same product, do not repeat it").
 */
import { useSyncExternalStore } from "react";
import { STORAGE_PREFIX } from "../constants/plus";

export const RECENTLY_VIEWED_KEY = `${STORAGE_PREFIX}recently-viewed`;
export const MAX_RECENTLY_VIEWED = 12;

export interface ViewedProduct {
  owner: string;
  storeId: string;
  productId: string;
  catalogueId: string;
  /** Its variant group (variants/model.ts), when it is an item of a product in variants. */
  group?: string;
  at: number;
}

const listeners = new Set<() => void>();
let cache: ViewedProduct[] | null = null;

function isViewed(value: unknown): value is ViewedProduct {
  const v = value as Partial<ViewedProduct> | null;
  return (
    !!v &&
    typeof v.owner === "string" &&
    typeof v.storeId === "string" &&
    typeof v.productId === "string" &&
    typeof v.catalogueId === "string" &&
    typeof v.at === "number" &&
    (v.group === undefined || typeof v.group === "string")
  );
}

export function recentlyViewed(): ViewedProduct[] {
  if (cache) return cache;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) ?? "[]");
    cache = Array.isArray(raw) ? raw.filter(isViewed).slice(0, MAX_RECENTLY_VIEWED) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(list: ViewedProduct[]): void {
  cache = list;
  try {
    if (list.length === 0) localStorage.removeItem(RECENTLY_VIEWED_KEY);
    else localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked: kept for this visit.
  }
  for (const listener of [...listeners]) listener();
}

/** The same product: the same item, or another item of the same product in variants. */
export function sameViewedProduct(a: Pick<ViewedProduct, "owner" | "productId" | "group">, b: Pick<ViewedProduct, "owner" | "productId" | "group">): boolean {
  return a.owner === b.owner && (a.productId === b.productId || (!!a.group && a.group === b.group));
}

/** Puts the product first (once, a product in variants as the item seen last). */
export function rememberViewed(item: Omit<ViewedProduct, "at">, now = Date.now()): void {
  const first = recentlyViewed()[0];
  if (first && first.owner === item.owner && first.productId === item.productId && first.group === item.group) return;
  const rest = recentlyViewed().filter((v) => !sameViewedProduct(v, item));
  const entry: ViewedProduct = { ...item, at: now };
  if (!item.group) delete entry.group;
  save([entry, ...rest].slice(0, MAX_RECENTLY_VIEWED));
}

export function clearRecentlyViewed(): void {
  save([]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRecentlyViewed(): ViewedProduct[] {
  return useSyncExternalStore(subscribe, recentlyViewed);
}

/** For tests. */
export function resetRecentlyViewed(): void {
  cache = null;
}
