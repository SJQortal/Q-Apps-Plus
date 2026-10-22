/**
 * Loads the order lists into Redux, a page at a time:
 *
 * 1. one search for the page's rows (reads.ts);
 * 2. each order opened, 5 at a time, landing on screen one by one; an order
 *    the node doesn't have yet shows "Fetching from peers…" and is asked for
 *    again after 2, 4 and 8 s, then shows "Couldn't open this order" with a
 *    Retry; one that can't be decrypted shows that at once. None of them
 *    stops the others (docs/apps/Q-Shop+.md → Bugs 4);
 * 3. the statuses: the seller's from one search over the shop's statuses
 *    (made with page one, reused by later pages), the buyer's from one
 *    search per page over the page's sellers.
 *
 * Loads of the same list share one promise; a refresh or another owner
 * (another name, another shop) makes the answers of older loads stale.
 */
import type { Order, OrderListKind, OrderStatusInfo } from "../state/features/orderSlice";
import { listFailed, listLoading, listPage, orderOpenState, ordersOpened, statusesLoaded } from "../state/features/orderSlice";
import type { RootState } from "../state/store";
import {
  OPEN_CONCURRENCY,
  buyerStatusIndex,
  fetchRetry,
  findStatusRow,
  openOrderOnce,
  readStatus,
  resolveStatuses,
  searchBuyerOrders,
  searchShopOrdersPage,
  shopStatusIndex,
  sleep,
  type StatusIndex,
  type StatusTarget,
} from "./reads";
import { mapWithConcurrency } from "../qdn/search";
import { NO_STATUS_DOCUMENT } from "./status";

/** The parts of the Redux store the loader needs (the app's store, or a test's). */
export interface OrderStore {
  dispatch: (action: any) => any;
  getState: () => RootState;
}

export type ListOwner =
  | { kind: "buyer"; name: string }
  | { kind: "seller"; storeId: string; shortStoreId: string; seller: string };

export function ownerKey(owner: ListOwner): string {
  return owner.kind === "buyer" ? owner.name : owner.storeId;
}

export type LoadMode = "first" | "more" | "refresh";

const inflight = new WeakMap<OrderStore, Map<string, Promise<boolean>>>();
const sellerIndexes = new WeakMap<OrderStore, Map<string, { generation: number; index: Promise<StatusIndex | null> }>>();

function inflightFor(store: OrderStore): Map<string, Promise<boolean>> {
  let map = inflight.get(store);
  if (!map) {
    map = new Map();
    inflight.set(store, map);
  }
  return map;
}

function isCurrent(store: OrderStore, kind: OrderListKind, owner: string, generation: number): boolean {
  const meta = store.getState().order[kind];
  return meta.owner === owner && meta.generation === generation;
}

/**
 * Loads page one ("first": only if this list isn't loaded or loading yet),
 * the next page ("more"), or page one again from the node ("refresh").
 * Resolves true when a page landed.
 */
export function loadOrders(store: OrderStore, owner: ListOwner, mode: LoadMode): Promise<boolean> {
  const kind = owner.kind;
  const key = ownerKey(owner);
  if (!key || (owner.kind === "seller" && (!owner.shortStoreId || !owner.seller))) return Promise.resolve(false);
  const meta = store.getState().order[kind];
  const running = inflightFor(store);
  // Page one (first or refresh) and each next page are separate tasks: a
  // next page can start while page one's orders are still opening.
  const runningKey = `${kind}:${key}:${mode === "more" ? `more:${meta.offset}` : "first"}`;
  const current = running.get(runningKey);

  if (mode === "first") {
    if (meta.owner === key && meta.phase !== "idle" && meta.phase !== "error") return current ?? Promise.resolve(true);
  } else if (mode === "refresh") {
    if (meta.owner === key && (meta.refreshing || meta.phase === "loading") && current) return current;
  } else {
    if (meta.loadingMore) return current ?? Promise.resolve(false);
    if (meta.owner !== key || meta.phase !== "ready" || !meta.hasMore || meta.refreshing) return Promise.resolve(false);
  }

  const task = runPage(store, owner, mode).finally(() => {
    if (running.get(runningKey) === task) running.delete(runningKey);
  });
  running.set(runningKey, task);
  return task;
}

