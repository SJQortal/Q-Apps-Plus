/**
 * What delivery costs (Simon, 2026-10-23: "a new tab, Delivery, and there
 * user can set a specific delivery for each country or region, and also
 * adjusted for each product … Shipping profiles … in set currency like USD
 * and from there QORT price adjusted").
 *
 * A shop's delivery prices are one DOCUMENT of the seller's,
 * `q-store-delivery-<shortStoreId>` (additive; the original never reads it):
 *
 *   {v: 1, storeId, currency: "QORT" | the shop's pricing currency,
 *    general: {zones},                       every product not in a profile
 *    profiles: [{id, name, products: [productId…], zones}],
 *    updated}
 *   zone: {id, name?, countries: [ISO…], states?: [US state…],
 *          first, extra?, freeOver?}          amounts in `currency`
 *
 * At checkout, a physical order's products are grouped by profile; each
 * group pays its zone's price for where it goes (the first zone that has the
 * country; in the United States a zone naming the state before one for the
 * whole country):
 * `first`, plus `extra` for each item after the first, nothing once the
 * group's items reach `freeOver`. A product whose profile has no zone there
 * can't be delivered there. A profile without zones delivers free.
 *
 * Delivery options (Simon, 2026-10-25: "shipping options shown for customer
 * to choose from if the seller has them"), additive: the doc may name up to
 * four `options: [{id, name, note?}]` (Express, Local pickup…) besides the
 * zones' own prices, which are the first option (`base: {name, note?}`,
 * "Standard" by default); a zone offers an option by pricing it,
 * `rates: {<option id>: {first, extra?, freeOver?}}`. The buyer picks one
 * at checkout; an option shows only when every product group's zone there
 * offers it. The order's delivery line says which (`delivery.option`).
 *
 * The fee goes into the order as one more line, `details["q-store-delivery"]`,
 * priced like a product (a price list: QORT, and ARRR when the shop takes it),
 * so checkout's money code prices and pays it unchanged and the original
 * shows it as a line, "Delivery to Poland", in the total. In a currency, the
 * fee's QORT and ARRR prices come from the shop's rates (money/fiatPricing.ts),
 * the same way as its products'.
 */
import type { CartLine } from "../money/order";
import { formatPrice, qortPrice, type PricedProduct } from "../money/pricing";
import { coinPriceFromFiat, fiatPriceOf, formatFiat, priceDecimals, priceListFromFiat, type FiatPricing } from "../money/fiatPricing";
import { ALL_COUNTRY_CODES, ALL_STATE_CODES, US, countryCode, stateCode } from "../constants/shipping";

export const DELIVERY_LINE_ID = "q-store-delivery";
export const MAX_PROFILES = 20;
export const MAX_ZONES = 30;
/** Delivery options besides the zones' own prices. */
export const MAX_OPTIONS = 4;
export const BASE_OPTION_NAME = "Standard";

/** An amount in the delivery prices' currency: "5.00 USD", "2.5 QORT". */
export function deliveryMoney(value: number, currency: string): string {
  return currency === "QORT" ? `${formatPrice(value)} QORT` : formatFiat(value, currency);
}

/** What delivery costs with one option: the first item, each extra item, free from an amount. */
export interface DeliveryRate {
  first: number;
  extra?: number;
  freeOver?: number;
}

export interface DeliveryZone extends DeliveryRate {
  id: string;
  name?: string;
  countries: string[];
  /** With "US" in countries: only these states of it. */
  states?: string[];
  /** The other options this zone offers, by option id, with their prices. */
  rates?: Record<string, DeliveryRate>;
}

/** A way of delivery the buyer can pick (besides the zones' own prices): "Express", "Local pickup". */
export interface DeliveryOption {
  id: string;
  name: string;
  /** "1–3 days", "Collect at the farm, Saturdays". */
  note?: string;
  /** The buyer collects it: checkout asks who and how to reach them, no address (Simon, 2026-10-25). */
  pickup?: true;
}

export interface DeliveryProfile {
  id: string;
  name: string;
  products: string[];
  zones: DeliveryZone[];
}

