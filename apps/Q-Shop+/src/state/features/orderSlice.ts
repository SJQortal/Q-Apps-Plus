/**
 * Orders in Redux: the buyer's list (My orders) and the seller's list (one
 * shop's received orders), the orders opened so far and their statuses.
 *
 * - Rows are search rows `{ id, user, created, updated }` (`user` is the
 *   buyer: the name that published the order). Each list keeps the next
 *   page's offset in its OWN raw search rows (the original paged My orders
 *   with the seller's list length: docs/apps/Q-Shop+.md → Bugs 5).
 * - `hashMapOrders` holds decrypted orders by order id. An order that could
 *   not be opened gets an `openState` instead and never stops the others
 *   (Bugs 4).
 * - `statuses` holds what the seller's status document says, by order id;
 *   no document means "Received", as in the original. It is separate from
 *   the order, so a status can land before its order and a refresh can't
 *   wipe a status the seller just sent (see `sentAt`).
 * - `delivered` holds the buyer's "it arrived" (orders/delivered.ts), by
 *   order id: null once read and there is none. Lists show "Delivered" from
 *   it (orders/status.ts shownStatus); the seller's own status stays as is.
 */
import type { Tracking } from "../../orders/tracking";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Product } from "./storeSlice";

export interface TotalPriceDetails {
  totalPrice: number | string;
}

export interface ProductDetails {
  product: Product;
  catalogueId: string;
  quantity: number;
  pricePerUnit: number;
  totalProductPrice: number;
}

export type Details = TotalPriceDetails & Record<string, ProductDetails>;

export interface Delivery {
  customerName: string;
  shippingAddress: {
    streetAddress: string;
    city: string;
    region?: string;
    state?: string;
    country: string;
    zipCode: string;
    deliveryNote?: string;
  };
}

export interface Payment {
  /** `toFixed(8)` text as written; older code typed it as a number. */
  total?: number | string;
  currency: string;
  transactionSignature?: string | null;
  arrrAddressUsed?: string;
  /** + app, additive (docs/apps/Q-Shop+.md → Data contract). */
  foreignAddressUsed?: string;
  foreignTxid?: string;
  assetId?: number;
  assetName?: string;
}

enum CommunicationMethod {
  QMail = "Q-Mail",
}

export interface Order {
  created: number;
  updated: number;
  version?: number;
  details?: Details;
  delivery?: Delivery;
  payment?: Payment;
  communicationMethod?: CommunicationMethod[];
  /** The buyer: the name that published the order (from the search row). */
  user: string;
  sellerName?: string;
  storeName?: string;
  id: string;
  totalPrice?: number | string;
  status?: string;
  note?: string;
  isValid?: boolean;
}

export interface Status {
  status: string;
}

/** What the seller's status document says about an order. */
export interface OrderStatusInfo {
  /** "known": read, or no document (then "Received"); "error": a document exists but couldn't be read. */
  state: "known" | "error";
  status: string;
  note: string;
  /** A shipped order's carrier and tracking number (orders/tracking.ts). */
  tracking?: Tracking | null;
  /** The status document's `updated` (0 when there is none). */
  updated: number;
  /** Set when the seller sends a new status: older documents read later don't replace it. */
  sentAt?: number;
  /** The seller's update is being published. */
  sending?: boolean;
}

/** The buyer confirmed the order arrived (orders/delivered.ts). */
export interface DeliveredInfo {
  /** When the buyer published it (its row's `created`, or the send time while sending). */
  at: number;
  /** Being published. */
  sending?: boolean;
}

/**
 * Why an order isn't open: still coming from peers, not on the node, it can't
 * be decrypted or read, or it is another app's order under Q-Shop's prefix
 * (utils/fetchOrders.ts foreignOrderApp), left out of the lists.
 */
export type OrderOpenState = "peers" | "unavailable" | "unreadable" | "foreign";

/** The app another app's order came from (utils/fetchOrders.ts). */
export interface ForeignApp {
  name: string;
  link: string | null;
}

export type OrderListKind = "buyer" | "seller";

export interface OrderListMeta {
  /** Whose list: the buyer's name, or the seller's shop id. */
  owner: string;
  /** Raw search rows read so far: the next page's offset. */
  offset: number;
  hasMore: boolean;
  /** The first page: idle (not asked), loading, ready, or error. */
  phase: "idle" | "loading" | "ready" | "error";
  loadingMore: boolean;
  /** Page one is being read again (pull to refresh, Refresh): the rows stay until it lands. */
  refreshing: boolean;
  /** The last next-page load failed. */
  moreError: boolean;
  /** Bumped by every reset, so loads started before it drop their answers. */
  generation: number;
  /** When page one last landed (ms; 0: never). A list read long ago is read again when it shows. */
  loadedAt: number;
}