async function runPage(store: OrderStore, owner: ListOwner, mode: LoadMode): Promise<boolean> {
  const kind = owner.kind;
  const key = ownerKey(owner);
  const first = mode !== "more";
  const fresh = mode === "refresh";
  store.dispatch(listLoading({ kind, owner: key, reset: mode === "refresh" }));
  const meta = store.getState().order[kind];
  const generation = meta.generation;
  const offset = first ? 0 : meta.offset;

  let page;
  try {
    page =
      owner.kind === "buyer"
        ? await searchBuyerOrders(owner.name, offset, fresh)
        : await searchShopOrdersPage(owner.shortStoreId, offset, fresh);
  } catch {
    store.dispatch(listFailed({ kind, owner: key, generation, first }));
    return false;
  }
  if (!isCurrent(store, kind, key, generation)) return false;
  store.dispatch(listPage({ kind, owner: key, generation, rows: page.rows, read: page.read, hasMore: page.hasMore, first }));

  const live = () => isCurrent(store, kind, key, generation);
  if (owner.kind === "seller") {
    const index = sellerStatusIndex(store, owner, generation, first, fresh);
    await Promise.all([
      // The seller's statuses come from the shop's index by order id, so they don't wait for the orders.
      openRows(store, page.rows, live),
      index.then((idx) =>
        resolveStatuses(
          page.rows.map((row) => ({ orderId: row.id, seller: owner.seller, buyer: row.user })),
          idx,
          statusSink(store, live),
          fresh
        )
      ),
    ]);
  } else {
    const opened = await openRows(store, page.rows, live, (order) => buyerOrderOpenedLate(store, order, live));
    const targets = opened.filter((o): o is Order => !!o?.sellerName).map(buyerTarget);
    let index: StatusIndex | null = null;
    try {
      index = await buyerStatusIndex(
        targets.map((t) => ({ id: t.orderId, seller: t.seller })),
        fresh
      );
    } catch {
      index = null;
    }
    await resolveStatuses(targets, index, statusSink(store, live), fresh);
  }
  return true;
}

function statusSink(store: OrderStore, live: () => boolean) {
  return (orderId: string, info: OrderStatusInfo) => {
    if (live()) store.dispatch(statusesLoaded([{ orderId, info }]));
  };
}

function buyerTarget(order: Order): StatusTarget {
  return { orderId: order.id, seller: order.sellerName as string, buyer: order.user };
}

/** The shop's status index for this list generation: searched with page one, reused by later pages. */
function sellerStatusIndex(
  store: OrderStore,
  owner: Extract<ListOwner, { kind: "seller" }>,
  generation: number,
  first: boolean,
  fresh: boolean
): Promise<StatusIndex | null> {
  let byShop = sellerIndexes.get(store);
  if (!byShop) {
    byShop = new Map();
    sellerIndexes.set(store, byShop);
  }
  const cached = byShop.get(owner.storeId);
  if (cached && cached.generation === generation && !first) return cached.index;
  const index = shopStatusIndex(owner.seller, owner.shortStoreId, fresh).catch(() => null);
  byShop.set(owner.storeId, { generation, index });
  return index;
}

/**
 * Opens rows 5 at a time (first attempt each). Rows the node doesn't have
 * yet are retried after 2, 4 and 8 s in the background; `onLateOpen` gets
 * the ones that open then. Resolves with each row's order (or null) after
 * the first attempts.
 */
