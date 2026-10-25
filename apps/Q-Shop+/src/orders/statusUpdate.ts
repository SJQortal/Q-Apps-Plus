/**
 * The seller's status update, as the original publishes it (pinned by
 * ShowOrder.pin.test.tsx): GET_NAME_DATA(order's buyer) → GET_ACCOUNT_DATA →
 * PUBLISH_QDN_RESOURCE built by `buildStatusPublish` (DOCUMENT_PRIVATE
 * `q-store-status-order-…`, encrypted to the buyer and the seller).
 *
 * The + app shows the new status at once and puts the old one back if the
 * publish doesn't happen; a decline in Hub's dialog is not an error. The key
 * is looked up fresh for every publish (never from the read cache), as the
 * original does, and Hub gets its 30 minutes (docs/QORTAL.md → pitfall 10).
 */
import type { Tracking } from "./tracking";
import { buildStatusPublish } from "../qdn/payloads";
import { invalidateQdnSearches } from "../qdn/search";
import { shopStatusPrefix, shortStoreIdOfOrder, statusIdentifierForOrder } from "../qdn/identifiers";
import { isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";
import type { Order } from "../state/features/orderSlice";
import { statusRestored, statusSending, statusSent } from "../state/features/orderSlice";
import type { OrderStore } from "./loader";
import { forgetStatus } from "./reads";

export type StatusUpdateResult = "sent" | "declined" | "timeout" | "failed";

export async function sendOrderStatus(
  store: OrderStore,
  args: { order: Order; seller: string; sellerPublicKey: string; status: string; note: string; tracking?: Tracking | null }
): Promise<StatusUpdateResult> {
  const { order, seller, sellerPublicKey, status, note } = args;
  // Only a shipped order carries tracking.
  const tracking = status === "Shipped" && args.tracking?.number.trim() ? args.tracking : null;
  const previous = store.getState().order.statuses[order.id] ?? null;
  store.dispatch(statusSending({ orderId: order.id, status, note, tracking, sentAt: Date.now() }));
  try {
    const nameData = await qortalRequest({ action: "GET_NAME_DATA", name: order.user });
    const account = await qortalRequest({ action: "GET_ACCOUNT_DATA", address: nameData?.owner });
    if (!account?.publicKey) throw new Error("Cannot find the buyer's account");
    const request = buildStatusPublish({
      orderId: order.id,
      seller,
      status,
      note,
      tracking,
      buyerPublicKey: account.publicKey,
      sellerPublicKey,
    });
    await qortalRequestWithTimeout(request, PUBLISH_TIMEOUT_MS);
    store.dispatch(statusSent({ orderId: order.id }));
    forgetStatus(seller, order.id);
    const statusId = statusIdentifierForOrder(order.id);
    const short = shortStoreIdOfOrder(order.id);
    invalidateQdnSearches(
      (url) =>
        url.includes(encodeURIComponent(statusId)) ||
        (short !== null && url.includes(`identifier=${encodeURIComponent(shopStatusPrefix(short))}`)) ||
        url.includes("identifier=q-store-status-order-&")
    );
    return "sent";
  } catch (error) {
    store.dispatch(statusRestored({ orderId: order.id, previous }));
    if (isHubDecline(error)) return "declined";
    if (isHubTimeout(error)) return "timeout";
    return "failed";
  }
}
