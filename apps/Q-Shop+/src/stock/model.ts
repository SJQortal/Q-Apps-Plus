/**
 * Stock counts (Simon, 2026-10-24: "the ability for sellers to add a stock
 * amount of the product, so if it sells out, it says sold out automatically,
 * make the default stock amount as not being tracked, but add the ability to
 * track it, also for different variants").
 *
 * Orders are encrypted to the seller, so no buyer's app can read what others
 * bought. Simon chose public counting (2026-10-24, "Every app counts"):
 *
 * - The seller sets a count on the product, additive: `stock: {v: 1,
 *   quantity, since, voided?}`, the units on hand at `since` (when the seller
 *   typed it). Its product-list row carries the same, so lists can tell
 *   without reading catalogues. No `stock`: not counted (the default), as in
 *   the original, which never reads it.
 * - An order of a counted product says so in its public description (the
 *   order itself stays encrypted): `stock:<productUid>x<quantity>;…`, only
 *   the counted lines, nothing else (no address, no price). Untracked orders
 *   carry no description, as before.
 * - Every app subtracts the notes of the shop's orders placed since `since`
 *   (stock/notes.ts): what's left is `quantity` minus those, never below 0.
 *   At 0 the product is sold out everywhere, while the seller is offline too.
 * - Anyone can publish an order identifier, so the seller can stop a note
 *   from counting (`voided`: order uids), or type the count again, which
 *   starts the counting afresh from then.
 *
 * Orders placed with the original app carry no note: the seller's count
 * doesn't see them (typing the count again corrects it).
 */
import { ORDER_BASE, PRODUCT_BASE } from "../qdn/identifiers";

export interface ProductStock {
  v: 1;
  /** Units on hand when it was set. */
  quantity: number;
  /** When the seller set it (ms): orders since count. */
  since: number;
  /** Orders the seller said not to count (their uids). */
  voided?: string[];
}

export const MAX_STOCK = 1_000_000;
/** The most order uids a product keeps as voided. */
export const MAX_VOIDED = 200;
/** Core keeps a description of up to 240 characters. */
export const NOTE_MAX_LENGTH = 240;
const NOTE_PREFIX = "stock:";
const UID = /^[A-Za-z0-9]{1,16}$/;

/** A product's (or its list row's) stock count, when it is counted and well formed. */
export function stockOf(value: unknown): ProductStock | null {
  const s = (value as { stock?: unknown } | null | undefined)?.stock as Partial<ProductStock> | null | undefined;
  if (!s || typeof s !== "object") return null;
  const { quantity, since } = s;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK) return null;
  if (typeof since !== "number" || !Number.isFinite(since) || since <= 0) return null;
  const voided = Array.isArray(s.voided) ? [...new Set(s.voided.filter((id): id is string => typeof id === "string" && UID.test(id)))].slice(0, MAX_VOIDED) : [];
  return { v: 1, quantity, since, ...(voided.length > 0 && { voided }) };
}

/** A new count: `quantity` units from `now`. */
export function newStock(quantity: number, now: number): ProductStock {
  return { v: 1, quantity: Math.max(0, Math.min(MAX_STOCK, Math.floor(quantity))), since: now };
}

/** The uid in a product id `q-store-product-<short>-<uid>` (a short shop id may hold dashes). */
export function productUidOf(productId: string): string | null {
  if (!productId.startsWith(`${PRODUCT_BASE}-`)) return null;
  const uid = productId.slice(productId.lastIndexOf("-") + 1);
  return UID.test(uid) ? uid : null;
}

/** The uid in an order id `q-store-order-<short>-<uid>`. */
export function orderUidOf(orderId: string): string | null {
  if (!orderId.startsWith(`${ORDER_BASE}-`)) return null;
  const uid = orderId.slice(orderId.lastIndexOf("-") + 1);
  return UID.test(uid) ? uid : null;
}

/**
 * The order's public note: its counted lines (a product with a count), as
 * many as fit in Core's 240 characters; null when none is counted, so an
 * untracked order stays exactly as before.
 */
export function stockNote(lines: readonly { productId: string; quantity: number; product: unknown }[]): string | null {
  let note = NOTE_PREFIX;
  let any = false;
  for (const line of lines) {
    if (!stockOf(line.product)) continue;
    const uid = productUidOf(line.productId);
    const quantity = Math.floor(line.quantity);
    if (!uid || !(quantity > 0)) continue;
    const entry = `${any ? ";" : ""}${uid}x${quantity}`;
    if (note.length + entry.length > NOTE_MAX_LENGTH) break;
    note += entry;
    any = true;
  }
  return any ? note : null;
}

/** An order's counted lines from its note: units by product uid (empty when it has none). */
export function parseStockNote(description: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (typeof description !== "string" || !description.startsWith(NOTE_PREFIX)) return out;
  for (const part of description.slice(NOTE_PREFIX.length).split(";")) {
    const match = /^([A-Za-z0-9]{1,16})x(\d{1,6})$/.exec(part.trim());
    if (!match) continue;
    const quantity = Number(match[2]);
    if (quantity > 0) out.set(match[1], (out.get(match[1]) ?? 0) + quantity);
  }
  return out;
}

/** One order's note as the counting reads it. */
export interface StockNote {
  orderUid: string;
  /** Who placed the order (the row's name). */
  buyer: string;
  /** Core's time for it. */
  created: number;
  items: Map<string, number>;
}

/** Units sold of a product since its count was set, by the notes (voided orders left out). */
export function soldSince(stock: ProductStock, productId: string, notes: readonly StockNote[]): number {
  const uid = productUidOf(productId);
  if (!uid) return 0;
  const voided = new Set(stock.voided ?? []);
  let sold = 0;
  for (const note of notes) {
    if (note.created < stock.since || voided.has(note.orderUid)) continue;
    sold += note.items.get(uid) ?? 0;
  }
  return sold;
}

/** The orders a product's count includes: who bought how many, newest first. */
export function countedOrders(stock: ProductStock, productId: string, notes: readonly StockNote[]): { orderUid: string; buyer: string; created: number; quantity: number }[] {
  const uid = productUidOf(productId);
  if (!uid) return [];
  return notes
    .filter((note) => note.created >= stock.since && note.items.has(uid))
    .map((note) => ({ orderUid: note.orderUid, buyer: note.buyer, created: note.created, quantity: note.items.get(uid) ?? 0 }))
    .sort((a, b) => b.created - a.created);
}

/** Units left: the count minus what sold, never below 0. */
export function stockLeft(stock: ProductStock, sold: number): number {
  return Math.max(0, stock.quantity - sold);
}