async function openRows(
  store: OrderStore,
  rows: Order[],
  live: () => boolean,
  onLateOpen?: (order: Order) => void
): Promise<(Order | null)[]> {
  return mapWithConcurrency(rows, OPEN_CONCURRENCY, async (row) => {
    // Not `fresh` even on a refresh: an order is cached by its `updated`, so only a changed one is read again.
    const outcome = await openOrderOnce(row);
    if (!live()) return null;
    if (outcome.ok) {
      store.dispatch(ordersOpened([outcome.order]));
      return outcome.order;
    }
    if (outcome.stage !== "fetch") {
      store.dispatch(orderOpenState({ id: row.id, state: "unreadable" }));
      return null;
    }
    store.dispatch(orderOpenState({ id: row.id, state: "peers" }));
    void retryFromPeers(store, row, live).then((order) => {
      if (order) onLateOpen?.(order);
    });
    return null;
  });
}

/** Asks again for an order the node didn't have: after 2, 4 and 8 s, then gives up. */
async function retryFromPeers(store: OrderStore, row: Order, live: () => boolean): Promise<Order | null> {
  for (const delay of fetchRetry.delaysMs) {
    await sleep(delay);
    if (!live()) return null;
    const outcome = await openOrderOnce(row, true);
    if (!live()) return null;
    if (outcome.ok) {
      store.dispatch(ordersOpened([outcome.order]));
      return outcome.order;
    }
    if (outcome.stage !== "fetch") {
      store.dispatch(orderOpenState({ id: row.id, state: "unreadable" }));
      return null;
    }
  }
  store.dispatch(orderOpenState({ id: row.id, state: "unavailable" }));
  return null;
}

function buyerOrderOpenedLate(store: OrderStore, order: Order, live: () => boolean): void {
  if (!order.sellerName) return;
  void resolveStatuses([buyerTarget(order)], null, statusSink(store, live));
}

/**
 * The Retry on a "Couldn't open this order" row: one more attempt now, then
 * the same retries from peers; then its status if it opened.
 */
export async function retryOrder(store: OrderStore, owner: ListOwner, row: Order): Promise<boolean> {
  const kind = owner.kind;
  const key = ownerKey(owner);
  const generation = store.getState().order[kind].generation;
  const live = () => isCurrent(store, kind, key, generation);
  store.dispatch(orderOpenState({ id: row.id, state: "peers" }));
  const outcome = await openOrderOnce(row, true);
  if (!live()) return false;
  let order: Order | null = null;
  if (outcome.ok) {
    store.dispatch(ordersOpened([outcome.order]));
    order = outcome.order;
  } else if (outcome.stage !== "fetch") {
    store.dispatch(orderOpenState({ id: row.id, state: "unreadable" }));
  } else {
    order = await retryFromPeers(store, row, live);
  }
  if (!order) return false;
  if (owner.kind === "buyer") buyerOrderOpenedLate(store, order, live);
  return true;
}

const statusChecks = new WeakMap<OrderStore, Map<string, Promise<void>>>();

/**
 * The status of one order on its own (the order dialog, when its list hasn't
 * read it): a search for its status document by the seller's name (the
 * original searched by identifier alone, so any name could answer:
 * docs/apps/Q-Shop+.md → Bugs 11), then FETCH + DECRYPT_DATA as pinned.
 */
export function ensureOrderStatus(store: OrderStore, order: Order, seller: string, fresh = false): Promise<void> {
  if (!seller) return Promise.resolve();
  if (!fresh && store.getState().order.statuses[order.id]) return Promise.resolve();
  let checks = statusChecks.get(store);
  if (!checks) {
    checks = new Map();
    statusChecks.set(store, checks);
  }
  const running = checks.get(order.id);
  if (running && !fresh) return running;
  const task = (async () => {
    let info: OrderStatusInfo;
    try {
      const row = await findStatusRow(seller, order.id, fresh);
      info = row ? await readStatus(seller, row, order.user) : NO_STATUS_DOCUMENT;
    } catch {
      info = { state: "error", status: "", note: "", updated: 0 };
    }
    store.dispatch(statusesLoaded([{ orderId: order.id, info }]));
  })().finally(() => {
    if (checks.get(order.id) === task) checks.delete(order.id);
  });
  checks.set(order.id, task);
  return task;
}
