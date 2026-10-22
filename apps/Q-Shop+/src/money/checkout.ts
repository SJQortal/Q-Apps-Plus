/**
 * Checkout: pay, then record the order. The calls, their order and their
 * parameters are the original's (pinned by Cart.pin.test.tsx and
 * checkout.test.ts):
 *
 *   GET_NAME_DATA(seller) → owner address → GET_ACCOUNT_DATA → public key
 *   SEND_COIN {coin, destinationAddress, amount}   (amount = total.toFixed(8))
 *   PUBLISH_MULTIPLE_QDN_RESOURCES [order, mail], encrypt, [seller, buyer]
 *
 * What changed, each a fix (docs/apps/Q-Shop+.md → Money code changes):
 * - the paid order is saved (pendingOrders.ts) before it is published, the
 *   cart is emptied, and a failed, declined or timed-out publish is finished
 *   later with the same identifiers, never with a second payment;
 * - before publishing again, QDN is checked for the order (a timed-out
 *   publish may still have landed);
 * - the publish gets Hub's own 30-minute budget instead of 30 s per resource;
 * - a payment Hub didn't answer in time is marked "unconfirmed", and for QORT
 *   and assets the buyer's recent transactions are searched for it;
 * - declines are quiet, and nothing throws outside the flow.
 *
 * New, additive: other coins through SEND_COIN and Qortal assets through
 * TRANSFER_ASSET.
 */
