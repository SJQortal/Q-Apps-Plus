/**
 * How a shop page shows its products (round 5, Simon): "grid" (tiles),
 * "list" (rows), or "auto", the app's own choice: tiles on wider screens,
 * rows on phones. Kept with the other settings (qshopplus-settings), saved
 * by Settings → Sync, and shared by every shop page through one small store.
 */
import { useSyncExternalStore } from "react";
import { readStoredSettings, writeStoredSettings } from "./settingsStorage";

export const PRODUCT_VIEWS = ["auto", "grid", "list"] as const;
export type ProductView = (typeof PRODUCT_VIEWS)[number];

export function isProductView(value: unknown): value is ProductView {
  return typeof value === "string" && (PRODUCT_VIEWS as readonly string[]).includes(value);
}

let current: ProductView | null = null;
const listeners = new Set<() => void>();

export function getProductView(): ProductView {
  if (current === null) {
    const stored = readStoredSettings().productView;
    current = isProductView(stored) ? stored : "auto";
  }
  return current;
}

export function setProductView(view: ProductView): void {
  current = view;
  writeStoredSettings({ productView: view });
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The chosen view, re-rendering when it changes. */
export function useProductView(): ProductView {
  return useSyncExternalStore(subscribe, getProductView);
}

/** The layout a view gives: "auto" is rows on phones, tiles elsewhere. */
export function productLayout(view: ProductView, phone: boolean): "tile" | "row" {
  if (view === "grid") return "tile";
  if (view === "list") return "row";
  return phone ? "row" : "tile";
}

/** For tests. */
export function resetProductView(): void {
  current = null;
}
