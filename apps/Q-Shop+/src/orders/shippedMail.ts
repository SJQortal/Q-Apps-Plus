/**
 * The Q-Mail to the buyer when an order ships (Simon, 2026-11-01: the seller
 * is asked after marking it Shipped): what was sent, the carrier and tracking
 * number, and the seller's note, as text the seller can change first. It is
 * an ordinary Q-Mail (MAIL_PRIVATE under the seller's name, in the identifier
 * and JSON the order mail uses, money/order.ts), encrypted to the buyer and
 * the seller, with nothing about the order in its public metadata. Sending it
 * again with the same uid replaces it, so a retry never makes a second mail.
 */
import { APP_NAME } from "../constants/plus";
import { PUBLISH_TIMEOUT_MS } from "../money/checkout";
import { escapeHtml } from "../money/order";
import { jsonToBase64 } from "../qdn/payloads";
import { orderMailIdentifier } from "../qdn/identifiers";
import { isHubDecline, isHubTimeout } from "../qdn/hubErrors";
import type { Order } from "../state/features/orderSlice";
import { orderItems } from "./format";
import type { Tracking } from "./tracking";

export type ShippedMailResult = "sent" | "declined" | "timeout" | "failed";

const shopOf = (order: Order) => order.storeName || order.sellerName || "the shop";

/** The message as the seller first sees it: a part per blank line. */
export function shippedMailText(order: Order, tracking: Tracking | null, note: string): string {
  const items = orderItems(order).map((item) => `${item.quantity} × ${item.title}`);
  const parcel = tracking?.number ? [...(tracking.carrier ? [`Carrier: ${tracking.carrier}`] : []), `Tracking number: ${tracking.number}`] : [];
  return [`Your order from ${shopOf(order)} has been shipped.`, items.join("\n"), parcel.join("\n"), note.trim()].filter(Boolean).join("\n\n");
}

/** The message as the mail's HTML; what was typed is escaped. */
export function shippedMailHtml(text: string): string {
  const parts = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p style="margin: 0 0 12px;">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`);
  return `<div style="text-align: left; line-height: 1.5;">
    ${parts.join("\n    ")}
    <p style="margin: 28px 0 0; padding-top: 12px; border-top: 1px solid rgba(128, 128, 128, 0.35); font-size: 13px; opacity: 0.75;">
      Sent by ${escapeHtml(APP_NAME)} when your order shipped. It's in My orders, where you can mark it delivered when it arrives; reply to this message to write to the seller.
    </p>
  </div>`;
}

export function buildShippedMailPublish(args: {
  order: Order;
  text: string;
  seller: string;
  buyerAddress: string;
  buyerPublicKey: string;
  sellerPublicKey: string;
  uid: string;
  now: number;
}) {
  const { order, text, seller, buyerAddress, buyerPublicKey, sellerPublicKey, uid, now } = args;
  const mail = {
    title: `Order from ${shopOf(order)} shipped to ${order.user}`,
    subject: `Your order from ${shopOf(order)} has been shipped`.slice(0, 120),
    createdAt: now,
    version: 1,
    attachments: [],
    textContent: "",
    htmlContent: shippedMailHtml(text),
    generalData: { thread: [] },
    recipient: order.user,
  };
  return {
    action: "PUBLISH_QDN_RESOURCE" as const,
    name: seller,
    service: "MAIL_PRIVATE",
    identifier: orderMailIdentifier(order.user, buyerAddress, uid),
    data64: jsonToBase64(mail),
    encrypt: true,
    publicKeys: [buyerPublicKey, sellerPublicKey],
  };
}

/** Sends it: the buyer's key is looked up fresh, as for the status (orders/statusUpdate.ts). */
export async function sendShippedMail(args: { order: Order; text: string; seller: string; sellerPublicKey: string; uid: string }): Promise<ShippedMailResult> {
  try {
    const nameData = await qortalRequest({ action: "GET_NAME_DATA", name: args.order.user });
    const account = await qortalRequest({ action: "GET_ACCOUNT_DATA", address: nameData?.owner });
    if (!nameData?.owner || !account?.publicKey) throw new Error("Cannot find the buyer's account");
    await qortalRequestWithTimeout(
      buildShippedMailPublish({ ...args, buyerAddress: nameData.owner, buyerPublicKey: account.publicKey, now: Date.now() }),
      PUBLISH_TIMEOUT_MS
    );
    return "sent";
  } catch (error) {
    if (isHubDecline(error)) return "declined";
    if (isHubTimeout(error)) return "timeout";
    return "failed";
  }
}
