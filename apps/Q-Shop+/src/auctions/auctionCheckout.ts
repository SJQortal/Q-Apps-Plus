/**
 * Paying for a won auction goes through the shop's usual checkout
 * (money/checkout.ts startCheckout, unchanged): one line, the product at the
 * winning bid, in QORT only. The order stores the product as the original
 * does, with its price set to the winning bid and an additive `auctionWin`
 * saying which bid won.
 */
import { cartShopFrom, type CartShop } from "../pages/Cart/cartLines";
import type { CartLine } from "../money/order";
import type { Bid } from "./rules";

export function wonProduct<T extends Record<string, unknown>>(product: T, winner: Bid): T & { price: { currency: string; value: number }[]; auctionWin: { bid: string; bidder: string; amount: number } } {
  return { ...product, price: [{ currency: "qort", value: winner.amount }], auctionWin: { bid: winner.id, bidder: winner.bidder, amount: winner.amount } };
}

export function wonLine(product: Record<string, unknown>, productId: string, catalogueId: string, winner: Bid): CartLine {
  return { productId, catalogueId, quantity: 1, product: wonProduct(product, winner) as CartLine["product"] };
}

/** The shop as checkout sees it for an auction: QORT only, whatever else it takes. */
export function auctionCheckoutShop(storeId: string, owner: string, store: unknown): CartShop {
  return { ...cartShopFrom(storeId, owner, store), supportedCoins: ["QORT"], foreignCoins: undefined, acceptedAssets: undefined };
}
