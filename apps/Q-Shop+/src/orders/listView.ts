import type { OrderListItem } from "./selectors";
import { normalizeStatus, type StatusFilter } from "./status";

/** A seller's order still to handle: no status yet ("Received"), or one still loading. */
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
 * puts the orders to handle first.
 */
export function visibleItems(
  items: OrderListItem[],
  opts: { filter: StatusFilter; search?: string; role: "buyer" | "seller" }
): OrderListItem[] {
  let rows = items.filter((item) => matchesSearch(item, opts.search ?? ""));
  if (opts.filter !== "all") {
    rows = rows.filter((item) => item.status?.state === "known" && normalizeStatus(item.status.status) === opts.filter);
  }
  if (opts.role === "seller" && opts.filter === "all") {
    rows = [...rows.filter(isToHandle), ...rows.filter((item) => !isToHandle(item))];
  }
  return rows;
}
