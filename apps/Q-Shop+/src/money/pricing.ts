/**
 * Prices, exactly as the original computes them (pinned by Cart.pin.test.tsx
 * and pricing.test.ts):
 * - QORT: the product's `qort` price;
 * - another coin: the product's own price in that coin if it has one,
 *   otherwise the QORT price × the node's rate (foreign per QORT), as a plain
 *   float, unrounded per unit;
 * - line total = unit × quantity (float); order total = the sum, rounded only
 *   at the end with `toFixed(8)`, which is the amount sent to Hub.
 *
 * Assets have no market rate here: a product can be bought in an asset only
 * when the seller set a price in it.
 */
import { assetIdOf, priceCurrencyKey } from "./coins";

export interface PricedProduct {
  price?: { currency: string; value: number | string }[];
}

export function qortPrice(product: PricedProduct | null | undefined): number | undefined {
  const value = product?.price?.find((item) => item?.currency === "qort")?.value;
  return value === undefined || value === null ? undefined : (value as number);
}

/** The seller's own price in `coin`, if the product has one (a number, as the original reads it with `+`). */
export function ownPrice(product: PricedProduct | null | undefined, coin: string): number | undefined {
  if (coin === "QORT") return qortPrice(product);
  const value = product?.price?.find((item) => item?.currency === priceCurrencyKey(coin))?.value;
  if (value === undefined || value === null || value === "" || value === 0) return undefined;
  return +value;
}

/**
 * The price of one unit in `coin`, or undefined when there is none (no price,
 * or no rate yet for a converted price). `rate` is foreign coin per QORT.
 */
export function unitPrice(
  product: PricedProduct | null | undefined,
  coin: string,
  rate: number | null | undefined
): number | undefined {
  let price: number | undefined = qortPrice(product);
  if (coin === "QORT") return price;
  const own = ownPrice(product, coin);
  if (own) return own;
  if (assetIdOf(coin) !== null) return undefined;
  if (price && rate) return +price * rate;
  // The original showed the QORT number here until the rate arrived; the + app
  // shows nothing instead (bug 6 in the brief).
  price = undefined;
  return price;
}

/** The amount Hub is asked to send: the float total rounded to 8 places, as text. */
export function amountText(total: number): string {
  return total.toFixed(8);
}

/** A price for display: up to 8 decimals, trailing zeros dropped, at least 2 for QORT-like amounts. */
export function formatPrice(value: number | undefined | null, opts: { minDecimals?: number } = {}): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  const min = opts.minDecimals ?? 2;
  const fixed = value.toFixed(8).replace(/0+$/, "");
  const [whole, fraction = ""] = fixed.split(".");
  const frac = fraction.padEnd(min, "0");
  const wholeGrouped = Number(whole).toLocaleString("en-US");
  return frac ? `${wholeGrouped}.${frac}` : wholeGrouped;
}
