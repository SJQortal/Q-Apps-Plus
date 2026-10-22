/**
 * How an order says it was paid, and what the paying transaction shows
 * (display only: nothing here sends or changes a payment).
 *
 * - QORT: Hub's SEND_COIN signature (`payment.transactionSignature`).
 * - ARRR: the shop's address paid (`payment.arrrAddressUsed`); Hub gives no
 *   signature, as in the original.
 * - BTC, LTC, DOGE, DGB, RVN (+ app): the address paid
 *   (`payment.foreignAddressUsed`) and Hub's answer (`payment.foreignTxid`).
 * - A Qortal asset (+ app): TRANSFER_ASSET's signature, the asset's id and name.
 *
 * Anyone can encrypt an order to a seller, so for the seller everything in
 * the order is the buyer's claim: the coin is read strictly (a ticker the
 * app knows, or `ASSET:<id>`), an asset is named from the seller's own shop
 * or the node, never from the order's `assetName`, and the order is checked
 * against what the shop accepts. For a Qortal transaction the order dialog
 * also checks what the node says against the order (amount, asset,
 * recipient, sender).
 */
import type { Payment } from "../state/features/orderSlice";
import { assetCoinId, assetIdOf, isCoinTicker, shopCoins, type ShopCoinSettings } from "../money/coins";
import type { PaymentTransaction } from "./reads";

export type PaymentKind = "qort" | "asset" | "foreign";

export interface PaymentSummary {
  kind: PaymentKind;
  /** The coin read strictly: "QORT", a ticker, `ASSET:<id>`, or the order's own text when `known` is false. */
  coin: string;
  /** False when the order names a coin the app doesn't know (shown as "Unknown coin" to the seller). */
  known: boolean;
  /** A Qortal transaction that can be looked up. */
  signature: string | null;
  /** The address a foreign coin was sent to. */
  addressPaid: string | null;
  /** A foreign coin's transaction id, when Hub returned one. */
  txid: string | null;
  assetId: number | null;
  /** What the order calls the asset: the buyer's own text, for the buyer's screens only. */
  assetName: string | null;
}

/** What the seller's screens call a coin the app doesn't know. */
export const UNKNOWN_COIN = "Unknown coin";

/**
 * The coin an order names, read strictly: a ticker the app knows (any case,
 * spaces trimmed), `ASSET:<id>`, QORT when the order names none (as the
 * original), or `known: false`. An order with no currency but an asset id
 * is that asset.
 */
export function orderCoinOf(payment: Payment | null | undefined): { coin: string; known: boolean } {
  const raw = typeof payment?.currency === "string" ? payment.currency.trim() : "";
  if (!raw) {
    const id = payment?.assetId;
    if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) return { coin: assetCoinId(id), known: true };
    return { coin: "QORT", known: true };
  }
  const upper = raw.toUpperCase();
  if (isCoinTicker(upper)) return { coin: upper, known: true };
  const assetId = assetIdOf(upper);
  if (assetId !== null) return { coin: assetCoinId(assetId), known: true };
  return { coin: raw, known: false };
}

export function paymentSummary(payment: Payment | null | undefined): PaymentSummary {
  const { coin, known } = orderCoinOf(payment);
  const signature =
    typeof payment?.transactionSignature === "string" && payment.transactionSignature ? payment.transactionSignature : null;
  const assetId = assetIdOf(coin);
  if (assetId !== null) {
    return {
      kind: "asset",
      coin,
      known,
      signature,
      addressPaid: null,
      txid: null,
      assetId,
      assetName: payment?.assetName || null,
    };
  }
  if (coin === "QORT") {
    return { kind: "qort", coin, known, signature, addressPaid: null, txid: null, assetId: null, assetName: null };
  }
  const address =
    (coin === "ARRR" ? payment?.arrrAddressUsed : payment?.foreignAddressUsed) ||
    payment?.foreignAddressUsed ||
    payment?.arrrAddressUsed ||
    "";
  return {
    kind: "foreign",
    coin,
    known,
    signature,
    addressPaid: address.trim() || null,
    txid: payment?.foreignTxid || null,
    assetId: null,
    assetName: null,
  };
}

