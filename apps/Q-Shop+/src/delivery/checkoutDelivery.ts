/**
 * Delivery at checkout (delivery/model.ts): the shop's delivery prices read
 * when the buyer leaves the address step, and the fee they give for the
 * address as one more order line, priced in the buyer's coin like a product.
 * Both checkouts (one shop, several shops) use these, so they charge the same.
 */
import type { CartLine, DeliveryInput } from "../money/order";
import { unitPrice } from "../money/pricing";
import { coinLabel, type ShopCoinSettings } from "../money/coins";
import { fiatPricingOf, type FiatPricing } from "../money/fiatPricing";
import { dataContainerIdentifier } from "../qdn/identifiers";
import { fetchQdnJson } from "../qdn/search";
import { US, countryCode } from "../constants/shipping";
import { fetchDeliveryDoc } from "./deliveryDoc";
import { quoteDelivery, type DeliveryDoc } from "./model";

export interface ShopDelivery {
  doc: DeliveryDoc | null;
  /** The shop's rates, when its delivery prices are in a currency (its product list's). */
  pricing: FiatPricing | null;
}

/** The shop's delivery prices (null when it has none). Rejects when the node can't serve them now. */
export async function loadShopDelivery(owner: string, storeId: string): Promise<ShopDelivery> {
  const doc = await fetchDeliveryDoc(owner, storeId);
  if (!doc || doc.currency === "QORT") return { doc, pricing: null };
  const index = await fetchQdnJson("DOCUMENT", owner, dataContainerIdentifier(storeId));
  return { doc, pricing: fiatPricingOf(index) };
}

export type DeliveryCharge =
  /** `line` is the fee to add (null: nothing to pay); `free` when the shop's prices make it free there. */
  | { ok: true; line: CartLine | null; free: boolean }
  | { ok: false; message: string };

const listOf = (titles: string[]) =>
  titles.length <= 1 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;

/** What delivery to the address adds to these lines, paid in `coin`, or why they can't be delivered there now. */
export function deliveryCharge(args: {
  shop: ShopCoinSettings & { title?: string; owner: string };
  delivery: ShopDelivery;
  lines: readonly CartLine[];
  address: Pick<DeliveryInput, "country" | "state">;
  coin: string;
  rate: number | null;
}): DeliveryCharge {
  const { shop, lines, address, coin, rate } = args;
  const { doc, pricing } = args.delivery;
  const name = shop.title || shop.owner;
  const quote = quoteDelivery({
    doc,
    lines,
    country: address.country,
    state: address.state,
    pricing,
    takesArrr: Array.isArray(shop.supportedCoins) && shop.supportedCoins.includes("ARRR"),
  });
  if (quote.kind === "free") return { ok: true, line: null, free: !!doc };
  if (quote.kind === "no-rates") {
    return { ok: false, message: `${name}'s delivery prices can't be worked out right now: they're in a currency the shop no longer prices in. Ask the seller.` };
  }
  const place = countryCode(address.country) === US && address.state ? `${address.state}, ${address.country}` : address.country;
  if (quote.kind === "unavailable") {
    const titles = [...new Set(quote.titles)];
    return {
      ok: false,
      message: `${name} doesn't deliver ${listOf(titles)} to ${place}. Remove ${titles.length === 1 ? "it" : "them"} from your cart, pick another address, or ask the seller.`,
    };
  }
  if (!unitPrice(quote.line.product, coin, rate)) {
    return { ok: false, message: `Delivery can't be paid in ${coinLabel(coin, shop)}: go back and pick another coin.` };
  }
  return { ok: true, line: quote.line, free: false };
}