export interface DeliveryDoc {
  v: 1;
  storeId: string;
  /** "QORT", or the shop's pricing currency (USD…). */
  currency: string;
  general: { zones: DeliveryZone[] };
  profiles: DeliveryProfile[];
  updated: number;
  /** The zones' own prices as an option: its name ("Standard" when absent), note, and whether the buyer collects it. */
  base?: { name: string; note?: string; pickup?: true };
  /** Other options, at most four; a zone offers one by pricing it (`rates`). */
  options?: DeliveryOption[];
}

const COUNTRIES = new Set(ALL_COUNTRY_CODES);
const STATES = new Set(ALL_STATE_CODES);
const amountOf = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1e9 ? value : undefined);
const textOf = (value: unknown, max: number): string | undefined => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined);
const idOf = (value: unknown): string | null => (typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null);

function rateOf(raw: unknown): DeliveryRate | null {
  const r = raw as Partial<Record<keyof DeliveryRate, unknown>> | null;
  const first = amountOf(r?.first);
  if (!r || first === undefined) return null;
  const extra = amountOf(r.extra);
  const freeOver = amountOf(r.freeOver);
  return { first, ...(extra !== undefined && extra > 0 && { extra }), ...(freeOver !== undefined && freeOver > 0 && { freeOver }) };
}

