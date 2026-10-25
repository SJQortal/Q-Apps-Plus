/**
 * A discount at checkout (discounts/model.ts): whether it applies to the
 * order, and the line it adds, priced in the buyer's coin like the delivery
 * fee (delivery/checkoutDelivery.ts): one negative line,
 * `details["q-store-discount"]`, so the order's total and the payment
 * follow it, and the original shows it as a line of the total. Never on an
 * auction win; on top of sale prices (it takes off the price paid).
 */
import type { CartLine } from "../money/order";
import { unitPrice } from "../money/pricing";
import { priceCurrencyKey } from "../money/coins";
import { fiatPriceOf, qortPriceOf, type FiatPricing } from "../money/fiatPricing";
import { deliveryMoney } from "../delivery/model";
import { DISCOUNT_LINE_ID, discountStatus, discountTitle, type Discount, type DiscountsDoc } from "./model";

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const isAuctionWin = (line: CartLine) => !!(line.product as { auctionWin?: unknown } | null)?.auctionWin;

/** The products a discount takes its percentage off: the order's products in its list (all of them without one), never an auction win. */
export function discountedLines(discount: Pick<Discount, "products">, lines: readonly CartLine[]): CartLine[] {
  return lines.filter((line) => line.product && !isAuctionWin(line) && (!discount.products || discount.products.includes(line.productId)));
}

/** The order's products in the shop's currency (QORT, or its pricing currency at its rates); null when one can't be worked out. */
export function productsSubtotal(lines: readonly CartLine[], currency: string, pricing: FiatPricing | null): number | null {
  let sum = 0;
  for (const line of lines) {
    const qort = qortPriceOf(line.product);
    const value =
      currency === "QORT"
        ? qort
        : (fiatPriceOf(line.product, currency)?.value ?? (qort !== undefined && pricing?.currency === currency && pricing.rates.QORT > 0 ? qort * pricing.rates.QORT : undefined));
    if (value === undefined) return null;
    sum += value * line.quantity;
  }
  return sum;
}

/** Why `discount` doesn't apply to this order, or null when it does. */
export function discountProblem(args: {
  discount: Discount;
  doc: Pick<DiscountsDoc, "currency">;
  /** The order's products (not its delivery fee). */
  lines: readonly CartLine[];
  /** The buyer's name's fingerprint for this shop (nameHash), null when they have none. */
  buyerNameHash: string | null;
  now: number;
  pricing: FiatPricing | null;
  /** The order has a delivery fee a free-delivery code could take off. */
  hasDeliveryFee: boolean;
}): string | null {
  const { discount, now } = args;
  const status = discountStatus(discount, now);
  if (status === "paused") return "This code isn't in use right now.";
  if (status === "scheduled" && discount.starts !== undefined) return `This code starts on ${day(discount.starts)}.`;
  if (status === "ended" && discount.ends !== undefined) return `This code ended on ${day(discount.ends)}.`;
  if (discount.forName && discount.forName !== args.buyerNameHash) return "This code is for another Qortal name.";
  if (discountedLines(discount, args.lines).length === 0) return "This code is for other products of this shop.";
  if (discount.minTotal !== undefined) {
    const subtotal = productsSubtotal(args.lines, args.doc.currency, args.pricing);
    const least = deliveryMoney(discount.minTotal, args.doc.currency);
    if (subtotal === null) return `This code is for orders of ${least} or more, which can't be worked out for these products right now.`;
    if (subtotal + 1e-9 < discount.minTotal) return `This code is for orders of ${least} or more (these products come to ${deliveryMoney(subtotal, args.doc.currency)}).`;
  }
  if (discount.percent === 0 && !args.hasDeliveryFee) return "This code makes delivery free, and this order has no delivery to pay.";
  return null;
}

/**
 * The line a discount adds, priced in `coin`: minus its percentage of the
 * products it covers, and minus the delivery fee when it makes delivery
 * free. To 8 decimals, or whole units in an asset that can't be split
 * (rounded down, so the order still comes to whole units). Null when it
 * takes nothing off in this coin. The total stays above nothing: at most
 * 99 % off the products, and delivery free.
 */
export function discountLine(args: {
  discount: Discount;
  /** The code as the buyer typed it (normalized), for the order: none for a discount for one name. */
  code?: string;
  lines: readonly CartLine[];
  deliveryLine: CartLine | null;
  coin: string;
  rate: number | null;
  /** Every product is digital: the line says so too, so the original still hides the address. */
  digital: boolean;
  /** Whole units only (an asset that can't be split). */
  wholeUnits?: boolean;
}): { line: CartLine; amount: number } | null {
  let products = 0;
  for (const line of discountedLines(args.discount, args.lines)) {
    const unit = unitPrice(line.product, args.coin, args.rate);
    if (!unit) return null;
    products += unit * line.quantity;
  }
  let amount = (products * args.discount.percent) / 100;
  if (args.discount.freeDelivery && args.deliveryLine) amount += unitPrice(args.deliveryLine.product, args.coin, args.rate) ?? 0;
  amount = args.wholeUnits ? Math.floor(amount + 1e-9) : Math.round(amount * 1e8) / 1e8;
  if (!(amount > 0)) return null;
  const product = {
    id: DISCOUNT_LINE_ID,
    title: discountTitle(args.discount, args.code),
    type: args.digital ? "digital" : "discount",
    price: [{ currency: priceCurrencyKey(args.coin), value: -amount }],
    discount: {
      id: args.discount.id,
      ...(args.code && { code: args.code }),
      percent: args.discount.percent,
      ...(args.discount.freeDelivery && { freeDelivery: true }),
      value: amount,
      coin: args.coin,
    },
  };
  return { amount, line: { productId: DISCOUNT_LINE_ID, catalogueId: "", quantity: 1, product: product as CartLine["product"] } };
}

/** The discount a code opens at this shop (by its fingerprint), if any. */
export function discountForCode(doc: DiscountsDoc, hash: string): Discount | null {
  return doc.discounts.find((d) => d.code === hash) ?? null;
}

/** A discount for the buyer's own name that needs no code, the largest first; null when there's none in use. */
export function discountForName(doc: DiscountsDoc, buyerNameHash: string | null, now: number): Discount | null {
  if (!buyerNameHash) return null;
  const mine = doc.discounts.filter((d) => !d.code && d.forName === buyerNameHash && discountStatus(d, now) === "active");
  return mine.sort((a, b) => b.percent - a.percent || Number(!!b.freeDelivery) - Number(!!a.freeDelivery))[0] ?? null;
}
