/**
 * The seller's check of an order's discount (discounts/apply.ts). Anyone can
 * encrypt an order to a seller, so a discount line is the buyer's claim
 * until it matches one of the seller's codes: the code's fingerprint, at
 * most its percentage (and free delivery only when it gives it), what it
 * can take off the products it covers, the minimum, the name, and its dates
 * (the payment's time on chain when the order names one, else the order's).
 * As the payment checks do, it only tells the seller; nothing is changed.
 */
import { useEffect, useState } from "react";
import type { FiatPricing } from "../money/fiatPricing";
import type { CartLine } from "../money/order";
import type { Order } from "../state/features/orderSlice";
import { orderDelivery, orderDiscount, orderItems, type OrderItem } from "../orders/format";
import { fetchPaymentTransaction } from "../orders/reads";
import { productsSubtotal } from "./apply";
import { loadShopDiscounts } from "./discountsDoc";
import { codeHash, nameHash, type DiscountsDoc } from "./model";

export type DiscountCheck = { ok: true } | { ok: false; message: string };

export async function checkOrderDiscount(args: {
  claim: NonNullable<ReturnType<typeof orderDiscount>>;
  doc: DiscountsDoc | null;
  storeId: string;
  /** The order's publisher. */
  buyer: string;
  items: readonly OrderItem[];
  /** The order's delivery fee, in the coin paid. */
  deliveryFee: number | undefined;
  /** When it was paid (ms). */
  at: number;
  pricing: FiatPricing | null;
}): Promise<DiscountCheck> {
  const { claim, doc } = args;
  if (!doc) return { ok: false, message: "This order has a discount, but your shop has no discount codes now." };
  const discount = claim.id ? doc.discounts.find((d) => d.id === claim.id) : undefined;
  if (!discount) return { ok: false, message: "This order's discount isn't one of your codes now (changed or deleted since?)." };
  if (discount.code && (!claim.code || (await codeHash(args.storeId, claim.code)) !== discount.code)) {
    return { ok: false, message: "The code in this order isn't your code." };
  }
  if (discount.forName && (await nameHash(args.storeId, args.buyer)) !== discount.forName) {
    return { ok: false, message: "This discount is for another Qortal name than the buyer's." };
  }
  if ((discount.starts !== undefined && args.at < discount.starts) || (discount.ends !== undefined && args.at > discount.ends)) {
    return { ok: false, message: "It was used outside your code's dates." };
  }
  const covered = args.items.filter((i) => !i.product?.auctionWin && (!discount.products || discount.products.includes(i.productId)));
  const most = (covered.reduce((sum, i) => sum + (i.totalProductPrice ?? 0), 0) * discount.percent) / 100 + (discount.freeDelivery ? (args.deliveryFee ?? 0) : 0);
  if ((claim.percent ?? 0) > discount.percent || (claim.freeDelivery && !discount.freeDelivery) || (claim.amount ?? 0) > most + 1e-8) {
    return { ok: false, message: "It takes off more than your code gives." };
  }
  if (discount.minTotal !== undefined) {
    const lines = args.items.map((i) => ({ productId: i.productId, catalogueId: i.catalogueId, quantity: i.quantity, product: i.product })) as CartLine[];
    const subtotal = productsSubtotal(lines, doc.currency, args.pricing);
    if (subtotal !== null && subtotal + 1e-9 < discount.minTotal) return { ok: false, message: "The order is under your code's minimum." };
  }
  return { ok: true };
}

/** For the seller's order: its discount checked against the shop's codes (null without one, or while it's checked). */
export function useOrderDiscountCheck(order: Order | null, owner: string, storeId: string): DiscountCheck | null {
  const [result, setResult] = useState<{ id: string; check: DiscountCheck } | null>(null);
  const id = order?.id ?? "";
  useEffect(() => {
    if (!order || !owner || !storeId) return;
    const claim = orderDiscount(order);
    if (!claim) return;
    let alive = true;
    void (async () => {
      const shop = await loadShopDiscounts(owner, storeId).catch(() => ({ doc: null, pricing: null }));
      const signature = typeof order.payment?.transactionSignature === "string" ? order.payment.transactionSignature : "";
      const paid = signature ? await fetchPaymentTransaction(signature).catch(() => null) : null;
      const check = await checkOrderDiscount({
        claim,
        doc: shop.doc,
        storeId,
        buyer: order.user ?? "",
        items: orderItems(order),
        deliveryFee: orderDelivery(order)?.total,
        at: paid?.timestamp ?? order.created ?? 0,
        pricing: shop.pricing,
      });
      if (alive) setResult({ id: order.id ?? "", check });
    })();
    return () => {
      alive = false;
    };
  }, [order, owner, storeId]);
  return result && result.id === id ? result.check : null;
}
