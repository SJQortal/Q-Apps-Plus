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
 * For a Qortal transaction the order dialog can check what the node says
 * against the order: a buyer could put another payment's signature in an
 * order, so the seller sees when the amount, the asset, the recipient or the
 * sender don't match.
 */
import type { Payment } from "../state/features/orderSlice";
import { assetIdOf } from "../money/coins";
import type { PaymentTransaction } from "./reads";

export type PaymentKind = "qort" | "asset" | "foreign";

export interface PaymentSummary {
  kind: PaymentKind;
  coin: string;
  /** A Qortal transaction that can be looked up. */
  signature: string | null;
  /** The address a foreign coin was sent to. */
  addressPaid: string | null;
  /** A foreign coin's transaction id, when Hub returned one. */
  txid: string | null;
  assetId: number | null;
  assetName: string | null;
}

export function paymentSummary(payment: Payment | null | undefined): PaymentSummary {
  const coin = payment?.currency || "QORT";
  const signature =
    typeof payment?.transactionSignature === "string" && payment.transactionSignature ? payment.transactionSignature : null;
  const assetId = assetIdOf(coin) ?? (typeof payment?.assetId === "number" ? payment.assetId : null);
  if (assetId !== null) {
    return {
      kind: "asset",
      coin,
      signature,
      addressPaid: null,
      txid: null,
      assetId,
      assetName: payment?.assetName || null,
    };
  }
  if (coin === "QORT") {
    return { kind: "qort", coin, signature, addressPaid: null, txid: null, assetId: null, assetName: null };
  }
  const address =
    (coin === "ARRR" ? payment?.arrrAddressUsed : payment?.foreignAddressUsed) ||
    payment?.foreignAddressUsed ||
    payment?.arrrAddressUsed ||
    "";
  return {
    kind: "foreign",
    coin,
    signature,
    addressPaid: address.trim() || null,
    txid: payment?.foreignTxid || null,
    assetId: null,
    assetName: null,
  };
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
 * `buyerAddress`: the address that owns the order's name, when known.
 */
export function paymentWarnings(
  tx: PaymentTransaction,
  payment: Payment | null | undefined,
  opts: { sellerAddress?: string | null; buyerAddress?: string | null } = {}
): string[] {
  const summary = paymentSummary(payment);
  const warnings: string[] = [];
  const expected = summary.kind === "asset" ? "TRANSFER_ASSET" : "PAYMENT";
  if (tx.type && tx.type !== expected) warnings.push(`This is not a payment: the node lists it as ${tx.type}.`);
  if (tx.amount !== undefined && payment?.total !== undefined && !sameAmount(tx.amount, payment.total)) {
    warnings.push("The amount sent is not the order total.");
  }
  if (
    summary.kind === "asset" &&
    tx.assetId !== undefined &&
    summary.assetId !== null &&
    Number(tx.assetId) !== summary.assetId
  ) {
    warnings.push("This transfer is of another asset.");
  }
  if (opts.sellerAddress && tx.recipient && tx.recipient !== opts.sellerAddress) {
    warnings.push("It was sent to another address than the shop owner's.");
  }
  if (opts.buyerAddress && tx.creatorAddress && tx.creatorAddress !== opts.buyerAddress) {
    warnings.push("It was sent by another account than the buyer's.");
  }
  return warnings;
}
