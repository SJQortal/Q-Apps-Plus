/**
 * Orders whose payment went through but whose order and mail aren't on QDN
 * yet. The original sent the payment, then published the order; when that
 * publish was declined, failed or timed out the payment was gone, the cart
 * still full, and the message said "please try again", inviting a second
 * payment (docs/apps/Q-Shop+.md → Bugs 1). Now the paid order is kept here
 * the moment Hub confirms the payment, the cart is emptied, and the buyer
 * finishes the order from here without paying again.
 *
 * What is stored, per buyer name, in localStorage (constants/plus.ts): the
 * order without its delivery address (product lines, prices, the payment and
 * its signature, the identifiers to publish under). All Q-Apps on a node share
 * one browser origin, so the address a buyer typed stays in memory only; after
 * a reload a physical order asks for it again.
 */
import { PENDING_ORDERS_STORAGE_KEY } from "../constants/plus";
import type { DeliveryInput, OrderDetails, PaymentRecord } from "./order";

export type PendingState =
  /** Paid; the order isn't on QDN yet. */
  | "paid"
  /** Hub didn't answer the payment request in time: it may or may not have been sent. */
  | "unconfirmed";

export interface PendingOrder {
  version: 1;
  /** `orderUid`: the order publishes as q-store-order-<shortStoreId>-<orderUid>. */
  orderUid: string;
  mailUid: string;
  state: PendingState;
  created: number;
  updated: number;
  buyer: { name: string; address: string; publicKey: string };
  store: {
    id: string;
    shortStoreId: string;
    title: string | undefined;
    owner: string;
  };
  seller: { address: string; publicKey: string };
  coin: string;
  currencyLabel: string;
  /** Where the payment went (the seller's Qortal address, or the shop's coin address). */
  recipient: string;
  amount: string;
  isDigital: boolean;
  details: OrderDetails;
  /** Filled once Hub confirms the payment. */
  payment: PaymentRecord | null;
  /** The last thing that went wrong, in plain words. */
  lastError?: string;
}

type Store = Record<string, PendingOrder[]>;

const EVENT = "qshopplus-pending-orders";
const deliveries = new Map<string, DeliveryInput>();

function read(): Store {
  try {
    const raw = localStorage.getItem(PENDING_ORDERS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

/** Kept in memory too, so a full or blocked localStorage never loses a paid order for this visit. */
let memory: Store | null = null;

function load(): Store {
  if (!memory) memory = read();
  return memory;
}

function stripImages(order: PendingOrder): PendingOrder {
  const details = { ...order.details } as Record<string, any>;
  for (const key of Object.keys(details)) {
    if (key === "totalPrice") continue;
    const line = details[key];
    if (line?.product?.images) details[key] = { ...line, product: { ...line.product, images: [] } };
  }
  return { ...order, details: details as OrderDetails };
}

function write(next: Store): void {
  memory = next;
  try {
    localStorage.setItem(PENDING_ORDERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota: product images are only a copy inside the order; drop them and try again.
    try {
      const slim: Store = {};
      for (const [name, list] of Object.entries(next)) slim[name] = list.map(stripImages);
      localStorage.setItem(PENDING_ORDERS_STORAGE_KEY, JSON.stringify(slim));
    } catch {
      // Still kept in memory for this visit.
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function listPendingOrders(buyerName: string | undefined | null): PendingOrder[] {
  if (!buyerName) return [];
  return [...(load()[buyerName] ?? [])].sort((a, b) => b.created - a.created);
}

export function getPendingOrder(buyerName: string, orderUid: string): PendingOrder | undefined {
  return load()[buyerName]?.find((o) => o.orderUid === orderUid);
}

export function savePendingOrder(order: PendingOrder, delivery?: DeliveryInput): void {
  const all = { ...load() };
  const list = (all[order.buyer.name] ?? []).filter((o) => o.orderUid !== order.orderUid);
  all[order.buyer.name] = [...list, { ...order, updated: Date.now() }];
  if (delivery) deliveries.set(order.orderUid, delivery);
  write(all);
}

export function removePendingOrder(buyerName: string, orderUid: string): void {
  const all = { ...load() };
  const list = (all[buyerName] ?? []).filter((o) => o.orderUid !== orderUid);
  if (list.length > 0) all[buyerName] = list;
  else delete all[buyerName];
  deliveries.delete(orderUid);
  write(all);
}

/** The delivery address typed this visit, if any (never stored). */
export function pendingDelivery(orderUid: string): DeliveryInput | undefined {
  return deliveries.get(orderUid);
}

export function rememberDelivery(orderUid: string, delivery: DeliveryInput): void {
  deliveries.set(orderUid, delivery);
}

/** Calls `listener` whenever pending orders change (this tab). Returns the unsubscribe. */
export function subscribePendingOrders(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === PENDING_ORDERS_STORAGE_KEY) {
      memory = null;
      listener();
    }
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** For tests. */
export function resetPendingOrders(): void {
  memory = null;
  deliveries.clear();
}
