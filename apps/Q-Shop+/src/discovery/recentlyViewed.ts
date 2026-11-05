/**
 * The products someone opened lately, newest first, so they find them again
 * (the Products page's Recently viewed). On this device only: never
 * published, not in Settings → Sync. At most 12; Clear forgets them.
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
  at: number;
}

const listeners = new Set<() => void>();
let cache: ViewedProduct[] | null = null;

function isViewed(value: unknown): value is ViewedProduct {
  const v = value as Partial<ViewedProduct> | null;
  return !!v && typeof v.owner === "string" && typeof v.storeId === "string" && typeof v.productId === "string" && typeof v.catalogueId === "string" && typeof v.at === "number";
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

/** Puts the product first (once). */
export function rememberViewed(item: Omit<ViewedProduct, "at">, now = Date.now()): void {
  const rest = recentlyViewed().filter((v) => !(v.owner === item.owner && v.productId === item.productId));
  if (recentlyViewed()[0]?.owner === item.owner && recentlyViewed()[0]?.productId === item.productId) return;
  save([{ ...item, at: now }, ...rest].slice(0, MAX_RECENTLY_VIEWED));
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
