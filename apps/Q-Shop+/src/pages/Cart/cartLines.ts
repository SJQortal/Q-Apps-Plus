/**
 * A shop's cart as the cart page shows it: each line with its product (from
 * the catalogue it was added from) and whether it can be bought. Pure, so the
 * rules are tested on their own. Prices are never computed here: the page
 * uses money/pricing.ts and money/checkout.ts for every amount.
 */
import type { Cart } from "../../state/features/cartSlice";
import type { Catalogue } from "../../state/features/globalSlice";
import type { Product } from "../../state/features/storeSlice";
import type { CartLine, OrderDetails } from "../../money/order";
import { priceCheckout, type CheckoutShop } from "../../money/checkout";
import { unitPrice } from "../../money/pricing";
import type { ShopAsset } from "../../money/coins";
import type { LoadPhase } from "./useRetryingLoads";

export type LineState =
  /** Loaded and for sale: goes to checkout. */
  | "ready"
  /** The seller marked it out of stock or retired it. */
  | "unavailable"
  /** Its catalogue no longer lists it. */
  | "gone"
  /** Its catalogue is on its way. */
  | "loading"
  /** Its catalogue isn't on this node yet; asking again (2, 4, 8 s). */
  | "fetching"
  /** Its catalogue couldn't be fetched after the retries. */
  | "failed";

export interface CartViewLine {
  productId: string;
  catalogueId: string;
  quantity: number;
  /** The product as its catalogue holds it (stored in the order as is); null until loaded. */
  product: Product | null;
  state: LineState;
}

/** The shop as checkout needs it, plus what the cart shows. */
export interface CartShop extends CheckoutShop {
  logo?: string;
}

/** Only products the seller marks AVAILABLE can be bought, as in the original's product card. */
export function isForSale(product: Product | null | undefined): boolean {
  return product?.status === "AVAILABLE";
}

/**
 * The catalogue for a line, if it is loaded and belongs to the shop's owner.
 * The map is keyed by identifier only, and another name can publish the same
 * identifier (docs/QORTAL.md → pitfall 15): such a copy never prices a line.
 */
export function catalogueFor(
  catalogues: Record<string, Catalogue>,
  catalogueId: string,
  owner: string | null
): Catalogue | null {
  const catalogue = catalogues[catalogueId];
  if (!catalogue || typeof catalogue.products !== "object" || !catalogue.products) return null;
  if (catalogue.user && owner && catalogue.user !== owner) return null;
  return catalogue;
}

/** The cart's lines in the cart's order, which is also the order's line order. */
export function cartViewLines(
  cart: Cart,
  catalogues: Record<string, Catalogue>,
  phaseOf: (catalogueId: string) => LoadPhase
): CartViewLine[] {
  return Object.keys(cart.orders).map((key) => {
    const order = cart.orders[key];
    const base = { productId: order.productId, catalogueId: order.catalogueId, quantity: order.quantity };
    const catalogue = catalogueFor(catalogues, order.catalogueId, cart.storeOwner);
    if (!catalogue) {
      const phase = cart.storeOwner ? phaseOf(order.catalogueId) : "failed";
      const state: LineState = phase === "failed" ? "failed" : phase === "retrying" ? "fetching" : "loading";
      return { ...base, product: null, state };
    }
    const product = catalogue.products[order.productId] ?? null;
    if (!product) return { ...base, product: null, state: "gone" };
    return { ...base, product, state: isForSale(product) ? "ready" : "unavailable" };
  });
}

/** What goes to checkout: the lines that are for sale, in the cart's order. */
export function checkoutLinesOf(lines: CartViewLine[]): CartLine[] {
  return lines
    .filter((line) => line.state === "ready" && line.product)
    .map((line) => ({
      productId: line.productId,
      catalogueId: line.catalogueId,
      quantity: line.quantity,
      product: line.product,
    }));
}

/** Lines still on their way (checkout waits for them). */
export function isLoadingLine(line: CartViewLine): boolean {
  return line.state === "loading" || line.state === "fetching";
}

/** Lines that can't be bought now and are left out of checkout. */
export function isLeftOut(line: CartViewLine): boolean {
  return line.state === "unavailable" || line.state === "gone" || line.state === "failed";
}

export function itemCount(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** A store as Redux or QDN holds it, as checkout's shop (the fields the original passed, plus assets). */
export function cartShopFrom(storeId: string, owner: string, store: any): CartShop {
  const assets: ShopAsset[] | undefined = Array.isArray(store?.acceptedAssets) ? store.acceptedAssets : undefined;
  return {
    id: storeId,
    title: store?.title,
    owner,
    supportedCoins: Array.isArray(store?.supportedCoins) ? store.supportedCoins : undefined,
    foreignCoins: store?.foreignCoins && typeof store.foreignCoins === "object" ? store.foreignCoins : undefined,
    acceptedAssets: assets,
    logo: typeof store?.logo === "string" ? store.logo : undefined,
  };
}

export type PricedLines =
  | { ok: true; amount: string; details: OrderDetails }
  | { ok: false; reason: "empty" | "rate" | "price"; missing: string[] };

/**
 * The total checkout would charge for `lines` in `coin`, from the checkout
 * service itself (money/checkout.ts priceCheckout: the amount Hub is asked
 * to send). When a line has no price in the coin, says which ones, or that
 * the coin's rate is still on its way.
 */
export function priceLines(lines: CartLine[], coin: string, rate: number | null, rateLoading: boolean): PricedLines {
  if (lines.length === 0) return { ok: false, reason: "empty", missing: [] };
  const missing = lines
    // Checkout stops on a missing or zero price (money/order.ts buildOrderDetails); name those lines.
    .filter((line) => !unitPrice(line.product, coin, rate))
    .map((line) => String(line.product?.title ?? "An item"));
  if (missing.length > 0) return { ok: false, reason: rateLoading ? "rate" : "price", missing };
  try {
    const { amount, details } = priceCheckout(lines, coin, rate);
    return { ok: true, amount, details };
  } catch {
    return { ok: false, reason: "price", missing: [] };
  }
}

/** `ab12cd…9f3c2a`: enough of an address to recognise it. */
export function shortAddress(address: string): string {
  return address.length > 18 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}
