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
import { deliveryOptionsOf, quoteDelivery, type DeliveryChoiceInfo, type DeliveryDoc } from "./model";

export interface ShopDelivery {
  doc: DeliveryDoc | null;
  /** The shop's rates, when its delivery prices are in a currency (its product list's). */
  pricing: FiatPricing | null;
}

/** The shop's delivery prices (null when it has none). Rejects when the node can't serve them now. */
/** When each shop's delivery prices were last read from the node itself (not the session's copy). */
const readAt = new Map<string, number>();

/**
 * A shop's delivery prices and the rates they're paid at. Kept for the
 * session, but read from the node again once the copy is older than
 * `maxAgeMs` (checkout passes 0): a seller's change shows up without a
 * reload (Simon, from Hub: a change made a minute before wasn't at checkout).
 */
export async function loadShopDelivery(owner: string, storeId: string, options: { maxAgeMs?: number } = {}): Promise<ShopDelivery> {
  const key = `${owner}\n${storeId}`;
  const fresh = options.maxAgeMs !== undefined && Date.now() - (readAt.get(key) ?? 0) >= options.maxAgeMs;
  if (fresh || !readAt.has(key)) readAt.set(key, Date.now());
  const doc = await fetchDeliveryDoc(owner, storeId, { fresh });
  if (!doc || doc.currency === "QORT") return { doc, pricing: null };
  const index = await fetchQdnJson("DOCUMENT", owner, dataContainerIdentifier(storeId), { fresh });
  return { doc, pricing: fiatPricingOf(index) };
}

/** For tests. */
export function resetDeliveryReads(): void {
  readAt.clear();
}

export type DeliveryCharge =
  /**
   * `line` is the fee to add (null: nothing to pay); `free` when the shop's
   * prices make it free there; `option` the delivery option it's for, when
   * the shop has options.
   */
  | { ok: true; line: CartLine | null; free: boolean; option?: { id: string; name: string } }
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
  /** The buyer's delivery option ("" or absent: the zones' own prices). */
  option?: string;
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
    option: args.option,
  });
  if (quote.kind === "free") return { ok: true, line: null, free: !!doc, ...(quote.option && { option: quote.option }) };
  if (quote.kind === "option-unavailable") return { ok: false, message: `That delivery option isn't offered for this order to ${address.country}.` };
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
  const option = (quote.line.product as { delivery?: { option?: { id: string; name: string } } } | null)?.delivery?.option;
  return { ok: true, line: quote.line, free: false, ...(option && { option }) };
}

/** One delivery option the buyer can pick, with what it adds to the order. */
export interface DeliveryChoice extends DeliveryChoiceInfo {
  line: CartLine | null;
  free: boolean;
}

/**
 * The delivery options this order can have at the address, each with its
 * fee (the zones' own prices first). Only options every product group's zone
 * there offers are listed. Not ok when the order can't be delivered there
 * at all (the zones' own prices decide that).
 */
export function deliveryChoices(args: Omit<Parameters<typeof deliveryCharge>[0], "option">): { ok: true; choices: DeliveryChoice[] } | { ok: false; message: string } {
  const base = deliveryCharge(args);
  if (!base.ok) return base;
  const doc = args.delivery.doc;
  if (!doc?.options?.length) return { ok: true, choices: [] };
  const choices: DeliveryChoice[] = [];
  for (const info of deliveryOptionsOf(doc)) {
    const charge = info.id ? deliveryCharge({ ...args, option: info.id }) : base;
    // The zones' own prices go by their shipping profile's name (model.ts quoteDelivery).
    if (charge.ok) choices.push({ ...info, ...(!info.id && charge.option?.name && { name: charge.option.name }), line: charge.line, free: charge.free });
  }
  return { ok: true, choices };
}

/**
 * The options this order can have in the buyer's country (and US state) that
 * the buyer collects (model.ts `pickup`): checkout then asks who collects and
 * how to reach them instead of an address. Worked out from the place alone,
 * before any street is typed.
 */
export function pickupChoices(args: Omit<Parameters<typeof deliveryCharge>[0], "option">): DeliveryChoice[] {
  const doc = args.delivery.doc;
  if (!doc || !args.address.country) return [];
  const out: DeliveryChoice[] = [];
  for (const info of deliveryOptionsOf(doc)) {
    if (!info.pickup) continue;
    const charge = deliveryCharge({ ...args, ...(info.id && { option: info.id }) });
    if (charge.ok) out.push({ ...info, line: charge.line, free: charge.free });
  }
  return out;
}

/** The order's delivery note with the option the buyer picked in front (the seller reads it in either app). */
export function withOptionNote<T extends { deliveryNote: string }>(delivery: T, option: { name: string } | null | undefined): T {
  if (!option) return delivery;
  const note = delivery.deliveryNote.trim();
  return { ...delivery, deliveryNote: `Delivery: ${option.name}.${note ? ` ${note}` : ""}` };
}
