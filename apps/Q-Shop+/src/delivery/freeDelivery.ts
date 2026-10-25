/**
 * How far an order is from free delivery (Simon, 2026-10-25: "a nice bar at
 * checkout and on that user's shop showing how much is left to get free
 * delivery"): for the buyer's country, each shipping profile the order uses
 * whose zone there has "free from" (delivery/model.ts `freeOver`), what its
 * products come to and what's left. With nothing in the cart yet, the
 * lowest "free from" the shop has there, as an offer.
 */
import type { CartLine } from "../money/order";
import type { FiatPricing } from "../money/fiatPricing";
import { countryCode, stateCode, US } from "../constants/shipping";
import { profileFor, unitInCurrency, zoneFor, type DeliveryDoc } from "./model";

export interface FreeDeliveryStep {
  /** The shipping profile's name; null for the shop's general prices, or an offer. */
  profile: string | null;
  freeOver: number;
  /** What the profile's products come to, in `currency`. */
  subtotal: number;
  left: number;
  currency: string;
  reached: boolean;
}

export function freeDeliveryProgress(args: {
  doc: DeliveryDoc | null;
  lines: readonly CartLine[];
  country: string;
  state: string;
  pricing: FiatPricing | null;
}): FreeDeliveryStep[] {
  const { doc, pricing } = args;
  const country = countryCode(args.country);
  if (!doc || !country) return [];
  if (doc.currency !== "QORT" && (!pricing || pricing.currency !== doc.currency)) return [];
  const state = country === US ? stateCode(args.state) : null;
  const step = (profile: string | null, freeOver: number, subtotal: number): FreeDeliveryStep => {
    const left = Math.max(0, freeOver - subtotal);
    return { profile, freeOver, subtotal, left, currency: doc.currency, reached: left <= 1e-9 };
  };
  const physical = args.lines.filter((l) => l.product && l.product.type !== "digital");
  if (physical.length === 0) {
    const offers = [doc.general.zones, ...doc.profiles.map((p) => p.zones)]
      .map((zones) => zoneFor(zones, country, state)?.freeOver)
      .filter((v): v is number => typeof v === "number" && v > 0);
    return offers.length > 0 ? [step(null, Math.min(...offers), 0)] : [];
  }
  const groups = new Map<string, { name: string | null; zones: DeliveryDoc["general"]["zones"]; subtotal: number }>();
  for (const line of physical) {
    const profile = profileFor(doc, line.productId);
    const key = profile?.id ?? "";
    const group = groups.get(key) ?? { name: profile?.name ?? null, zones: profile ? profile.zones : doc.general.zones, subtotal: 0 };
    group.subtotal += unitInCurrency(line.product, doc.currency, pricing) * line.quantity;
    groups.set(key, group);
  }
  const out: FreeDeliveryStep[] = [];
  for (const group of groups.values()) {
    const freeOver = zoneFor(group.zones, country, state)?.freeOver;
    if (typeof freeOver === "number" && freeOver > 0) out.push(step(group.name, freeOver, group.subtotal));
  }
  return out;
}
