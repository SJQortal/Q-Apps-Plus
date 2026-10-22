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
import { PENDING_ORDERS_STORAGE_KEY, STORAGE_PREFIX } from "../constants/plus";
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
  /**
   * The parts Hub reported published when it published only some of them
   * (it names the ones that failed): Finish sends only the rest.
   */
  published?: OrderPart[];
  /**
   * Stored without its product pictures (localStorage was full): they are
   * read again from the seller's catalogues before the order is published.
   */
  imagesStripped?: boolean;
  /** The last thing that went wrong, in plain words. */
  lastError?: string;
}

/** The two resources an order is recorded as: the order itself and the seller's Q-Mail. */
export type OrderPart = "order" | "mail";

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

/** A copy without the product pictures, marked so they are fetched again before it is published. */
function stripImages(order: PendingOrder): PendingOrder {
  const details = { ...order.details } as Record<string, any>;
  let stripped = false;
  for (const key of Object.keys(details)) {
    if (key === "totalPrice") continue;
    const line = details[key];
    if (Array.isArray(line?.product?.images) && line.product.images.length > 0) {
      details[key] = { ...line, product: { ...line.product, images: [] } };
      stripped = true;
    }
  }
  return stripped ? { ...order, details: details as OrderDetails, imagesStripped: true } : order;
}

function write(next: Store): void {
  memory = next;
  try {
    localStorage.setItem(PENDING_ORDERS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota: product images are only a copy inside the order; drop them and
    // try again. The copy is marked, and checkout reads them back from the
    // seller's catalogues before publishing it (withImagesRefilled).
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

/*
 * Orders being recorded right now, in this tab. One order is published at
 * most once at a time: a second Finish (another card for the same order, a
 * double tap, the checkout dialog's card after Later) waits for the running
 * publish instead of sending Hub a second one, with a second fee. Every card
 * and the checkout dialog read this to show "Recording…".
 */
const recordings = new Map<string, Promise<unknown>>();

function changed(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** The publish running for this order, if any. */
export function runningRecording<T>(orderUid: string): Promise<T> | undefined {
  return recordings.get(orderUid) as Promise<T> | undefined;
}

/** Notes that `run` records `orderUid` until it settles (subscribers hear both). */
export function trackRecording<T>(orderUid: string, run: Promise<T>): Promise<T> {
  recordings.set(orderUid, run);
  changed();
  const done = () => {
    if (recordings.get(orderUid) === run) recordings.delete(orderUid);
    changed();
  };
  run.then(done, done);
  return run;
}

export function isRecordingOrder(orderUid: string): boolean {
  return recordings.has(orderUid);
}

/*
 * Payments already used by an order recorded from this device. "Check again"
 * looks for a payment Hub didn't confirm among the buyer's latest
 * transactions; without this list it could take the payment of an order
 * already recorded (same seller, same amount) and record a second order with
 * it. Browser-only and additive (a new key under the app's storage prefix),
 * per buyer name, newest last, capped.
 */
export const USED_PAYMENTS_STORAGE_KEY = `${STORAGE_PREFIX}used-payments`;
const MAX_USED_PAYMENTS = 100;

interface UsedPayment {
  signature: string;
  orderUid: string;
  at: number;
}

let usedMemory: Record<string, UsedPayment[]> | null = null;

function readUsed(): Record<string, UsedPayment[]> {
  const out: Record<string, UsedPayment[]> = {};
  try {
    const raw = localStorage.getItem(USED_PAYMENTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [name, list] of Object.entries(parsed as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        out[name] = list.filter(
          (item): item is UsedPayment => typeof item?.signature === "string" && item.signature !== "" && typeof item?.orderUid === "string"
        );
      }
    }
  } catch {
    // Unreadable: start empty (pending orders still exclude their own signatures).
  }
  return out;
}

/** Kept in memory too, so a full or blocked localStorage still remembers them for this visit. */
function loadUsed(): Record<string, UsedPayment[]> {
  if (!usedMemory) usedMemory = readUsed();
  return usedMemory;
}

/** Remembers that `signature` paid for this buyer's order `orderUid` (it is on QDN now). */
export function rememberUsedPayment(buyerName: string, orderUid: string, signature: string | null | undefined): void {
  if (!signature) return;
  const all = { ...loadUsed() };
  const list = (all[buyerName] ?? []).filter((p) => p.signature !== signature);
  all[buyerName] = [...list, { signature, orderUid, at: Date.now() }].slice(-MAX_USED_PAYMENTS);
  usedMemory = all;
  try {
    localStorage.setItem(USED_PAYMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Kept in memory for this visit.
  }
}

/**
 * Signatures this buyer's other orders already use: those recorded from this
 * device, and those of other pending orders. Never a payment for `orderUid`.
 */
export function paymentsUsedByOtherOrders(buyerName: string, orderUid: string): Set<string> {
  const used = new Set<string>();
  // This visit's list, plus what other tabs have stored since.
  for (const p of [...(loadUsed()[buyerName] ?? []), ...(readUsed()[buyerName] ?? [])]) {
    if (p.orderUid !== orderUid) used.add(p.signature);
  }
  const stored = read()[buyerName];
  for (const o of [...(load()[buyerName] ?? []), ...(Array.isArray(stored) ? stored : [])]) {
    const signature = o?.payment?.transactionSignature;
    if (o?.orderUid !== orderUid && typeof signature === "string" && signature) used.add(signature);
  }
  return used;
}

/** For tests. */
export function resetPendingOrders(): void {
  memory = null;
  usedMemory = null;
  deliveries.clear();
  recordings.clear();
}
