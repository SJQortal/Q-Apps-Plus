import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSelector, useStore } from "react-redux";
import type { RootState } from "../state/store";
import type { Order, OrderListMeta } from "../state/features/orderSlice";
import { shortStoreIdOf } from "../qdn/identifiers";
import { listPendingOrders, subscribePendingOrders } from "../money/pendingOrders";
import { QDN_SEARCH_TTL_MS } from "../qdn/search";
import {
  loadOrders,
  openListedOrders,
  ownerKey,
  retryOrder,
  watchRecordedOrders,
  type ListOwner,
  type OrderStore,
} from "./loader";
import { selectItems, type OrderListItem } from "./selectors";

export interface OrderList {
  items: OrderListItem[];
  meta: OrderListMeta;
  /** A seller's list: the shop owner's name (rows naming another seller aren't theirs). "" for the buyer's list. */
  seller: string;
  loadMore: () => Promise<boolean>;
  refresh: () => Promise<boolean>;
  retry: (row: Order) => Promise<boolean>;
  /** Opens the shown rows that aren't open yet (a seller's list; nothing for the buyer's, which opens every row). */
  open: (rows: Order[]) => void;
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
  loadedAt: 0,
};

/** A list shown again after this long is read again: the session cache's lifetime (docs/QORTAL.md). */
export const LIST_REREAD_AFTER_MS = QDN_SEARCH_TTL_MS;

const NO_ITEMS: OrderListItem[] = [];

/**
 * An order list for `owner` (null: signed out, or no shop): page one on
 * mount, then on demand. `openLimit`: see LoadOptions (the seller's Overview).
 */
function useOrderList(owner: ListOwner | null, openLimit?: number): OrderList {
  const store: OrderStore = useStore<RootState>();
  const kind = owner?.kind ?? "buyer";
  const key = owner ? ownerKey(owner) : "";
  const meta = useSelector((state: RootState) => state.order[kind]);
  const items = useSelector(selectItems(kind));
  const mine = !!owner && meta.owner === key;
  // Also after the list was reset under it (resetOrders when another shop is picked).
  const needsLoad = !mine || meta.phase === "idle";

  useEffect(() => {
    if (owner && needsLoad) void loadOrders(store, owner, "first", { openLimit });
  }, [store, owner, needsLoad, openLimit]);

  // A list read longer ago than the search cache lasts is read again when it shows (new orders,
  // statuses the seller published since); the rows stay on screen meanwhile.
  useEffect(() => {
    if (!owner) return;
    const current = store.getState().order[owner.kind];
    if (current.owner !== ownerKey(owner) || current.phase !== "ready" || current.refreshing) return;
    if (Date.now() - current.loadedAt > LIST_REREAD_AFTER_MS) void loadOrders(store, owner, "refresh", { openLimit });
  }, [store, owner, openLimit]);

  const loadMore = useCallback(() => (owner ? loadOrders(store, owner, "more") : Promise.resolve(false)), [store, owner]);
  const refresh = useCallback(
    () => (owner ? loadOrders(store, owner, "refresh", { openLimit }) : Promise.resolve(false)),
    [store, owner, openLimit]
  );
  const retry = useCallback((row: Order) => (owner ? retryOrder(store, owner, row) : Promise.resolve(false)), [store, owner]);
  const open = useCallback((rows: Order[]) => (owner ? openListedOrders(store, owner, rows) : undefined), [store, owner]);

  const seller = owner?.kind === "seller" ? owner.seller : "";
  return { items: mine ? items : NO_ITEMS, meta: mine ? meta : IDLE, seller, loadMore, refresh, retry, open };
}

/** The orders the signed-in name placed (My orders). */
export function useBuyerOrders(): OrderList & { name: string } {
  const store: OrderStore = useStore<RootState>();
  const name = useSelector((state: RootState) => state.auth.user?.name ?? "");
  const owner = useMemo<ListOwner | null>(() => (name ? { kind: "buyer", name } : null), [name]);
  // From now on, an order recorded at checkout marks this list for a new read (loader.ts).
  useEffect(() => watchRecordedOrders(store), [store]);
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

/**
 * The orders one shop received (all buyers). `openLimit`: open only that
 * many of page one's orders up front (plus the ones needed to count them);
 * the view opens the others it shows with `open`.
 */
export function useShopOrders(
  storeId?: string,
  options: { openLimit?: number } = {}
): OrderList & { shop: ReturnType<typeof useSellerShop> } {
  const shop = useSellerShop(storeId);
  const owner = useMemo<ListOwner | null>(
    () => (shop ? { kind: "seller", storeId: shop.storeId, shortStoreId: shop.shortStoreId, seller: shop.seller } : null),
    [shop]
  );
  return { ...useOrderList(owner, options.openLimit), shop };
}

/** How many paid orders the buyer still has to finish (money/pendingOrders.ts). */
export function usePendingOrderCount(name: string | undefined): number {
  return useSyncExternalStore(
    subscribePendingOrders,
    () => listPendingOrders(name).length,
    () => 0
  );
}