/**
 * What the seller's own shop says about the coin an order names, before
 * anything is looked up: a coin the app doesn't know, an asset or coin the
 * shop doesn't accept, or a foreign-coin address that isn't the shop's.
 * `shop`: the seller's shop when it's the order's shop (null: not known, so
 * only the unknown-coin check runs).
 */
export function shopPaymentWarnings(payment: Payment | null | undefined, shop: ShopCoinSettings | null): string[] {
  const summary = paymentSummary(payment);
  if (!summary.known) return ["This order names a coin Q-Shop+ doesn't know, so its payment can't be checked here."];
  if (!shop) return [];
  if (summary.kind === "asset") {
    const accepted = (shop.acceptedAssets ?? []).some((a) => a.id === summary.assetId);
    return accepted ? [] : [`This order was paid in asset #${summary.assetId}, which your shop doesn't accept.`];
  }
  if (summary.kind === "foreign") {
    if (!(shopCoins(shop) as string[]).includes(summary.coin)) {
      return [`This order was paid in ${summary.coin}, which your shop doesn't accept.`];
    }
    const address = shop.foreignCoins?.[summary.coin]?.trim();
    if (address && summary.addressPaid && summary.addressPaid !== address) {
      return [`The ${summary.coin} address in this order isn't your shop's current ${summary.coin} address.`];
    }
  }
  return [];
}

/** Amounts as Core and the order write them: 8 decimal places. */
function sameAmount(a: unknown, b: unknown): boolean {
  const x = Number(a);
  const y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 5e-9;
}

/**
 * What doesn't match between the transaction and the order, in plain words.
 * `sellerAddress`: the shop owner's address when known (the seller's own);
 * `buyerAddress`: the address that owns the order's name, when known;
 * `shop`: the seller's own shop, to compare the node's name for the asset
 * with the one the shop lists.
 */
export function paymentWarnings(
  tx: PaymentTransaction,
  payment: Payment | null | undefined,
  opts: { sellerAddress?: string | null; buyerAddress?: string | null; shop?: ShopCoinSettings | null } = {}
): string[] {
  const summary = paymentSummary(payment);
  const warnings: string[] = [];
  const expected = summary.kind === "asset" ? "TRANSFER_ASSET" : "PAYMENT";
  if (tx.type && tx.type !== expected) warnings.push(`This is not a payment: the node lists it as ${tx.type}.`);
  if (tx.amount !== undefined && payment?.total !== undefined && !sameAmount(tx.amount, payment.total)) {
    warnings.push("The amount sent is not the order total.");
  }
  if (summary.kind === "asset" && tx.assetId !== undefined && summary.assetId !== null) {
    if (Number(tx.assetId) !== summary.assetId) {
      warnings.push("This transfer is of another asset.");
    } else if (opts.shop && typeof tx.assetName === "string" && tx.assetName) {
      const listed = opts.shop.acceptedAssets?.find((a) => a.id === summary.assetId)?.name;
      if (listed && listed.trim().toLowerCase() !== tx.assetName.trim().toLowerCase()) {
        warnings.push(`The node calls asset #${summary.assetId} “${tx.assetName}”, not “${listed}” as your shop lists it.`);
      }
    }
  }
  if (opts.sellerAddress && tx.recipient && tx.recipient !== opts.sellerAddress) {
    warnings.push("It was sent to another address than the shop owner's.");
  }
  if (opts.buyerAddress && tx.creatorAddress && tx.creatorAddress !== opts.buyerAddress) {
    warnings.push("It was sent by another account than the buyer's.");
  }
  return warnings;
}

/**
 * The coin a transaction moved, as the node says: QORT for a PAYMENT (or a
 * transfer of asset 0), the asset with the node's own name for its other
 * transfers. Null when the transaction says neither.
 */
export function transactionCoin(tx: PaymentTransaction): { coin: string; settings: ShopCoinSettings | null } | null {
  if (tx.type === "PAYMENT") return { coin: "QORT", settings: null };
  if (tx.type !== "TRANSFER_ASSET" || tx.assetId === undefined) return null;
  const id = Number(tx.assetId);
  if (id === 0) return { coin: "QORT", settings: null };
  if (!Number.isSafeInteger(id) || id < 0) return null;
  const name = typeof tx.assetName === "string" && tx.assetName ? tx.assetName : `Asset #${id}`;
  return { coin: assetCoinId(id), settings: { acceptedAssets: [{ id, name }] } };
}
