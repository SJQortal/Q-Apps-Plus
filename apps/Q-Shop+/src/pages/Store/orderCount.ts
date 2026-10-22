/**
 * How many orders a shop has received, for its page (community request,
 * 2026-10-22: "it might be nice to see how many orders the merchant has
 * received"). Read-only, from data the original already writes: every order
 * is a DOCUMENT_PRIVATE `q-store-order-<shortStoreId>-<uid>` under the
 * buyer's name, so one search of that prefix (all names) counts them.
 *
 * What it can't know, and how that is handled:
 * - Orders are encrypted and carry only the short shop id, so another
 *   name's shop with the same id (live or deleted) gets the same orders:
 *   then no count is shown at all (`shared`), rather than a wrong one.
 * - The owner's own orders (tests, mostly) don't count, nor do orders
 *   older than the shop (a shop id used before, by its owner or another).
 * - Anyone can publish an order id for a fee, as with reviews; the page
 *   says "orders", not "sales".
 * At most ORDER_COUNT_CAP are read ("1,000+ orders").
 */
import { useEffect, useState } from "react";
import { searchQdn, searchQdnAll } from "../../qdn/search";
import { shopOrdersPrefix, shortStoreIdOf, shortStoreIdOfOrder, storeIdentifier } from "../../qdn/identifiers";

export const ORDER_COUNT_PAGE = 100;
export const ORDER_COUNT_MAX_PAGES = 10;
export const ORDER_COUNT_CAP = ORDER_COUNT_PAGE * ORDER_COUNT_MAX_PAGES;

export type OrderCount =
  | { kind: "count"; count: number; capped: boolean }
  /** Another name has a shop with this id, so its orders can't be told apart. */
  | { kind: "shared" };

/** True when a name other than `owner` publishes (or published) a shop with exactly this id. */
export async function isShopIdShared(owner: string, storeId: string, options: { fresh?: boolean } = {}): Promise<boolean> {
  const identifier = storeIdentifier(shortStoreIdOf(storeId));
  // A prefix search, compared exactly: Core's prefix also finds longer ids ("my-shop-2").
  const rows = await searchQdn(
    { service: "STORE", identifier, prefix: true, includemetadata: false, limit: 50 },
    options
  );
  return rows.some((row) => row.identifier === identifier && row.name !== owner);
}

export async function fetchOrderCount(
  owner: string,
  storeId: string,
  /** The shop's `created`: older orders were for an earlier shop with this id. */
  since: number | undefined,
  options: { fresh?: boolean } = {}
): Promise<OrderCount> {
  const shortStoreId = shortStoreIdOf(storeId);
  if (!shortStoreId) return { kind: "count", count: 0, capped: false };
  const [shared, orders] = await Promise.all([
    isShopIdShared(owner, storeId, options),
    searchQdnAll(
      { service: "DOCUMENT_PRIVATE", identifier: shopOrdersPrefix(shortStoreId), prefix: true, includemetadata: false, reverse: true },
      { pageSize: ORDER_COUNT_PAGE, maxPages: ORDER_COUNT_MAX_PAGES, fresh: options.fresh }
    ),
  ]);
  if (shared) return { kind: "shared" };
  const from = typeof since === "number" && Number.isFinite(since) && since > 0 ? since : 0;
  const seen = new Set<string>();
  for (const row of orders.rows) {
    if (row.name === owner || shortStoreIdOfOrder(row.identifier) !== shortStoreId) continue;
    if (from && (row.created ?? 0) < from) continue;
    seen.add(`${row.name}\n${row.identifier}`);
  }
  return { kind: "count", count: seen.size, capped: !orders.complete };
}

/** "38 orders", "1 order", "No orders yet", "1,000+ orders". */
export function orderCountLabel(count: OrderCount): string | null {
  if (count.kind !== "count") return null;
  if (count.capped) return `${count.count.toLocaleString("en-US")}+ orders`;
  if (count.count === 0) return "No orders yet";
  return `${count.count.toLocaleString("en-US")} order${count.count === 1 ? "" : "s"}`;
}

/** The shop's order count for its header: null while it loads, or when it can't be read. */
export function useOrderCount(owner: string, storeId: string, since: number | undefined): OrderCount | null {
  const key = `${owner}\n${storeId}\n${since ?? ""}`;
  const [result, setResult] = useState<{ key: string; count: OrderCount | null } | null>(null);
  useEffect(() => {
    if (!owner || !storeId) return;
    let alive = true;
    fetchOrderCount(owner, storeId, since).then(
      (count) => alive && setResult({ key, count }),
      () => alive && setResult({ key, count: null })
    );
    return () => {
      alive = false;
    };
  }, [key, owner, storeId, since]);
  return result?.key === key ? result.count : null;
}
