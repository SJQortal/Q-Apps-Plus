/**
 * What delivery costs before checkout (Simon, 2026-10-25: "shipping options
 * shown for customer to choose from if the seller has them"; Follow-up 50):
 * for the buyer's country (buyerPlace.ts), each option the shop offers there
 * with its price for this product, worked out exactly as checkout will
 * (model.ts quoteDelivery), so the price on the product page is the price
 * at checkout for the same quantity.
 */
import type { CartLine } from "../money/order";
import { unitPrice } from "../money/pricing";
import { US, countryCode, placeNotShipped, stateCode } from "../constants/shipping";
import type { ShopDelivery } from "./checkoutDelivery";
import { deliveryOptionsOf, profileFor, quoteDelivery, zoneFor } from "./model";
import type { BuyerPlace } from "./buyerPlace";

export interface EstimateChoice {
  /** "" for the zones' own prices. */
  id: string;
  /** The option's name; "" when the shop has no options. */
  name: string;
  note?: string;
  free: boolean;
  /** The fee in QORT (every shop takes QORT). */
  qort?: number;
  /** The fee in the shop's delivery currency, when that isn't QORT ("6.00 USD"). */
  fiat?: { value: number; currency: string };
}

export type DeliveryEstimate =
  /** The shop has no delivery prices: nothing to work out (it may still say where it ships). */
  | { kind: "none" }
  /** The shop's Ships to leaves the place out. */
  | { kind: "not-shipped"; place: string }
  /** No delivery zone of the product's covers the place. */
  | { kind: "unavailable"; place: string }
  /** The prices are in a currency the shop no longer prices in. */
  | { kind: "no-rates" }
  | { kind: "ok"; choices: EstimateChoice[]; freeOver?: { value: number; currency: string } };

export function deliveryEstimate(args: {
  shop: { supportedCoins?: unknown; shippingCountries?: unknown; shippingStates?: unknown };
  delivery: ShopDelivery;
  /** A product page's one line, or a cart's lines from one shop. */
  lines: readonly CartLine[];
  place: BuyerPlace;
}): DeliveryEstimate {
  const { doc, pricing } = args.delivery;
  if (!doc) return { kind: "none" };
  const { country, state } = args.place;
  const code = countryCode(country);
  const notShipped = placeNotShipped(args.shop, country, state);
  if (notShipped) return { kind: "not-shipped", place: notShipped };
  const takesArrr = Array.isArray(args.shop.supportedCoins) && args.shop.supportedCoins.includes("ARRR");
  const place = code === US && state ? `${state}, ${country}` : country;
  const choices: EstimateChoice[] = [];
  const options = doc.options?.length ? deliveryOptionsOf(doc) : [{ id: "", name: "" }];
  for (const option of options) {
    const quote = quoteDelivery({ doc, lines: args.lines, country, state, pricing, takesArrr, option: option.id });
    if (quote.kind === "no-rates") return { kind: "no-rates" };
    // Zones don't depend on the option: none here means none for any.
    if (quote.kind === "unavailable") return { kind: "unavailable", place };
    if (quote.kind === "option-unavailable") continue;
    // The zones' own prices go by their shipping profile's name (model.ts quoteDelivery).
    const name = !option.id && quote.kind === "free" && quote.option?.name ? quote.option.name : option.name;
    if (quote.kind === "free") {
      choices.push({ ...option, name, free: true });
      continue;
    }
    const charged = (quote.line.product as { delivery?: { option?: { name?: string } } } | undefined)?.delivery?.option?.name;
    choices.push({
      ...option,
      name: !option.id && charged ? charged : name,
      free: false,
      qort: unitPrice(quote.line.product, "QORT", null),
      ...(quote.currency !== "QORT" && { fiat: { value: quote.fee, currency: quote.currency } }),
    });
  }
  // Free over, from the zone's own prices, when the lines share one profile.
  const physical = args.lines.filter((l) => l.product && l.product.type !== "digital");
  const profiles = new Set(physical.map((l) => profileFor(doc, l.productId, code, code === US ? stateCode(state) : null)));
  const profile = profiles.size === 1 ? [...profiles][0] : undefined;
  const zone = code && profile !== undefined ? zoneFor(profile ? profile.zones : doc.general.zones, code, code === US ? stateCode(state) : null) : null;
  const freeOver = zone?.freeOver !== undefined ? { value: zone.freeOver, currency: doc.currency } : undefined;
  return { kind: "ok", choices, ...(freeOver && { freeOver }) };
}
