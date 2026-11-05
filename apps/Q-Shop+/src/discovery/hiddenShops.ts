/**
 * Shops hidden from the lists (Simon, 2026-10-23: "hide shop"): left out of
 * Shops and Products on this device. A shop's page still opens from a link,
 * and says so; Settings lists them to show again. Kept in this browser only
 * (nothing is published), per Q-Shop+ install.
 */
import { useSyncExternalStore } from "react";
import { HIDDEN_SHOPS_STORAGE_KEY } from "../constants/plus";

export interface HiddenShop {
  owner: string;
  shortStoreId: string;
  /** For the Settings list. */
  title: string;
  at: number;
}

const keyOf = (owner: string, shortStoreId: string) => `${owner}\n${shortStoreId}`;

function read(): HiddenShop[] {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_SHOPS_STORAGE_KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((s): s is HiddenShop => !!s && typeof s.owner === "string" && typeof s.shortStoreId === "string" && !!s.owner && !!s.shortStoreId)
      : [];
  } catch {
    return [];
  }
}

let list: HiddenShop[] | null = null;
let keys: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function current(): HiddenShop[] {
  if (!list) {
    list = read();
    keys = new Set(list.map((s) => keyOf(s.owner, s.shortStoreId)));
  }
  return list;
}

function save(next: HiddenShop[]): void {
  list = next;
  keys = new Set(next.map((s) => keyOf(s.owner, s.shortStoreId)));
  try {
    if (next.length > 0) localStorage.setItem(HIDDEN_SHOPS_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(HIDDEN_SHOPS_STORAGE_KEY);
  } catch {
    /* private mode: hidden in this tab */
  }
  for (const listener of listeners) listener();
}

export function isShopHidden(owner: string, shortStoreId: string): boolean {
  current();
  return keys.has(keyOf(owner, shortStoreId));
}

export function hideShop(shop: { owner: string; shortStoreId: string; title?: string }, now = Date.now()): void {
  if (isShopHidden(shop.owner, shop.shortStoreId)) return;
  save([...current(), { owner: shop.owner, shortStoreId: shop.shortStoreId, title: shop.title ?? "", at: now }]);
}

export function showShop(owner: string, shortStoreId: string): void {
  save(current().filter((s) => keyOf(s.owner, s.shortStoreId) !== keyOf(owner, shortStoreId)));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The hidden shops, newest last, and a check by owner and short shop id. */
export function useHiddenShops(): { list: HiddenShop[]; isHidden: (owner: string, shortStoreId: string) => boolean } {
  const shops = useSyncExternalStore(subscribe, current, current);
  return { list: shops, isHidden: (owner, shortStoreId) => keys.has(keyOf(owner, shortStoreId)) };
}

/** For tests. */
export function resetHiddenShopsMemory(): void {
  list = null;
  keys = new Set();
}
