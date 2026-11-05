/**
 * The collections the seller closed in the Products tab (Simon, 2026-10-25:
 * "collapse the view in products for different collections so it is easier
 * to navigate"): kept on this device per shop, so a long shop opens as it
 * was left. A convenience only: nothing is published.
 */
import { useCallback, useMemo, useState } from "react";

const KEY = "qshopplus-collapsed-sections";
/** Shops remembered, most recent last. */
const MAX_SHOPS = 50;

/** The key of the products in no collection. */
export const REST_SECTION = "\nrest";

function readAll(): Record<string, string[]> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function readShop(storeId: string): Set<string> {
  const keys = readAll()[storeId];
  return new Set(Array.isArray(keys) ? keys.filter((k) => typeof k === "string") : []);
}

function writeShop(storeId: string, keys: ReadonlySet<string>): void {
  try {
    const all = readAll();
    delete all[storeId];
    if (keys.size > 0) all[storeId] = [...keys];
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(all).slice(-MAX_SHOPS))));
  } catch {
    // No storage (a private window): closed collections last for this visit.
  }
}

export function useCollapsedSections(storeId: string): [ReadonlySet<string>, (next: ReadonlySet<string>) => void] {
  const [state, setState] = useState(() => ({ storeId, keys: readShop(storeId) as ReadonlySet<string> }));
  const keys = useMemo(() => (state.storeId === storeId ? state.keys : readShop(storeId)), [state, storeId]);
  const set = useCallback(
    (next: ReadonlySet<string>) => {
      setState({ storeId, keys: new Set(next) });
      if (storeId) writeShop(storeId, next);
    },
    [storeId]
  );
  return [keys, set];
}