import { isHubDecline, isHubTimeout, errorMessage } from "../qdn/hubErrors";
import { orderIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { resourceExists, invalidateQdnSearches } from "../qdn/search";
import { assetIdOf, coinLabel, isForeignTicker, payoutAddress, type ShopCoinSettings } from "./coins";
import {
  buildOrder,
  buildOrderDetails,
  buildOrderMail,
  buildOrderMailHtml,
  buildOrderPublish,
  digitalDelivery,
  type CartLine,
  type DeliveryInput,
  type OrderDetails,
  type PaymentRecord,
} from "./order";
import {
  pendingDelivery,
  removePendingOrder,
  savePendingOrder,
  type PendingOrder,
} from "./pendingOrders";

/** Hub allows a publish up to 30 minutes (docs/QORTAL.md → pitfall 10). */
export const PUBLISH_TIMEOUT_MS = 30 * 60_000;

export interface CheckoutShop extends ShopCoinSettings {
  id: string;
  title?: string;
  owner: string;
}

export interface CheckoutBuyer {
  name: string;
  address: string;
  publicKey: string;
}

export type CheckoutStep = "seller" | "paying" | "recording" | "checking";

export type CheckoutResult =
  | { kind: "done"; orderUid: string }
  | { kind: "declined" }
  | { kind: "failed"; message: string }
  | { kind: "not-recorded"; orderUid: string; message: string }
  | { kind: "unconfirmed"; orderUid: string };

export interface SellerKeys {
  address: string;
  publicKey: string;
}

/** The seller's Qortal address and public key, as the original looks them up. */
export async function resolveSeller(sellerName: string): Promise<SellerKeys> {
  const res = await qortalRequest({ action: "GET_NAME_DATA", name: sellerName });
  const address = res?.owner;
  const account = await qortalRequest({ action: "GET_ACCOUNT_DATA", address });
  if (!account?.publicKey) throw new Error("Cannot find the store owner");
  return { address, publicKey: account.publicKey };
}

/** Where a payment in `coin` goes, and the Hub request that sends it. */
export function paymentRequest(coin: string, amount: string, sellerAddress: string, shop: ShopCoinSettings) {
  const assetId = assetIdOf(coin);
  if (assetId !== null) {
    return {
      recipient: sellerAddress,
      request: { action: "TRANSFER_ASSET", amount, assetId, recipient: sellerAddress },
    };
  }
  if (coin === "QORT") {
    return {
      recipient: sellerAddress,
      request: { action: "SEND_COIN", coin: "QORT", destinationAddress: sellerAddress, amount },
    };
  }
  if (isForeignTicker(coin)) {
    const address = payoutAddress(shop, coin);
    if (!address) throw new Error(`This shop has not set a ${coin} address`);
    return {
      recipient: address,
      request: { action: "SEND_COIN", coin, destinationAddress: address, amount },
    };
  }
  throw new Error("Currency not found");
}

/** The order's `payment` block for what Hub answered. */
export function paymentRecord(
  coin: string,
  amount: string,
  recipient: string,
  response: any,
  shop: ShopCoinSettings
): PaymentRecord {
  const assetId = assetIdOf(coin);
  if (assetId !== null) {
    return {
      total: amount,
      currency: coin,
      transactionSignature: response?.signature ?? null,
      arrrAddressUsed: "",
      assetId,
      assetName: coinLabel(coin, shop),
    };
  }
  if (coin === "QORT") {
    // The original reads `.signature`; when Hub's answer has none the key is dropped from the JSON.
    return { total: amount, currency: "QORT", transactionSignature: response?.signature, arrrAddressUsed: "" };
  }
  if (coin === "ARRR") {
    return { total: amount, currency: "ARRR", transactionSignature: null, arrrAddressUsed: recipient };
  }
  return {
    total: amount,
    currency: coin,
    transactionSignature: null,
    arrrAddressUsed: "",
    foreignAddressUsed: recipient,
    ...(typeof response === "string" && response ? { foreignTxid: response } : {}),
  };
}

function publishOrderRequest(pending: PendingOrder, delivery: DeliveryInput) {
  if (!pending.payment) throw new Error("The payment isn't confirmed yet");
  const order = buildOrder({
    created: pending.created,
    details: pending.details,
    storeName: pending.store.title,
    sellerName: pending.store.owner,
    delivery,
    payment: pending.payment,
  });
  const html = buildOrderMailHtml({
    details: pending.details,
    storeTitle: pending.store.title,
    currency: pending.payment.currency,
    currencyLabel: pending.currencyLabel,
    isDigital: pending.isDigital,
    buyerName: pending.buyer.name,
    delivery,
    created: pending.created,
  });
  const mail = buildOrderMail({
    shortStoreId: pending.store.shortStoreId,
    buyerName: pending.buyer.name,
    sellerName: pending.store.owner,
    htmlContent: html,
    createdAt: pending.created,
  });
  return buildOrderPublish({
    buyerName: pending.buyer.name,
    shortStoreId: pending.store.shortStoreId,
    orderUid: pending.orderUid,
    mailUid: pending.mailUid,
    sellerName: pending.store.owner,
    sellerAddress: pending.seller.address,
    sellerPublicKey: pending.seller.publicKey,
    buyerPublicKey: pending.buyer.publicKey,
    order,
    mail,
  });
}

/** Is this pending order already on QDN (a publish that timed out may have landed)? */
export async function isOrderRecorded(pending: PendingOrder): Promise<boolean> {
  return resourceExists(
    "DOCUMENT_PRIVATE",
    pending.buyer.name,
    orderIdentifier(pending.store.shortStoreId, pending.orderUid),
    { fresh: true }
  );
}

/**
 * Publishes a paid order. Checks QDN first unless `skipCheck` (a first
 * attempt right after paying). Removes the pending order once it's there.
 */
export async function recordOrder(
  pending: PendingOrder,
  delivery: DeliveryInput,
  options: { skipCheck?: boolean; onStep?: (step: CheckoutStep) => void } = {}
): Promise<CheckoutResult> {
  try {
    if (!options.skipCheck) {
      options.onStep?.("checking");
      if (await isOrderRecorded(pending).catch(() => false)) {
        removePendingOrder(pending.buyer.name, pending.orderUid);
        return { kind: "done", orderUid: pending.orderUid };
      }
    }
    options.onStep?.("recording");
    const request = publishOrderRequest(pending, delivery);
    await qortalRequestWithTimeout(request, PUBLISH_TIMEOUT_MS);
    removePendingOrder(pending.buyer.name, pending.orderUid);
    invalidateQdnSearches((url) => url.includes("DOCUMENT_PRIVATE"));
    return { kind: "done", orderUid: pending.orderUid };
  } catch (error) {
    const message = isHubDecline(error)
      ? "You declined recording the order. Your payment went through: finish the order to send it to the seller."
      : isHubTimeout(error)
        ? "Hub didn't confirm the order in time. It may still arrive; check again before publishing it again."
        : `The order couldn't be recorded: ${errorMessage(error, "unknown error")}. Your payment went through; try again.`;
    savePendingOrder({ ...pending, lastError: message }, delivery);
    return { kind: "not-recorded", orderUid: pending.orderUid, message };
  }
}

export interface StartCheckoutArgs {
  buyer: CheckoutBuyer;
  shop: CheckoutShop;
  lines: CartLine[];
  coin: string;
  rate: number | null;
  isDigital: boolean;
  /** Required for physical orders; digital orders send the buyer's name and an empty address. */
  delivery: DeliveryInput | null;
  orderUid: string;
  mailUid: string;
  now: number;
  /** Called once the payment went through (empty the cart here). */
  onPaid?: (pending: PendingOrder) => void;
  onStep?: (step: CheckoutStep) => void;
}

/** The order's details and amount, before anything is sent (throws MissingPriceError). */
export function priceCheckout(lines: CartLine[], coin: string, rate: number | null): { details: OrderDetails; amount: string } {
  const details = buildOrderDetails(lines, coin, rate);
  return { details, amount: details.totalPrice };
}

export async function startCheckout(args: StartCheckoutArgs): Promise<CheckoutResult> {
  const { buyer, shop, lines, coin, rate, isDigital, orderUid, mailUid, now, onPaid, onStep } = args;
  let details: OrderDetails;
  let amount: string;
  try {
    ({ details, amount } = priceCheckout(lines, coin, rate));
  } catch (error) {
    return { kind: "failed", message: errorMessage(error, "Could not find the price") };
  }
  if (Number(amount) <= 0) return { kind: "failed", message: "You have no items in your cart" };
  const delivery = isDigital ? digitalDelivery(buyer.name) : args.delivery;
  if (!delivery) return { kind: "failed", message: "Please fill in all the required delivery fields" };

  let seller: SellerKeys;
  let payment: ReturnType<typeof paymentRequest>;
  try {
    onStep?.("seller");
    seller = await resolveSeller(shop.owner);
    payment = paymentRequest(coin, amount, seller.address, shop);
  } catch (error) {
    return { kind: "failed", message: errorMessage(error, "Cannot find the store owner") };
  }

  const pending: PendingOrder = {
    version: 1,
    orderUid,
    mailUid,
    state: "unconfirmed",
    created: now,
    updated: now,
    buyer,
    store: { id: shop.id, shortStoreId: shortStoreIdOf(shop.id), title: shop.title, owner: shop.owner },
    seller,
    coin,
    currencyLabel: coinLabel(coin, shop),
    recipient: payment.recipient,
    amount,
    isDigital,
    details,
    payment: null,
  };

  let response: unknown;
  try {
    onStep?.("paying");
    response = await qortalRequest(payment.request);
  } catch (error) {
    if (isHubDecline(error)) return { kind: "declined" };
    if (isHubTimeout(error)) {
      // Hub may still send it (a late Accept applies): keep a record to check.
      savePendingOrder(
        { ...pending, lastError: "Hub didn't answer the payment request in time." },
        delivery
      );
      onPaid?.(pending);
      return { kind: "unconfirmed", orderUid };
    }
    return { kind: "failed", message: errorMessage(error, "The payment failed") };
  }

  const paid: PendingOrder = {
    ...pending,
    state: "paid",
    payment: paymentRecord(coin, amount, payment.recipient, response, shop),
  };
  savePendingOrder(paid, delivery);
  onPaid?.(paid);
  return recordOrder(paid, delivery, { skipCheck: true, onStep });
}

/**
 * For a payment Hub didn't confirm: looks through the buyer's latest QORT
 * payments or asset transfers for one to the recipient, for the amount,
 * made after the checkout started. Foreign coins can't be checked from here.
 */
export async function findUnconfirmedPayment(pending: PendingOrder): Promise<{ signature: string } | null> {
  const assetId = assetIdOf(pending.coin);
  if (pending.coin !== "QORT" && assetId === null) return null;
  const txType = assetId === null ? "PAYMENT" : "TRANSFER_ASSET";
  const url = `/transactions/search?txType=${txType}&address=${encodeURIComponent(
    pending.buyer.address
  )}&confirmationStatus=BOTH&limit=20&reverse=true`;
  const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!response.ok) return null;
  const rows: any[] = await response.json().catch(() => []);
  if (!Array.isArray(rows)) return null;
  const match = rows.find(
    (tx) =>
      tx?.recipient === pending.recipient &&
      Number(tx?.amount) === Number(pending.amount) &&
      (assetId === null || Number(tx?.assetId) === assetId) &&
      Number(tx?.timestamp) >= pending.created - 120_000
  );
  return match?.signature ? { signature: String(match.signature) } : null;
}

/** Marks an unconfirmed payment as paid (found on chain, or confirmed by the buyer for foreign coins). */
export function confirmPendingPayment(
  pending: PendingOrder,
  shop: ShopCoinSettings,
  found: { signature?: string; txid?: string }
): PendingOrder {
  const response = found.signature ? { signature: found.signature } : found.txid ?? null;
  const next: PendingOrder = {
    ...pending,
    state: "paid",
    lastError: undefined,
    payment: paymentRecord(pending.coin, pending.amount, pending.recipient, response, shop),
  };
  savePendingOrder(next, pendingDelivery(pending.orderUid));
  return next;
}