interface OrderState {
  hashMapOrders: Record<string, Order>;
  openState: Record<string, OrderOpenState>;
  /** For orders whose openState is "foreign": the app they came from. */
  foreignApps: Record<string, ForeignApp>;
  statuses: Record<string, OrderStatusInfo>;
  delivered: Record<string, DeliveredInfo | null>;
  /** The seller's received orders (rows), newest first. */
  orders: Order[];
  /** The buyer's orders (rows), newest first. */
  myOrders: Order[];
  seller: OrderListMeta;
  buyer: OrderListMeta;
}

function emptyMeta(owner = "", generation = 0): OrderListMeta {
  return {
    owner,
    offset: 0,
    hasMore: true,
    phase: "idle",
    loadingMore: false,
    refreshing: false,
    moreError: false,
    generation,
    loadedAt: 0,
  };
}

const initialState: OrderState = {
  hashMapOrders: {},
  openState: {},
  foreignApps: {},
  statuses: {},
  delivered: {},
  orders: [],
  myOrders: [],
  seller: emptyMeta(),
  buyer: emptyMeta(),
};

function rowsOf(state: OrderState, kind: OrderListKind): Order[] {
  return kind === "buyer" ? state.myOrders : state.orders;
}

function setRows(state: OrderState, kind: OrderListKind, rows: Order[]) {
  if (kind === "buyer") state.myOrders = rows;
  else state.orders = rows;
}

/**
 * Adds search rows to a list, newest first, one row per order id. Another
 * name can publish an order under the same identifier (docs/QORTAL.md →
 * pitfall 15); the order's status document is keyed by the id alone, so
 * only one of them can be the real one: the first published is kept.
 */
export function mergeOrderRows(existing: Order[], incoming: Order[]): Order[] {
  const byId = new Map(existing.map((row) => [row.id, row]));
  const order = existing.map((row) => row.id);
  for (const row of incoming) {
    const current = byId.get(row.id);
    if (!current) {
      byId.set(row.id, row);
      order.push(row.id);
    } else if (current.user === row.user) {
      byId.set(row.id, { ...current, ...row });
    } else if ((row.created ?? 0) < (current.created ?? 0)) {
      byId.set(row.id, row);
    }
  }
  return order.map((id) => byId.get(id) as Order);
}

