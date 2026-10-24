/**
 * Order statuses as the seller writes them: "Received", "Shipped" or
 * "Refunded" (src/qdn/payloads.ts ORDER_STATUSES). No status document means
 * "Received", as in the original.
 *
 * What an order shows adds one: "Delivered", once its buyer said it arrived
 * (orders/delivered.ts), unless the seller refunded it (shownStatus). The
 * seller's own status, and their status form, stay the three.
 */
import { ORDER_STATUSES, type OrderStatus } from "../qdn/payloads";
import type { DeliveredInfo, OrderStatusInfo } from "../state/features/orderSlice";

export { ORDER_STATUSES, type OrderStatus };

/** The statuses an order shows, in their order. */
export const SHOWN_STATUSES = ["Received", "Shipped", "Delivered", "Refunded"] as const;
export type ShownStatus = (typeof SHOWN_STATUSES)[number];

/** One of the statuses, or null for anything else (an old typo, another app's value). */
export function normalizeStatus(value: unknown): ShownStatus | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return SHOWN_STATUSES.find((s) => s.toLowerCase() === v) ?? null;
}

/**
 * The status an order shows: "Delivered" once its buyer confirmed it (the
 * seller's note kept), unless the seller refunded it; else the seller's.
 * Nothing until the seller's status is read, so it doesn't flicker.
 */
export function shownStatus(status: OrderStatusInfo | null, delivered: DeliveredInfo | null | undefined): OrderStatusInfo | null {
  if (!status || !delivered) return status;
  if (status.state === "known" && normalizeStatus(status.status) === "Refunded") return status;
  return { ...status, state: "known", status: "Delivered" };
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
export function statusColor(status: string | undefined): "warning" | "primary" | "success" | "error" | "default" {
  switch (normalizeStatus(status)) {
    case "Received":
      return "warning";
    case "Shipped":
      return "primary";
    case "Delivered":
      return "success";
    case "Refunded":
      return "error";
    default:
      return "default";
  }
}

/** The filter chips: each status, and "all". */
export type StatusFilter = "all" | ShownStatus;

/** How a status reads for a role: the seller's "Received" is an order still to handle. */
export function statusLabel(status: string, role: "buyer" | "seller"): string {
  const normal = normalizeStatus(status);
  if (normal === "Received") return role === "seller" ? "To handle" : "Received";
  return normal ?? (status || "Unknown");
}

export interface StatusCounts {
  Received: number;
  Shipped: number;
  Delivered: number;
  Refunded: number;
  /** Orders whose status is still loading or couldn't be read. */
  unknown: number;
}

/** Counts over the loaded orders' statuses (by order id). */
export function countStatuses(orderIds: string[], statuses: Record<string, OrderStatusInfo | undefined>): StatusCounts {
  const counts: StatusCounts = { Received: 0, Shipped: 0, Delivered: 0, Refunded: 0, unknown: 0 };
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