function ratesOf(raw: unknown): Record<string, DeliveryRate> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, DeliveryRate> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_OPTIONS * 2)) {
    const id = idOf(key);
    const rate = id ? rateOf(value) : null;
    if (id && rate) out[id] = rate;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function zoneOf(raw: unknown): DeliveryZone | null {
  const z = raw as Partial<Record<keyof DeliveryZone, unknown>> | null;
  const id = idOf(z?.id);
  const first = amountOf(z?.first);
  if (!z || !id || first === undefined || !Array.isArray(z.countries)) return null;
  const countries = [...new Set(z.countries.filter((c): c is string => typeof c === "string" && COUNTRIES.has(c)))];
  if (countries.length === 0) return null;
  const states = Array.isArray(z.states) ? [...new Set(z.states.filter((c): c is string => typeof c === "string" && STATES.has(c)))] : [];
  const name = textOf(z.name, 60);
  const extra = amountOf(z.extra);
  const freeOver = amountOf(z.freeOver);
  return {
    id,
    ...(name && { name }),
    countries,
    ...(states.length > 0 && countries.includes(US) && { states }),
    first,
    ...(extra !== undefined && extra > 0 && { extra }),
    ...(freeOver !== undefined && freeOver > 0 && { freeOver }),
    ...(ratesOf(z.rates) && { rates: ratesOf(z.rates) }),
  };
}

const zonesOf = (raw: unknown): DeliveryZone[] =>
  (Array.isArray(raw) ? raw : []).map(zoneOf).filter((z): z is DeliveryZone => !!z).slice(0, MAX_ZONES);

/** A shop's delivery prices as published, or null (none, or not this shop's, or malformed). Anyone can publish JSON: only well-formed parts are kept. */
export function deliveryDocOf(raw: unknown, storeId: string): DeliveryDoc | null {
  const d = raw as Partial<Record<keyof DeliveryDoc, unknown>> & { deleted?: unknown } | null;
  if (!d || typeof d !== "object" || d.deleted === true || d.storeId !== storeId || typeof d.currency !== "string") return null;
  const profiles: DeliveryProfile[] = [];
  for (const p of Array.isArray(d.profiles) ? d.profiles : []) {
    const raw = p as Partial<Record<keyof DeliveryProfile, unknown>> | null;
    const id = idOf(raw?.id);
    if (!raw || !id) continue;
    profiles.push({
      id,
      name: textOf(raw.name, 60) ?? "Profile",
      products: Array.isArray(raw.products) ? [...new Set(raw.products.filter((x): x is string => typeof x === "string" && x.length <= 80))] : [],
      zones: zonesOf(raw.zones),
    });
    if (profiles.length >= MAX_PROFILES) break;
  }
  const options: DeliveryOption[] = [];
  for (const o of Array.isArray(d.options) ? d.options : []) {
    const raw = o as Partial<Record<keyof DeliveryOption, unknown>> | null;
    const id = idOf(raw?.id);
    const name = textOf(raw?.name, 40);
    if (!id || !name || options.some((x) => x.id === id)) continue;
    const note = textOf(raw?.note, 80);
    options.push({ id, name, ...(note && { note }), ...(raw?.pickup === true && { pickup: true as const }) });
    if (options.length >= MAX_OPTIONS) break;
  }
  const baseRaw = d.base as { name?: unknown; note?: unknown; pickup?: unknown } | undefined;
  const baseName = textOf(baseRaw?.name, 40);
  const baseNote = textOf(baseRaw?.note, 80);
  const basePickup = baseRaw?.pickup === true;
  return {
    v: 1,
    storeId,
    currency: d.currency,
    general: { zones: zonesOf((d.general as { zones?: unknown } | undefined)?.zones) },
    profiles,
    updated: typeof d.updated === "number" ? d.updated : 0,
    ...((baseName || baseNote || basePickup) && { base: { name: baseName ?? BASE_OPTION_NAME, ...(baseNote && { note: baseNote }), ...(basePickup && { pickup: true as const }) } }),
    ...(options.length > 0 && { options }),
  };
}

/** The option a buyer can pick: the zones' own prices (id "") or one of the doc's options. */
export interface DeliveryChoiceInfo {
  id: string;
  name: string;
  note?: string;
  /** The buyer collects it (no address). */
  pickup?: true;
}

/** Every option the doc names, the zones' own prices first. */
export function deliveryOptionsOf(doc: DeliveryDoc): DeliveryChoiceInfo[] {
  return [{ id: "", name: doc.base?.name ?? BASE_OPTION_NAME, ...(doc.base?.note && { note: doc.base.note }), ...(doc.base?.pickup && { pickup: true as const }) }, ...(doc.options ?? [])];
}

/** The profile a product is delivered with: the first custom one naming it, else the general one (null). */
export function profileFor(doc: DeliveryDoc, productId: string): DeliveryProfile | null {
  return doc.profiles.find((p) => p.products.includes(productId)) ?? null;
}

/**
 * The zone that delivers to the country (and its state in the United States),
 * or null. In the United States a zone naming the state comes before one for
 * the whole country ("USA $6", then "West Coast $4" wins for Oregon);
 * otherwise the first zone listed.
 */
export function zoneFor(zones: readonly DeliveryZone[], countryCodeValue: string, stateCodeValue: string | null): DeliveryZone | null {
  const here = zones.filter((z) => z.countries.includes(countryCodeValue));
  if (countryCodeValue !== US) return here[0] ?? null;
  if (stateCodeValue) {
    const named = here.find((z) => z.states?.includes(stateCodeValue));
    if (named) return named;
  }
  return here.find((z) => !z.states) ?? (stateCodeValue ? null : (here[0] ?? null));
}

/** A product's price in the doc's currency (its own fiat price, else its QORT price at the rate), for Free over. */
function unitInCurrency(product: CartLine["product"], currency: string, pricing: FiatPricing | null): number {
  const qort = qortPrice(product) ?? 0;
  if (currency === "QORT") return qort;
  const own = fiatPriceOf(product as never, currency)?.value;
  if (typeof own === "number") return own;
  return pricing && pricing.currency === currency ? qort * pricing.rates.QORT : 0;
}

export interface DeliveryPart {
  profile: string;
  zone: string;
  items: number;
  fee: number;
}

export type DeliveryQuote =
  /** Nothing to pay for delivery (no delivery prices, digital only, free there). */
  | { kind: "free"; parts: DeliveryPart[]; option?: { id: string; name: string } }
  /** The chosen option isn't offered for these products there. */
  | { kind: "option-unavailable" }
  | { kind: "charge"; fee: number; currency: string; parts: DeliveryPart[]; line: CartLine }
  /** These products can't be delivered to the address (their profile has no zone for it). */
  | { kind: "unavailable"; titles: string[] }
  /** The prices are in a currency the shop no longer prices in: they can't be worked out. */
  | { kind: "no-rates" };

function round(value: number, currency: string): number {
  const f = 10 ** (currency === "QORT" ? 8 : priceDecimals(currency));
  return Math.round(value * f) / f;
}

/** What delivery to the address costs for these lines (cartLines' checkout lines, physical ones counted). */
export function quoteDelivery(args: {
  doc: DeliveryDoc | null;
  lines: readonly CartLine[];
  country: string;
  state: string;
  /** The shop's pricing in a currency (its product list's), when it has one. */
  pricing: FiatPricing | null;
  /** The shop takes ARRR: the fee gets an ARRR price from the rates, as products do. */
  takesArrr: boolean;
  /** The buyer's delivery option: an option's id, or "" (the default) for the zones' own prices. */
  option?: string;
}): DeliveryQuote {
  const { doc, pricing } = args;
  const optionId = args.option ?? "";
  const chosen = optionId ? doc?.options?.find((o) => o.id === optionId) : undefined;
  if (optionId && doc && !chosen) return { kind: "option-unavailable" };
  const physical = args.lines.filter((l) => l.product && l.product.type !== "digital");
  if (!doc || physical.length === 0) return { kind: "free", parts: [] };
  if (doc.currency !== "QORT" && (!pricing || pricing.currency !== doc.currency)) return { kind: "no-rates" };
  const country = countryCode(args.country);
  const state = country === US ? stateCode(args.state) : null;
  const groups = new Map<string, { profile: DeliveryProfile | null; lines: CartLine[] }>();
  for (const line of physical) {
    const profile = profileFor(doc, line.productId);
    const key = profile?.id ?? "";
    const group = groups.get(key) ?? { profile, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  const parts: DeliveryPart[] = [];
  const unavailable: string[] = [];
  for (const { profile, lines } of groups.values()) {
    const zones = profile ? profile.zones : doc.general.zones;
    const name = profile?.name ?? "Delivery";
    if (zones.length === 0) {
      parts.push({ profile: name, zone: "", items: lines.reduce((n, l) => n + l.quantity, 0), fee: 0 });
      continue;
    }
    const zone = country ? zoneFor(zones, country, state) : null;
    if (!zone) {
      unavailable.push(...lines.map((l) => String(l.product?.title ?? "An item")));
      continue;
    }
    // The zone's own prices, or its price for the chosen option (an option it doesn't price isn't offered).
    const rate: DeliveryRate | undefined = optionId ? zone.rates?.[optionId] : zone;
    if (!rate) return { kind: "option-unavailable" };
    const items = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((sum, l) => sum + unitInCurrency(l.product, doc.currency, pricing) * l.quantity, 0);
    const free = rate.freeOver !== undefined && subtotal + 1e-9 >= rate.freeOver;
    const fee = free ? 0 : rate.first + (rate.extra ?? 0) * Math.max(0, items - 1);
    parts.push({ profile: name, zone: zone.name ?? "", items, fee: round(fee, doc.currency) });
  }
  if (unavailable.length > 0) return { kind: "unavailable", titles: unavailable };
  const fee = round(parts.reduce((sum, p) => sum + p.fee, 0), doc.currency);
  // With options, the line says which one the buyer picked.
  const option = doc.options?.length ? { id: optionId, name: chosen?.name ?? doc.base?.name ?? BASE_OPTION_NAME } : null;
  if (!(fee > 0)) return { kind: "free", parts, ...(option && { option }) };
  const price: PricedProduct["price"] =
    doc.currency === "QORT" ? [{ currency: "qort", value: fee }] : priceListFromFiat(undefined, fee, pricing!.rates, args.takesArrr);
  const named = parts.filter((p) => p.fee > 0).map((p) => p.profile).filter((n) => n !== "Delivery");
  const title = `Delivery to ${args.country}${args.state && country === US ? ` (${args.state})` : ""}${option ? `, ${option.name}` : ""}${named.length ? `: ${named.join(", ")}` : ""}`;
  const product = {
    id: DELIVERY_LINE_ID,
    title,
    type: "delivery",
    price,
    delivery: {
      currency: doc.currency,
      value: fee,
      ...(doc.currency !== "QORT" && { qort: coinPriceFromFiat(fee, pricing!.rates.QORT) }),
      parts,
      ...(option && { option }),
    },
  };
  return { kind: "charge", fee, currency: doc.currency, parts, line: { productId: DELIVERY_LINE_ID, catalogueId: "", quantity: 1, product: product as CartLine["product"] } };
}

/** An order line that is the delivery fee, not a product. */
export function isDeliveryLine(key: string, line: { product?: { type?: unknown; id?: unknown } } | null | undefined): boolean {
  return key === DELIVERY_LINE_ID || line?.product?.type === "delivery";
}
