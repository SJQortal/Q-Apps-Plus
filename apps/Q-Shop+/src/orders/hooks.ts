import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "../state/store";
import type { Order, OrderListMeta } from "../state/features/orderSlice";
import { shortStoreIdOf } from "../qdn/identifiers";
import { listPendingOrders, subscribePendingOrders } from "../money/pendingOrders";
import { loadOrders, ownerKey, retryOrder, type ListOwner, type OrderStore } from "./loader";
import { selectItems, type OrderListItem } from "./selectors";

export interface OrderList {
  items: OrderListItem[];
  meta: OrderListMeta;
  loadMore: () => Promise<boolean>;
  refresh: () => Promise<boolean>;
  retry: (row: Order) => Promise<boolean>;
}

const IDLE: OrderListMeta = {
  owner: "",
  offset: 0,
  hasMore: false,
  phase: "idle",
  loadingMore: false,
  refreshing: false,
  moreError: false,
  generation: 0,
};

const NO_ITEMS: OrderListItem[] = [];

/** An order list for `owner` (null: signed out, or no shop): page one on mount, then on demand. */
function useOrderList(owner: ListOwner | null): OrderList {
  const store: OrderStore = useStore<RootState>();
  const kind = owner?.kind ?? "buyer";
  const key = owner ? ownerKey(owner) : "";
  const meta = useSelector((state: RootState) => state.order[kind]);
  const items = useSelector(selectItems(kind));
  const mine = !!owner && meta.owner === key;
  // Also after the list was reset under it (resetOrders when another shop is picked).
  const needsLoad = !mine || meta.phase === "idle";

  useEffect(() => {
    if (owner && needsLoad) void loadOrders(store, owner, "first");
  }, [store, owner, needsLoad]);

  const loadMore = useCallback(() => (owner ? loadOrders(store, owner, "more") : Promise.resolve(false)), [store, owner]);
  const refresh = useCallback(() => (owner ? loadOrders(store, owner, "refresh") : Promise.resolve(false)), [store, owner]);
  const retry = useCallback((row: Order) => (owner ? retryOrder(store, owner, row) : Promise.resolve(false)), [store, owner]);

  return { items: mine ? items : NO_ITEMS, meta: mine ? meta : IDLE, loadMore, refresh, retry };
}

/** The orders the signed-in name placed (My orders). */
export function useBuyerOrders(): OrderList & { name: string } {
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const owner = useMemo<ListOwner | null>(() => (name ? { kind: "buyer", name } : null), [name]);
  return { ...useOrderList(owner), name };
}

/** Which shop the seller views are about: `storeId`, or the signed-in name's current shop. */
export function useSellerShop(storeId?: string): { storeId: string; shortStoreId: string; seller: string } | null {
  const currentStore = useSelector((state: RootState) => state.global.currentStore);
  const userName = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const id = storeId || currentStore?.id || "";
  const seller = currentStore && currentStore.id === id ? currentStore.owner || userName : userName;
  return useMemo(() => {
    const short = shortStoreIdOf(id);
    return id && short && seller ? { storeId: id, shortStoreId: short, seller } : null;
  }, [id, seller]);
}

/** The orders one shop received (all buyers). */
export function useShopOrders(storeId?: string): OrderList & { shop: ReturnType<typeof useSellerShop> } {
  const shop = useSellerShop(storeId);
  const owner = useMemo<ListOwner | null>(
    () => (shop ? { kind: "seller", storeId: shop.storeId, shortStoreId: shop.shortStoreId, seller: shop.seller } : null),
    [shop]
  );
  return { ...useOrderList(owner), shop };
}

/** How many paid orders the buyer still has to finish (money/pendingOrders.ts). */
export function usePendingOrderCount(name: string | undefined): number {
  return useSyncExternalStore(
    subscribePendingOrders,
    () => listPendingOrders(name).length,
    () => 0
  );
}

