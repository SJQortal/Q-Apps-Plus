/**
 * The shops of all the account's names, for the account menu's My shops
 * (hooks/useOwnShops.ts findShopsOfNames): read when the menu opens, from
 * the session's search cache after the first time. Null while loading or
 * when the account has one name (useOwnShops already has that name's shops).
 */
import { useEffect, useState } from "react";
import type { Store } from "../state/features/storeSlice";
import { findShopsOfNames } from "./useOwnShops";

export function useShopsOfNames(names: string[]): Store[] | null {
  const key = names.length > 1 ? [...names].sort().join("\n") : "";
  const [result, setResult] = useState<{ key: string; shops: Store[] } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    findShopsOfNames(key.split("\n")).then(
      (shops) => alive && setResult({ key, shops }),
      () => alive && setResult({ key, shops: [] })
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return result?.key === key ? result.shops : null;
}
