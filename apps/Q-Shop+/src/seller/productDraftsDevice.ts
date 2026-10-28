/**
 * Product drafts (Ready to publish) kept on this device per name and shop
 * (seller/deviceDrafts.ts), so "Keep as drafts" holds through a reload or a
 * restart. Saved after each change to the drafts themselves (an edit, a
 * publish, a discard), never by the reset that comes with switching shops
 * (the original drops the other shop's drafts there; they come back with
 * their shop). The seller page restores them when it opens.
 */
import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import type { Middleware } from "@reduxjs/toolkit";
import type { Product } from "../state/features/storeSlice";
import { draftsOfShop } from "./shopDrafts";
import { createDeviceDraftStore, draftKey } from "./deviceDrafts";

export const productDraftStore = createDeviceDraftStore<Record<string, Product>>("products");

interface DraftState {
  auth: { user?: { name?: string } | null };
  global: { currentStore?: { id?: string; owner?: string } | null; productsToSave: Record<string, Product> };
}

const keyOf = (state: DraftState) => draftKey(state.global.currentStore?.owner || state.auth.user?.name, state.global.currentStore?.id);

/** The actions that change the drafts themselves (globalSlice). */
const DRAFT_ACTIONS = new Set(["global/setProductsToSave", "global/removeFromProductsToSave", "global/removeManyFromProductsToSave", "global/clearAllProductsToSave"]);

export const keepProductDrafts: Middleware = (api) => (next) => (action) => {
  const result = next(action);
  if (typeof action === "object" && action && DRAFT_ACTIONS.has((action as { type?: string }).type ?? "")) {
    const state = api.getState() as DraftState;
    const key = keyOf(state);
    const storeId = state.global.currentStore?.id ?? "";
    const mine = draftsOfShop(state.global.productsToSave as Record<string, Product & { storeId?: unknown }>, storeId);
    if (key) productDraftStore.set(key, Object.keys(mine).length > 0 ? mine : null);
  }
  return result;
};

/** On the seller page: the shop's drafts kept on this device come back into Ready to publish. */
export function useRestoreProductDrafts(): void {
  const dispatch = useDispatch();
  const store = useStore<DraftState>();
  const key = useSelector((state: DraftState) => keyOf(state));
  useEffect(() => {
    if (!key) return;
    let alive = true;
    void productDraftStore.load(key).then((saved) => {
      if (!alive || !saved) return;
      const now = store.getState().global.productsToSave;
      for (const draft of Object.values(saved)) if (!now[draft.id]) dispatch({ type: "global/setProductsToSave", payload: draft });
    });
    return () => {
      alive = false;
    };
  }, [key, dispatch, store]);
}
