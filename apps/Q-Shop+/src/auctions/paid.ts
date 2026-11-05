/**
 * Auctions this device paid for (the winning bid's id per product), so the
 * winner isn't offered to pay again. Local only: an order paid from another
 * device shows in My orders.
 */
import { STORAGE_PREFIX } from "../constants/plus";

export const AUCTIONS_PAID_STORAGE_KEY = `${STORAGE_PREFIX}auctions-paid`;

function read(): Record<string, { bid: string; at: number }> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(AUCTIONS_PAID_STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, { bid: string; at: number }>) : {};
  } catch {
    return {};
  }
}

/** This device paid for the winning bid `bidId` on the product. */
export function isAuctionPaid(productId: string, bidId: string): boolean {
  return read()[productId]?.bid === bidId;
}

export function noteAuctionPaid(productId: string, bidId: string, at = Date.now()): void {
  try {
    localStorage.setItem(AUCTIONS_PAID_STORAGE_KEY, JSON.stringify({ ...read(), [productId]: { bid: bidId, at } }));
  } catch {
    // Storage is full or blocked: the result step still says it's paid.
  }
}
