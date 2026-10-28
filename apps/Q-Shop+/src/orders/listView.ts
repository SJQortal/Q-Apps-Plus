import type { OrderStatusInfo } from "../state/features/orderSlice";
import type { OrderListItem } from "./selectors";
import { sameName } from "./reads";
import { normalizeStatus, type ShownStatus, type StatusCounts, type StatusFilter } from "./status";

/**
 * Where a row of a seller's list stands. A shop's order search finds every
 * `q-store-order-<short>-` of any buyer, and shop ids are free slugs that
 * repeat across owners, so some rows aren't this seller's orders:
 * - "mine": opened, and the order names this seller;
 * - "pending": not opened yet (still opening, or not needed yet);
 * - "other": opened but written for another seller, or it couldn't be
 *   opened (not decryptable, not an order, not on the node). These never
 *   count as "To handle" and never fill the status filters.
 */
export type SellerRowKind = "mine" | "pending" | "other";

export function sellerRowKind(item: OrderListItem, seller: string): SellerRowKind {
  if (item.order) return sameName(item.order.sellerName, seller) ? "mine" : "other";
  if (item.openState === "unreadable" || item.openState === "unavailable" || item.openState === "foreign") return "other";
  return "pending";
}

/**
 * Rows that are another app's orders under Q-Shop's prefix (Q-Shops writes
 * `q-store-order-…` too): left out of a list, its counts and its filters, as
 * the original leaves out what isn't its order, and only counted in a line
 * under the list. Everything else is kept, in order.
 */
export function splitForeignItems(items: OrderListItem[]): { rest: OrderListItem[]; foreign: OrderListItem[] } {
  const rest: OrderListItem[] = [];
  const foreign: OrderListItem[] = [];
  for (const item of items) (item.openState === "foreign" && !item.order ? foreign : rest).push(item);
  return { rest, foreign };
}

/** Another app's orders by app, most first: "8 in Q-Shops". */
export function foreignAppCounts(foreign: OrderListItem[]): { name: string; link: string | null; count: number }[] {
  const byApp = new Map<string, { name: string; link: string | null; count: number }>();
  for (const item of foreign) {
    const name = item.foreignApp?.name ?? "another app";
    const known = byApp.get(name);
    if (known) known.count += 1;
    else byApp.set(name, { name, link: item.foreignApp?.link ?? null, count: 1 });
  }
  return [...byApp.values()].sort((a, b) => b.count - a.count);
}

/** Shipped or Refunded by the seller's own status document: that settles the row without opening the order. */
export function settledByStatus(status: OrderStatusInfo | null | undefined): boolean {
  if (status?.state !== "known") return false;
  const normal = normalizeStatus(status.status);
  return normal === "Shipped" || normal === "Refunded";
}

/** A seller's rows: the ones the list shows and counts, and the ones it shows apart. */
export function splitSellerItems(items: OrderListItem[], seller: string): { main: OrderListItem[]; others: OrderListItem[] } {
  const main: OrderListItem[] = [];
  const others: OrderListItem[] = [];
  for (const item of items) (sellerRowKind(item, seller) === "other" ? others : main).push(item);
  return { main, others };
}

/**
 * The status a seller's row counts as, or null (not counted, or not yet):
 * "Received" (To handle) only for an opened order that names this seller;
 * Shipped and Refunded as the seller's own status document says, Delivered
 * as the buyer's confirmation does (orders/status.ts shownStatus).
 */
export function sellerCountedStatus(item: OrderListItem, seller: string): ShownStatus | null {
  const kind = sellerRowKind(item, seller);
  if (kind === "other" || item.status?.state !== "known") return null;
  const normal = normalizeStatus(item.status.status);
  if (normal === "Received") return kind === "mine" ? "Received" : null;
  return normal;
}

/**
 * Counts for a seller's list, and whether any row is still undecided (an
 * order still opening, or a status still being read): its count would be
 * too low until then.
 */
export function sellerStatusCounts(items: OrderListItem[], seller: string): { counts: StatusCounts; loading: boolean } {
  const counts: StatusCounts = { Received: 0, Shipped: 0, Delivered: 0, Refunded: 0, unknown: 0 };
  let loading = false;
  for (const item of items) {
    const kind = sellerRowKind(item, seller);
    if (kind === "other") continue;
    const counted = sellerCountedStatus(item, seller);
    if (counted) counts[counted] += 1;
    else {
      counts.unknown += 1;
      if (kind === "pending" || !item.status) loading = true;
    }
  }
  return { counts, loading };
}

/**
 * Sorts first in a seller's "All": no status yet ("Received"), or one still
 * loading. Rows that aren't the seller's are kept out before this (splitSellerItems).
 */
export function isToHandle(item: OrderListItem): boolean {
  if (!item.status) return true;
  return item.status.state === "known" && normalizeStatus(item.status.status) === "Received";
}

function matchesSearch(item: OrderListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const names = [item.row.user, item.order?.delivery?.customerName, item.order?.storeName, item.order?.sellerName];
  return names.some((n) => typeof n === "string" && n.toLowerCase().includes(q));
}

/**
 * The rows a list shows for a status filter and a search over the loaded
 * orders (buyer or customer name, shop). Newest first; the seller's "All"
 * puts the orders to handle first. For a seller, pass the rows the list
 * counts (splitSellerItems' `main`) and `seller`: "To handle" then holds
 * only opened orders that name this seller.
 */
export function visibleItems(
  items: OrderListItem[],
  opts: { filter: StatusFilter; search?: string; role: "buyer" | "seller"; seller?: string }
): OrderListItem[] {
  let rows = items.filter((item) => matchesSearch(item, opts.search ?? ""));
  if (opts.filter !== "all") {
    rows =
      opts.role === "seller" && opts.seller !== undefined
        ? rows.filter((item) => sellerCountedStatus(item, opts.seller as string) === opts.filter)
        : rows.filter((item) => item.status?.state === "known" && normalizeStatus(item.status.status) === opts.filter);
  }
  if (opts.role === "seller" && opts.filter === "all") {
    rows = [...rows.filter(isToHandle), ...rows.filter((item) => !isToHandle(item))];
  }
  return rows;
}
