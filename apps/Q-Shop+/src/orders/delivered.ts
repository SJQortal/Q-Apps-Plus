/**
 * The buyer's "it arrived" (Simon, 2026-10-24: "for the buyers, there should
 * be mark as 'Delivered' options after the product was shipped, and then the
 * user can make a review").
 *
 * The seller's status document is the seller's (DOCUMENT_PRIVATE under the
 * seller's name), so the buyer can't change it. Instead the buyer publishes
 * a small public DOCUMENT of their own, `q-store-delivered-<short>-<uid10>`
 * (the order id with `order` turned into `delivered`; qdn/payloads.ts
 * buildDeliveredPublish). Its being there under the order's buyer is what
 * counts, so it is read with searches alone, never fetched:
 * - the buyer's list: one search for all of the buyer's (paged by 100, at most 500);
 * - a shop's list: one search for every buyer's of the shop, matched to each
 *   order by its buyer, and the shop compared exactly (`my-shop-` also
 *   finds `my-shop-2`'s);
 * - one order: an exact identifier under the buyer's name.
 * The original never reads them, and the seller's status is untouched.
 */
import { invalidateQdnSearches, searchQdn, searchQdnAll, type QdnResourceSummary } from "../qdn/search";
import {
  DELIVERED_BASE,
  deliveredIdentifierForOrder,
  orderIdForDelivered,
  shopDeliveredPrefix,
  shortStoreIdOfOrder,
} from "../qdn/identifiers";
import { buildDeliveredPublish } from "../qdn/payloads";
import { isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";
import { deliveredRestored, deliveredSending, deliveredSent, type DeliveredInfo, type Order } from "../state/features/orderSlice";
import { STATUS_MAX_PAGES, STATUS_PAGE, sameName } from "./reads";
import type { OrderStore } from "./loader";

/** Confirmations by buyer and order (`<buyer, lower case>\n<orderId>`), and whether the search saw them all. */
export interface DeliveredIndex {
  rows: Map<string, DeliveredInfo>;
  complete: boolean;
}

const indexKey = (buyer: string, orderId: string) => `${buyer.toLowerCase()}\n${orderId}`;

function indexOf(rows: QdnResourceSummary[], complete: boolean, keep: (orderId: string) => boolean): DeliveredIndex {
  const out = new Map<string, DeliveredInfo>();
  for (const row of rows) {
    if (!row.name || !row.identifier.startsWith(`${DELIVERED_BASE}-`)) continue;
    const orderId = orderIdForDelivered(row.identifier);
    if (!keep(orderId)) continue;
    const key = indexKey(row.name, orderId);
    const at = row.created ?? 0;
    const current = out.get(key);
    if (!current || at < current.at) out.set(key, { at });
  }
  return { rows: out, complete };
}

/** Every confirmation the buyer published. */
export async function buyerDeliveredIndex(buyer: string, fresh = false): Promise<DeliveredIndex> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: `${DELIVERED_BASE}-`, prefix: true, name: buyer, exactmatchnames: true, reverse: true },
    { pageSize: STATUS_PAGE, maxPages: STATUS_MAX_PAGES, fresh }
  );
  return indexOf(
    rows.filter((r) => sameName(r.name, buyer)),
    complete,
    (orderId) => shortStoreIdOfOrder(orderId) !== null
  );
}

/** Every buyer's confirmations of one shop's orders. */
export async function shopDeliveredIndex(shortStoreId: string, fresh = false): Promise<DeliveredIndex> {
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: shopDeliveredPrefix(shortStoreId), prefix: true, reverse: true },
    { pageSize: STATUS_PAGE, maxPages: STATUS_MAX_PAGES, fresh }
  );
  return indexOf(rows, complete, (orderId) => shortStoreIdOfOrder(orderId) === shortStoreId);
}

/**
 * An order's confirmation from an index: its buyer's, or null when the index
 * saw every row and it isn't there (undefined: not known yet).
 */
export function deliveredFrom(index: DeliveredIndex | null, order: { id: string; user: string }): DeliveredInfo | null | undefined {
  if (!index) return undefined;
  return index.rows.get(indexKey(order.user, order.id)) ?? (index.complete ? null : undefined);
}

/** One order's confirmation, by its buyer's name: exact identifier, at most one row. */
export async function findDelivered(order: { id: string; user: string }, fresh = false): Promise<DeliveredInfo | null> {
  const identifier = deliveredIdentifierForOrder(order.id);
  const rows = await searchQdn(
    { service: "DOCUMENT", identifier, name: order.user, exactmatchnames: true, limit: 1, includemetadata: false },
    { fresh }
  );
  const row = rows.find((r) => r.identifier === identifier && sameName(r.name, order.user));
  return row ? { at: row.created ?? 0 } : null;
}

export type DeliveredResult = "sent" | "declined" | "timeout" | "failed";

/**
 * The buyer marks their order delivered: shown at once, and put back if the
 * publish doesn't happen (a decline in Hub's dialog is quiet). Hub gets its
 * 30 minutes (docs/QORTAL.md → pitfall 10).
 */
export async function markDelivered(store: OrderStore, order: Order, now = Date.now()): Promise<DeliveredResult> {
  const previous = store.getState().order.delivered[order.id];
  store.dispatch(deliveredSending({ orderId: order.id, at: now }));
  try {
    await qortalRequestWithTimeout(buildDeliveredPublish({ orderId: order.id, buyer: order.user, at: now }), PUBLISH_TIMEOUT_MS);
    store.dispatch(deliveredSent({ orderId: order.id }));
    invalidateQdnSearches((url) => url.includes(`identifier=${encodeURIComponent(DELIVERED_BASE)}`));
    return "sent";
  } catch (error) {
    store.dispatch(deliveredRestored({ orderId: order.id, previous }));
    if (isHubDecline(error)) return "declined";
    if (isHubTimeout(error)) return "timeout";
    return "failed";
  }
}
