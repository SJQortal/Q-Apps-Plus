/**
 * Order statuses as the seller writes them: "Received", "Shipped" or
 * "Refunded" (src/qdn/payloads.ts ORDER_STATUSES). No status document means
 * "Received", as in the original.
 */
import { ORDER_STATUSES, type OrderStatus } from "../qdn/payloads";
import type { OrderStatusInfo } from "../state/features/orderSlice";

export { ORDER_STATUSES, type OrderStatus };

/** The three statuses, or null for anything else (an old typo, another app's value). */
export function normalizeStatus(value: unknown): OrderStatus | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return ORDER_STATUSES.find((s) => s.toLowerCase() === v) ?? null;
}

/** What a status document's JSON says. */
export function statusInfoFrom(json: any, updated: number): OrderStatusInfo {
  const raw = typeof json?.status === "string" ? json.status : "";
  return {
    state: "known",
    status: normalizeStatus(raw) ?? raw.trim(),
    note: typeof json?.note === "string" ? json.note : "",
    updated,
  };
}

/** No status document: the order is "Received". */
export const NO_STATUS_DOCUMENT: OrderStatusInfo = { state: "known", status: "Received", note: "", updated: 0 };

/** Theme colour for a status chip (never a hard-coded yellow: Bugs 10). */
export function statusColor(status: string | undefined): "warning" | "success" | "error" | "default" {
  switch (normalizeStatus(status)) {
    case "Received":
      return "warning";
    case "Shipped":
      return "success";
    case "Refunded":
      return "error";
    default:
      return "default";
  }
}

/** The filter chips: each status, and "all". */
export type StatusFilter = "all" | OrderStatus;

/** How a status reads for a role: the seller's "Received" is an order still to handle. */
export function statusLabel(status: string, role: "buyer" | "seller"): string {
  const normal = normalizeStatus(status);
  if (normal === "Received") return role === "seller" ? "To handle" : "Received";
  return normal ?? (status || "Unknown");
}

export interface StatusCounts {
  Received: number;
  Shipped: number;
  Refunded: number;
  /** Orders whose status is still loading or couldn't be read. */
  unknown: number;
}

/** Counts over the loaded orders' statuses (by order id). */
export function countStatuses(orderIds: string[], statuses: Record<string, OrderStatusInfo | undefined>): StatusCounts {
  const counts: StatusCounts = { Received: 0, Shipped: 0, Refunded: 0, unknown: 0 };
  for (const id of orderIds) {
    const info = statuses[id];
    const normal = info?.state === "known" ? normalizeStatus(info.status) : null;
    if (normal) counts[normal] += 1;
    else counts.unknown += 1;
  }
  return counts;
}

/** "3", or "3+" while more pages exist. */
export function countLabel(count: number, more: boolean): string {
  return more ? `${count}+` : String(count);
}