export const orderSlice = createSlice({
  name: "order",
  initialState,
  reducers: {
    /**
     * A list starts loading a page. A new owner starts it over; `reset` (a
     * refresh) reads page one again but keeps the rows and the offset until it
     * lands, and makes answers to loads started before it stale.
     */
    listLoading: (state, action: PayloadAction<{ kind: OrderListKind; owner: string; reset: boolean }>) => {
      const { kind, owner, reset } = action.payload;
      const meta = state[kind];
      if (meta.owner !== owner) {
        state[kind] = { ...emptyMeta(owner, meta.generation + 1), phase: "loading" };
        setRows(state, kind, []);
        return;
      }
      if (reset) {
        meta.generation += 1;
        meta.loadingMore = false;
        meta.moreError = false;
        if (meta.phase === "ready") meta.refreshing = true;
        else meta.phase = "loading";
        return;
      }
      if (meta.phase === "ready") {
        meta.loadingMore = true;
        meta.moreError = false;
      } else {
        meta.phase = "loading";
      }
    },
    /** A page landed. `first` replaces the rows (page one, possibly after a refresh). */
    listPage: (
      state,
      action: PayloadAction<{
        kind: OrderListKind;
        owner: string;
        generation: number;
        rows: Order[];
        read: number;
        hasMore: boolean;
        first: boolean;
        /** When it was read (ms), for page one. */
        at?: number;
      }>
    ) => {
      const { kind, owner, generation, rows, read, hasMore, first, at } = action.payload;
      const meta = state[kind];
      if (meta.owner !== owner || meta.generation !== generation) return;
      setRows(state, kind, mergeOrderRows(first ? [] : rowsOf(state, kind), rows));
      if (first && at !== undefined) meta.loadedAt = at;
      meta.offset = (first ? 0 : meta.offset) + read;
      meta.hasMore = hasMore;
      meta.phase = "ready";
      meta.loadingMore = false;
      meta.refreshing = false;
      meta.moreError = false;
    },
    listFailed: (state, action: PayloadAction<{ kind: OrderListKind; owner: string; generation: number; first: boolean }>) => {
      const { kind, owner, generation, first } = action.payload;
      const meta = state[kind];
      if (meta.owner !== owner || meta.generation !== generation) return;
      meta.loadingMore = false;
      meta.refreshing = false;
      if (first && rowsOf(state, kind).length === 0) meta.phase = "error";
      else {
        meta.phase = "ready";
        meta.moreError = !first;
      }
    },
    /**
     * The list on the node has changed since it was read (the buyer's order
     * was just recorded): page one is read again the next time the list shows
     * (or now, if it shows). The rows stay on screen until it lands, and
     * answers to loads started before this are dropped.
     */
    listStale: (state, action: PayloadAction<{ kind: OrderListKind; owner: string }>) => {
      const { kind, owner } = action.payload;
      const meta = state[kind];
      if (meta.owner !== owner || meta.phase === "idle") return;
      meta.phase = "idle";
      meta.generation += 1;
      meta.loadingMore = false;
      meta.refreshing = false;
      meta.moreError = false;
    },
    /** Decrypted orders. */
    ordersOpened: (state, action: PayloadAction<Order[]>) => {
      for (const order of action.payload) {
        state.hashMapOrders[order.id] = { ...order, totalPrice: order.details?.totalPrice };
        delete state.openState[order.id];
      }
    },
    orderOpenState: (state, action: PayloadAction<{ id: string; state: OrderOpenState | null; app?: ForeignApp }>) => {
      const { id, state: openState, app } = action.payload;
      if (openState) state.openState[id] = openState;
      else delete state.openState[id];
      if (openState === "foreign" && app) state.foreignApps[id] = app;
      else delete state.foreignApps[id];
    },
    /** Statuses read from QDN (or "Received" when there is no document). */
    statusesLoaded: (state, action: PayloadAction<{ orderId: string; info: OrderStatusInfo }[]>) => {
      for (const { orderId, info } of action.payload) {
        const current = state.statuses[orderId];
        // The seller just sent a newer status: a document published before it doesn't replace it.
        if (current?.sentAt && (current.sending || info.updated < current.sentAt)) continue;
        state.statuses[orderId] = info;
      }
    },
    /** The seller's update, shown at once (optimistic) and restored with `statusRestored` if it fails. */
    statusSending: (state, action: PayloadAction<{ orderId: string; status: string; note: string; tracking?: Tracking | null; sentAt: number }>) => {
      const { orderId, status, note, tracking, sentAt } = action.payload;
      state.statuses[orderId] = {
        state: "known",
        status,
        note,
        tracking: tracking ?? null,
        updated: state.statuses[orderId]?.updated ?? 0,
        sentAt,
        sending: true,
      };
    },
    statusSent: (state, action: PayloadAction<{ orderId: string }>) => {
      const current = state.statuses[action.payload.orderId];
      if (current) current.sending = false;
    },
    statusRestored: (state, action: PayloadAction<{ orderId: string; previous: OrderStatusInfo | null }>) => {
      const { orderId, previous } = action.payload;
      if (previous) state.statuses[orderId] = previous;
      else delete state.statuses[orderId];
    },

    /** Delivery confirmations read (null: none). One being sent isn't replaced. */
    deliveredLoaded: (state, action: PayloadAction<{ orderId: string; info: DeliveredInfo | null }[]>) => {
      for (const { orderId, info } of action.payload) {
        const current = state.delivered[orderId];
        if (current?.sending || (current && !info)) continue;
        state.delivered[orderId] = info;
      }
    },
    deliveredSending: (state, action: PayloadAction<{ orderId: string; at: number }>) => {
      state.delivered[action.payload.orderId] = { at: action.payload.at, sending: true };
    },
    deliveredSent: (state, action: PayloadAction<{ orderId: string }>) => {
      const current = state.delivered[action.payload.orderId];
      if (current) current.sending = false;
    },
    deliveredRestored: (state, action: PayloadAction<{ orderId: string; previous: DeliveredInfo | null | undefined }>) => {
      const { orderId, previous } = action.payload;
      if (previous === undefined) delete state.delivered[orderId];
      else state.delivered[orderId] = previous;
    },

    // ---------------------------------------------------- the original's actions

    /** The seller's list rows (kept for code that still uses it). */
    upsertOrders: (state, action: PayloadAction<Order[]>) => {
      state.orders = mergeOrderRows(state.orders, action.payload);
    },
    /**
     * One opened order. The original threw on a failed one (`order.details` of
     * undefined), which ended the loop over the rest of the page (Bugs 4);
     * now a missing or unreadable order is skipped.
     */
    addToHashMap: (state, action: PayloadAction<Order | null | undefined>) => {
      const order = action.payload;
      if (!order?.id || !order.details) return;
      state.hashMapOrders[order.id] = { ...order, totalPrice: order.details.totalPrice };
      delete state.openState[order.id];
    },
    /** Forget the seller's list (another shop was picked). Opened orders stay cached. */
    resetOrders: (state) => {
      state.orders = [];
      state.seller = emptyMeta("", state.seller.generation + 1);
    },
  },
});

export const {
  listLoading,
  listPage,
  listFailed,
  listStale,
  ordersOpened,
  orderOpenState,
  statusesLoaded,
  statusSending,
  statusSent,
  statusRestored,
  deliveredLoaded,
  deliveredSending,
  deliveredSent,
  deliveredRestored,
  upsertOrders,
  addToHashMap,
  resetOrders,
} = orderSlice.actions;

export default orderSlice.reducer;
