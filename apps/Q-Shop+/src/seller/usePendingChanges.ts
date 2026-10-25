/**
 * What the seller has changed and not published (Simon, 2026-10-25: "if user
 * makes any edits and changes in products, collections, deliveries and so
 * on … the Publish Changes button … always visible"): product drafts,
 * collections, delivery prices and discount codes, each kept on this device
 * (seller/deviceDrafts.ts) and each with its way to be discarded. Read by the
 * seller page's Publish changes bar (seller/PublishBar.tsx).
 */
import { useEffect, useEffectEvent, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { removeManyFromProductsToSave } from "../state/features/globalSlice";
import { useShopDrafts } from "./shopDrafts";
import { collectionDrafts, collectionsDraftKey } from "./useCollections";
import { deliveryDrafts, discountDrafts } from "./sellerDrafts";
import { draftKey } from "./deviceDrafts";
import { productDraftStore } from "./productDraftsDevice";

export type ChangeArea = "products" | "collections" | "delivery" | "discounts";

export interface PendingChange {
  area: ChangeArea;
  label: string;
  discard: () => void;
}

export function usePendingChanges(): PendingChange[] {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const store = useSelector((state: RootState) => state.global.currentStore);
  const owner = store?.owner || user?.name || "";
  const storeId = store?.id ?? "";
  const key = draftKey(owner, storeId);
  // Collections key their working copy by the signed-in name and their document (seller/useCollections.ts).
  const collectionsKey = collectionsDraftKey(user?.name, storeId);
  const products = useShopDrafts();
  const collections = collectionDrafts.useDraft(collectionsKey);
  const delivery = deliveryDrafts.useDraft(key);
  const discounts = discountDrafts.useDraft(key);
  const count = Object.keys(products).length;
  const out: PendingChange[] = [];
  if (count > 0) {
    out.push({
      area: "products",
      label: count === 1 ? "1 product" : `${count} products`,
      discard: () => {
        dispatch(removeManyFromProductsToSave(Object.keys(products)));
        productDraftStore.set(key, null);
      },
    });
  }
  if (collections) out.push({ area: "collections", label: "Collections", discard: () => collectionDrafts.set(collectionsKey, null) });
  if (delivery) out.push({ area: "delivery", label: "Delivery prices", discard: () => deliveryDrafts.set(key, null) });
  if (discounts) out.push({ area: "discounts", label: "Discount codes", discard: () => discountDrafts.set(key, null) });
  return out;
}

/** Flows that leave on purpose (a deleted shop) go without the leaving question (seller/PublishBar.tsx). */
let leavingOnPurpose = false;
export function leaveWithoutAsking(): void {
  leavingOnPurpose = true;
}
/** True once after leaveWithoutAsking. */
export function takeLeaveWithoutAsking(): boolean {
  const was = leavingOnPurpose;
  leavingOnPurpose = false;
  return was;
}

/** A deleted shop's drafts go from this device: its id may be used again. */
export function forgetShopDrafts(name: string, owner: string, storeId: string): void {
  const key = draftKey(owner, storeId);
  productDraftStore.set(key, null);
  deliveryDrafts.set(key, null);
  discountDrafts.set(key, null);
  collectionDrafts.set(collectionsDraftKey(name, storeId), null);
}

/** The bar's Publish waiting for a tab: a new `id` each press, and `done` to take it (once). */
export interface PublishAsk {
  id: number;
  done: () => void;
}

/**
 * A tab's answer to the bar's Publish: `run` starts the tab's own publish
 * once the tab has what it needs (`ready`), once per press. The press is
 * taken (`done`) as it runs, so opening the tab again later doesn't publish
 * again (Simon, from Hub: the collections publish was "asked too many times").
 */
export function usePublishAsk(ask: PublishAsk | null | undefined, ready: boolean, run: () => void): void {
  const handled = useRef(0);
  const go = useEffectEvent(run);
  const take = useEffectEvent(() => ask?.done());
  const id = ask?.id ?? 0;
  useEffect(() => {
    if (id > handled.current && ready) {
      handled.current = id;
      take();
      go();
    }
  }, [id, ready]);
}
