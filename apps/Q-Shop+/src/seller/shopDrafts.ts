/**
 * Drafts belong to the shop they were made for. `global.productsToSave` is
 * one list for the whole app (as in the original), so a seller with two
 * shops could otherwise publish one shop's drafts into the other's
 * catalogues. Each draft names its shop (`storeId`, set by the original's
 * product objects); a draft without one is matched by its product id,
 * `q-store-product-<shortStoreId>-<uid>` (the uid has no dashes, so
 * `my-shop` doesn't take `my-shop-2`'s drafts).
 */
import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../state/store";
import type { Product } from "../state/features/storeSlice";
import { PRODUCT_BASE, shortStoreIdOf } from "../qdn/identifiers";

export function isDraftOfShop(draft: { id?: string; storeId?: unknown } | null | undefined, storeId: string): boolean {
  if (!draft || !storeId) return false;
  if (typeof draft.storeId === "string" && draft.storeId) return draft.storeId === storeId;
  const prefix = `${PRODUCT_BASE}-${shortStoreIdOf(storeId)}-`;
  const id = draft.id ?? "";
  return id.startsWith(prefix) && id.length > prefix.length && !id.slice(prefix.length).includes("-");
}

export function draftsOfShop<T extends { id?: string; storeId?: unknown }>(all: Record<string, T>, storeId: string): Record<string, T> {
  return Object.fromEntries(Object.entries(all).filter(([, draft]) => isDraftOfShop(draft, storeId)));
}

/** The current shop's drafts. */
export function useShopDrafts(): Record<string, Product> {
  const all = useSelector((state: RootState) => state.global.productsToSave);
  const storeId = useSelector((state: RootState) => state.global.currentStore?.id ?? "");
  return useMemo(() => draftsOfShop(all as Record<string, Product & { storeId?: unknown }>, storeId), [all, storeId]);
}
