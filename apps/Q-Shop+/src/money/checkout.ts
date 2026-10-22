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
 * New, additive: Qortal assets through TRANSFER_ASSET. Before an asset is
 * paid, its info is read from the node (qdn/assets.ts, cached): an asset the
 * node doesn't know, one that can't be transferred, or a total that isn't a
 * whole number of an indivisible asset stops the checkout before Hub is
 * asked for anything (Core would refuse the transfer).
 */
import { isHubDecline, isHubTimeout, errorMessage } from "../qdn/hubErrors";
import { orderIdentifier, orderMailIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { fetchQdnJson, resourceExists, invalidateQdnSearches } from "../qdn/search";
import { assetInfo, isWholeAmount } from "../qdn/assets";
import { assetIdOf, coinLabel, isForeignTicker, payoutAddress, type ShopCoinSettings } from "./coins";
import {
  buildOrder,
  buildOrderDetails,
  buildOrderMail,
  buildOrderMailHtml,
  buildOrderPublish,
  digitalDelivery,
  orderLines,
  type CartLine,
  type DeliveryInput,
  type OrderDetails,
  type PaymentRecord,
} from "./order";
import {
  paymentsUsedByOtherOrders,
  pendingDelivery,
  rememberUsedPayment,
  removePendingOrder,
  runningRecording,
  savePendingOrder,
  trackRecording,
  type OrderPart,
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
  // No other coin gets past paymentRequest; should one ever be paid, its order still records where the money went.
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

/** Is the seller's Q-Mail about this pending order already on QDN? */
export async function isOrderMailSent(pending: PendingOrder): Promise<boolean> {
  return resourceExists(
    "MAIL_PRIVATE",
    pending.buyer.name,
    orderMailIdentifier(pending.store.owner, pending.seller.address, pending.mailUid),
    { fresh: true }
  );
}

/** The two resources of an order's publish, in the order they are sent. */
const ORDER_PARTS: OrderPart[] = ["order", "mail"];

/**
 * What Hub says didn't publish: `{error: {unsuccessfulPublishes: [{identifier,
 * reason}]}}`, as a rejection (or, defensively, as an answer).
 */
function unsuccessfulPublishes(value: unknown): { identifier: string; reason: string }[] {
  const list = (value as { error?: { unsuccessfulPublishes?: unknown } } | null)?.error?.unsuccessfulPublishes;
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => typeof item?.identifier === "string")
    .map((item) => ({ identifier: item.identifier as string, reason: typeof item?.reason === "string" ? item.reason : "" }));
}

/**
 * A pending order stored without its product pictures (localStorage was
 * full, pendingOrders.ts) gets them back from the seller's catalogues before
 * it is published, so the seller sees the pictures as in every other order.
 * Only `images` is put back, from the product as its catalogue holds it now.
 * Best effort: a catalogue that can't be read leaves those lines without
 * pictures, and the paid order is published anyway.
 */
export async function withImagesRefilled(pending: PendingOrder): Promise<PendingOrder> {
  if (!pending.imagesStripped) return pending;
  const details: Record<string, unknown> = { ...pending.details };
  const catalogues = new Map<string, Promise<any>>();
  for (const [productId, line] of orderLines(pending.details)) {
    const product = line?.product;
    if (!product || typeof product !== "object" || !line.catalogueId) continue;
    if (Array.isArray(product.images) && product.images.length > 0) continue;
    if (!catalogues.has(line.catalogueId)) {
      catalogues.set(line.catalogueId, fetchQdnJson("DOCUMENT", pending.store.owner, line.catalogueId).catch(() => null));
    }
    const catalogue = await catalogues.get(line.catalogueId);
    const images: unknown = catalogue?.products?.[productId]?.images;
    if (Array.isArray(images) && images.length > 0 && images.every((image) => typeof image === "string")) {
      details[productId] = { ...line, product: { ...product, images } };
    }
  }
  return { ...pending, details: details as OrderDetails };
}

/**
 * The order is on QDN: it leaves the pending list, and its payment is
 * remembered as used, so "Check again" never gives it to another order.
 */
function orderRecorded(pending: PendingOrder): void {
  rememberUsedPayment(pending.buyer.name, pending.orderUid, pending.payment?.transactionSignature);
  removePendingOrder(pending.buyer.name, pending.orderUid);
}

/**
 * Publishes a paid order: the order and the seller's Q-Mail. Checks QDN
 * first unless `skipCheck` (a first attempt right after paying), and sends
 * only the part that isn't there yet: when Hub published one of the two and
 * not the other, Finish sends the missing one (the same identifier and JSON
 * as before), so the seller always gets the mail as well as the order.
 * Removes the pending order once both are there.
 *
 * One recording per order at a time: while one runs (until Hub answers, up
 * to its 30 minutes), another call for the same order gets the running one's
 * result instead of a second publish (isRecordingOrder tells the cards).
 */
export function recordOrder(
  pending: PendingOrder,
  delivery: DeliveryInput,
  options: { skipCheck?: boolean; onStep?: (step: CheckoutStep) => void } = {}
): Promise<CheckoutResult> {
  const running = runningRecording<CheckoutResult>(pending.orderUid);
  if (running) return running;
  return trackRecording(pending.orderUid, recordOrderNow(pending, delivery, options));
}

async function recordOrderNow(
  pending: PendingOrder,
  delivery: DeliveryInput,
  options: { skipCheck?: boolean; onStep?: (step: CheckoutStep) => void }
): Promise<CheckoutResult> {
  const done = (): CheckoutResult => {
    orderRecorded(pending);
    return { kind: "done", orderUid: pending.orderUid };
  };
  // What Hub already reported published (a partial publish) needn't go again.
  let parts = ORDER_PARTS.filter((part) => !pending.published?.includes(part));
  let sent: { part: OrderPart; identifier: string }[] = [];
  try {
    if (parts.length === 0) return done();
    if (!options.skipCheck) {
      options.onStep?.("checking");
      const onQdn = await Promise.all(
        parts.map((part) => (part === "order" ? isOrderRecorded(pending) : isOrderMailSent(pending)).catch(() => false))
      );
      parts = parts.filter((_, i) => !onQdn[i]);
      if (parts.length === 0) return done();
    }
    options.onStep?.("recording");
    const request = publishOrderRequest(parts.includes("order") ? await withImagesRefilled(pending) : pending, delivery);
    const resources = request.resources.filter((_, i) => parts.includes(ORDER_PARTS[i]));
    sent = resources.map((resource) => ({ part: ORDER_PARTS[request.resources.indexOf(resource)], identifier: resource.identifier }));
    const answer = await qortalRequestWithTimeout({ ...request, resources }, PUBLISH_TIMEOUT_MS);
    // A failure Hub answers instead of rejecting is still a failure.
    if (answer && typeof answer === "object" && !Array.isArray(answer) && (answer as { error?: unknown }).error) throw answer;
    invalidateQdnSearches((url) => url.includes("DOCUMENT_PRIVATE") || url.includes("MAIL_PRIVATE"));
    return done();
  } catch (error) {
    // Hub names what it couldn't publish; the rest of what was sent is on QDN
    // (unless the buyer cancelled: Hub then removes what it had published).
    const failed = isHubDecline(error) ? [] : unsuccessfulPublishes(error);
    const landed = failed.length > 0 ? sent.filter((s) => !failed.some((f) => f.identifier === s.identifier)).map((s) => s.part) : [];
    const published = [...new Set([...(pending.published ?? []), ...landed])];
    const mailReason = failed.find((f) => sent.some((s) => s.part === "mail" && s.identifier === f.identifier))?.reason;
    const message =
      published.includes("order") && !published.includes("mail")
        ? `Your order was recorded, but the seller's Q-Mail about it wasn't sent${mailReason ? ` (${mailReason})` : ""}. Finish the order to send it; you won't pay again.`
        : isHubDecline(error)
          ? "You declined recording the order. Your payment went through: finish the order to send it to the seller."
          : isHubTimeout(error)
            ? "Hub didn't confirm the order in time. It may still arrive; check again before publishing it again."
            : `The order couldn't be recorded: ${errorMessage(error, "unknown error")}. Your payment went through; try again.`;
    savePendingOrder({ ...pending, ...(published.length > 0 ? { published } : {}), lastError: message }, delivery);
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
/**
 * Why an asset payment can't go through, from the node's info on the asset,
 * or null (also when the node can't be asked: Hub then has the last word).
 */
export async function assetPaymentProblem(coin: string, amount: string, shop: ShopCoinSettings): Promise<string | null> {
  const assetId = assetIdOf(coin);
  if (assetId === null) return null;
  const label = coinLabel(coin, shop);
  const info = await assetInfo({ id: assetId }).catch(() => undefined);
  if (info === undefined) return null;
  if (info === null) return `${label} (asset #${assetId}) isn't on your node, so it can't be paid. Pick another coin.`;
  if (info.isUnspendable) return `${label} can't be transferred, so it can't be paid. Pick another coin.`;
  if (info.isDivisible === false && !isWholeAmount(amount)) {
    return `${label} can only be paid in whole units, and this order comes to ${Number(amount)}. Change the quantities or pick another coin.`;
  }
  return null;
}

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
  const assetProblem = await assetPaymentProblem(coin, amount, shop);
  if (assetProblem) return { kind: "failed", message: assetProblem };

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
 * How long after the checkout started a payment can still be this order's.
 * Hub signs it when the buyer accepts its dialog, which closes a minute or so
 * after Hub stopped answering; this leaves ample room without matching a
 * same-amount payment made much later for something else.
 */
export const PAYMENT_MATCH_WINDOW_MS = 30 * 60_000;

/** A payment that could be the one Hub didn't confirm. */
export interface PaymentCandidate {
  signature: string;
  timestamp: number;
}

export type PaymentSearch =
  | { kind: "none" }
  | { kind: "found"; signature: string }
  /** More than one payment fits: the buyer picks; none is taken on its own. */
  | { kind: "several"; candidates: PaymentCandidate[] };

/**
 * For a payment Hub didn't confirm: looks through the buyer's latest QORT
 * payments or asset transfers for one to the recipient, for the amount,
 * signed at or after the checkout started (Hub signs on the same clock,
 * after the Pay press) and within PAYMENT_MATCH_WINDOW_MS, whose signature
 * no other order uses (recorded from this device, or still pending). Foreign
 * coins can't be checked from here. Rejects when the node can't answer.
 */
export async function findUnconfirmedPayment(pending: PendingOrder): Promise<PaymentSearch> {
  const assetId = assetIdOf(pending.coin);
  if (pending.coin !== "QORT" && assetId === null) return { kind: "none" };
  const txType = assetId === null ? "PAYMENT" : "TRANSFER_ASSET";
  const url = `/transactions/search?txType=${txType}&address=${encodeURIComponent(
    pending.buyer.address
  )}&confirmationStatus=BOTH&limit=20&reverse=true`;
  const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!response.ok) throw new Error(`the node answered ${response.status}`);
  const rows: unknown = await response.json().catch(() => []);
  if (!Array.isArray(rows)) return { kind: "none" };
  const used = paymentsUsedByOtherOrders(pending.buyer.name, pending.orderUid);
  const candidates: PaymentCandidate[] = [];
  for (const tx of rows) {
    const signature = typeof tx?.signature === "string" ? tx.signature : "";
    const timestamp = Number(tx?.timestamp);
    if (
      signature &&
      !used.has(signature) &&
      !candidates.some((c) => c.signature === signature) &&
      tx?.recipient === pending.recipient &&
      Number(tx?.amount) === Number(pending.amount) &&
      (assetId === null || Number(tx?.assetId) === assetId) &&
      timestamp >= pending.created &&
      timestamp <= pending.created + PAYMENT_MATCH_WINDOW_MS
    ) {
      candidates.push({ signature, timestamp });
    }
  }
  if (candidates.length === 0) return { kind: "none" };
  if (candidates.length === 1) return { kind: "found", signature: candidates[0].signature };
  return { kind: "several", candidates: candidates.sort((a, b) => a.timestamp - b.timestamp) };
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
