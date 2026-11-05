/**
 * Prices in a currency like USD, at exchange rates the seller types in
 * (community request, 2026-10-22: "set all my prices in my chosen currency
 * (USD)… choose the exchange rate I want to use for QORT and ARRR… I do not
 * mean that it should go out to web2"). Nothing here asks anything outside
 * Qortal: the rates are the seller's own numbers.
 *
 * Buyers still pay the QORT and ARRR prices published on each product, as in
 * the original: this only works those prices out for the seller, and
 * publishes them again when a rate changes. Checkout and the pinned money
 * code don't change. New data, additive only (CLAUDE.md rule 1):
 * - the product index gains `fiatPricing: { currency, rates: { QORT, ARRR? }, updated }`
 *   (rates: how much one coin is worth in the currency), or `null` once the
 *   seller stops (so an older copy can't switch it back on);
 * - a product priced this way gains `fiatPrice: { currency, value, qort }`:
 *   its price in the currency, and the QORT price that gave. A product whose
 *   QORT price no longer matches `qort` was repriced elsewhere (the
 *   original's form, which keeps unknown fields): it no longer follows the
 *   rate until the seller sets its price in the currency again.
 * Products without a price in the currency keep their QORT and ARRR prices.
 * Asset prices are never touched.
 */
import { jsonToBase64, type CatalogueDoc, type DataContainerDoc, type PublishResource } from "../qdn/payloads";
import { dataContainerIdentifier } from "../qdn/identifiers";
import { type FiatPricing, type FiatRates } from "./fiatRates";

// The shop's pricing and its rates, kept light for the header (money/fiatRates.ts).
export { RATE_DECIMALS, fiatPricingOf, isValidTicker, rateToText, type FiatPricing, type FiatRates } from "./fiatRates";

/**
 * The currencies offered, USD first (PLN and ISK: Simon, 2026-10-22). The
 * seller can also type a ticker of their own (`isValidTicker`: XAU, USDT,
 * SATS…), priced with up to 8 decimals.
 */
export const FIAT_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CHF",
  "PLN",
  "SEK",
  "ISK",
  "JPY",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "ZAR",
  "NZD",
] as const;

/** One of the offered currencies (prices with 2 decimals), as opposed to a ticker the seller typed. */
export function isListedCurrency(currency: string): boolean {
  return (FIAT_CURRENCIES as readonly string[]).includes(currency);
}

/** A ticker as typed, cleaned: upper case, letters and digits only, at most 10. */
export function normalizeTicker(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

/** Decimals a price in the currency takes: 2 for the offered currencies, 8 for a ticker of the seller's own (0.00012 BTC). */
export function priceDecimals(currency: string): number {
  return isListedCurrency(currency) ? 2 : 8;
}

/** A price in the currency as a field starts with: "12.50", or for a ticker of the seller's own "0.00012". */
export function fiatToText(value: number, currency: string): string {
  if (isListedCurrency(currency)) return value.toFixed(2);
  return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

export interface FiatPrice {
  currency: string;
  value: number;
  /** The QORT price this gave. */
  qort: number;
}

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
/** The QORT price on a product (`{currency: "qort"}`), or undefined. */
export function qortPriceOf(product: { price?: unknown } | null | undefined): number | undefined {
  const list = Array.isArray(product?.price) ? (product.price as { currency?: unknown; value?: unknown }[]) : [];
  const value = list.find((p) => p?.currency === "qort")?.value;
  return positive(value) ? value : undefined;
}

/** Two coin prices the same, as stored (8 decimals). */
function samePrice(a: number | undefined, b: number | undefined): boolean {
  return a !== undefined && b !== undefined && Math.round(a * 1e8) === Math.round(b * 1e8);
}

/**
 * The product's price in `currency` when it still follows it: it has one, in
 * that currency, and its QORT price is still the one that price gave.
 */
export function fiatPriceOf(product: { price?: unknown; fiatPrice?: unknown } | null | undefined, currency: string): FiatPrice | null {
  const raw = product?.fiatPrice as { currency?: unknown; value?: unknown; qort?: unknown } | undefined;
  if (!raw || typeof raw !== "object" || raw.currency !== currency || !positive(raw.value) || !positive(raw.qort)) return null;
  if (!samePrice(qortPriceOf(product), raw.qort)) return null;
  return { currency, value: raw.value, qort: raw.qort };
}

/** A product priced in the currency once, whose QORT price was changed elsewhere since: its old price, else null. */
export function staleFiatPriceOf(product: { price?: unknown; fiatPrice?: unknown } | null | undefined, currency: string): number | null {
  const raw = product?.fiatPrice as { currency?: unknown; value?: unknown } | undefined;
  if (!raw || raw.currency !== currency || !positive(raw.value) || fiatPriceOf(product, currency)) return null;
  return raw.value;
}

/**
 * A coin price from a price in the currency: two decimals from 1 coin up
 * (69.44 QORT), four significant digits below (0.5556), never under the
 * coin's smallest unit.
 */
export function coinPriceFromFiat(value: number, rate: number): number {
  if (!positive(value) || !positive(rate)) return NaN;
  const raw = value / rate;
  let rounded: number;
  if (raw >= 1) rounded = Math.round(raw * 100) / 100;
  else {
    const digits = 4 - Math.ceil(Math.log10(raw));
    const factor = 10 ** Math.min(digits, 8);
    rounded = Math.round(raw * factor) / factor;
  }
  return Math.max(rounded, 1e-8);
}

/** A typed price or rate in the currency: up to `decimals` decimals, above 0; NaN otherwise. */
export function parseFiat(text: string, decimals = 2): number {
  const t = text.trim().replace(/,/g, ".");
  if (!t || !new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(t) || t === ".") return NaN;
  const n = Number(t);
  return n > 0 ? n : NaN;
}

/** What a seller types into a price or rate field in the currency, cleaned as they type (comma to dot, `decimals` at most). */
export function sanitizeFiatInput(text: string, decimals = 2): string {
  const cleaned = text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned;
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1).replace(/\./g, "").slice(0, decimals)}`;
}

/**
 * "$12.50", "€3.00", "¥1,200" (the browser's own currency names; nothing is
 * fetched), written as prices are, whatever the device's language;
 * "0.00012 XAU" for a ticker of the seller's own.
 */
export function formatFiat(value: number, currency: string): string {
  if (!isListedCurrency(currency)) return `${fiatToText(value, currency)} ${currency}`;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * A product's `price` list for a price in the currency: QORT first, then
 * ARRR when the shop takes it and there is an ARRR rate (no ARRR entry
 * without one: checkout then converts the QORT price at the node's rate, as
 * the original does), then every other entry as it was (assets).
 */
export function priceListFromFiat(
  existing: { currency: string; value: number }[] | undefined,
  value: number,
  rates: FiatRates,
  takesArrr: boolean
): { currency: string; value: number }[] {
  const list = [{ currency: "qort", value: coinPriceFromFiat(value, rates.QORT) }];
  if (takesArrr && positive(rates.ARRR)) list.push({ currency: "ARRR", value: coinPriceFromFiat(value, rates.ARRR) });
  for (const entry of existing ?? []) {
    if (!entry || entry.currency === "qort" || entry.currency === "ARRR") continue;
    list.push(entry);
  }
  return list;
}

/**
 * One product priced from the currency: its `price` list, and `fiatPrice`
 * with the QORT price it gave, the rest unchanged (the original's shape,
 * key order included; `fiatPrice` is added at the end).
 */
export function productPricedInFiat<T extends Record<string, unknown>>(
  product: T,
  value: number,
  pricing: Pick<FiatPricing, "currency" | "rates">,
  takesArrr: boolean
): T & { fiatPrice: FiatPrice } {
  const price = priceListFromFiat(product.price as { currency: string; value: number }[] | undefined, value, pricing.rates, takesArrr);
  const { fiatPrice: _old, ...rest } = product as Record<string, unknown>;
  return { ...rest, price, fiatPrice: { currency: pricing.currency, value, qort: price[0].value } } as unknown as T & { fiatPrice: FiatPrice };
}

/** The product without `fiatPrice` (its prices as they are). */
export function withoutFiatPrice<T extends Record<string, unknown>>(product: T): T {
  if (!("fiatPrice" in product)) return product;
  const { fiatPrice: _old, ...rest } = product as Record<string, unknown>;
  return rest as T;
}

/** The same JSON, whatever the key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export interface PriceChange {
  productId: string;
  /** The product's price in the currency, or null: it stops following it. */
  value: number | null;
  before: { qort?: number; arrr?: number };
  after: { qort?: number; arrr?: number };
}

const arrrOf = (product: { price?: unknown } | null | undefined): number | undefined => {
  const list = Array.isArray(product?.price) ? (product.price as { currency?: unknown; value?: unknown }[]) : [];
  const value = list.find((p) => p?.currency === "ARRR")?.value;
  return positive(value) ? value : undefined;
};

/**
 * What publishing would change, worked out from the products as the page
 * holds them: each product given a price in the currency whose priced copy
 * differs from it, and each product that stops following one (`null`, only
 * when it has a `fiatPrice`). Unchanged products are left out, so their
 * catalogues aren't read or sent again. (The product list is read fresh
 * before publishing: a price changed on another device changes it, and
 * stops the publish.)
 */
export function priceChanges(
  products: { productId: string; product: Record<string, unknown> | undefined; value: number | null }[],
  pricing: Pick<FiatPricing, "currency" | "rates">,
  takesArrr: boolean
): PriceChange[] {
  const out: PriceChange[] = [];
  for (const { productId, product, value } of products) {
    if (!product) continue;
    if (value === null && !("fiatPrice" in product)) continue;
    const next = value !== null ? productPricedInFiat(product, value, pricing, takesArrr) : withoutFiatPrice(product);
    if (canonical(next) === canonical(product)) continue;
    out.push({
      productId,
      value,
      before: { qort: qortPriceOf(product), arrr: arrrOf(product) },
      after: { qort: qortPriceOf(next), arrr: arrrOf(next) },
    });
  }
  return out;
}

/** A price missing from the catalogues the publish needs (couldn't be read). */
export class MissingPriceCatalogueError extends Error {
  readonly catalogueId: string;
  constructor(catalogueId: string) {
    super(`The catalogue ${catalogueId} isn't loaded`);
    this.name = "MissingPriceCatalogueError";
    this.catalogueId = catalogueId;
  }
}

/**
 * Publish prices: every product in `prices` (product id → its price in the
 * currency, or null to stop following it) is priced again in its catalogue,
 * the product index gets the new QORT prices and `fiatPricing` (or `null`
 * when `pricing` is null: the seller stopped), and goes last. Products not
 * in `prices`, and catalogues none of whose products change, aren't
 * republished. `catalogues` are the JSONs as read from QDN just before (raw:
 * no Redux fields), so the other products in them keep what is on QDN now.
 */
export function buildPricesPublish(args: {
  name: string;
  dataContainer: DataContainerDoc;
  catalogues: Record<string, CatalogueDoc>;
  prices: Record<string, number | null>;
  pricing: Pick<FiatPricing, "currency" | "rates"> | null;
  takesArrr: boolean;
  now: number;
}) {
  const { name, dataContainer, catalogues, prices, pricing, takesArrr } = args;
  const dc: DataContainerDoc = {
    ...dataContainer,
    products: structuredClone(dataContainer.products ?? {}),
    fiatPricing: pricing ? { currency: pricing.currency, rates: { ...pricing.rates }, updated: args.now } : null,
  };
  const changed = new Map<string, CatalogueDoc>();
  const changedProducts: string[] = [];
  for (const [productId, value] of Object.entries(prices)) {
    const entry = dc.products[productId];
    if (!entry?.catalogueId) continue;
    const catalogue = changed.get(entry.catalogueId) ?? catalogues[entry.catalogueId];
    if (!catalogue?.products || typeof catalogue.products !== "object") throw new MissingPriceCatalogueError(entry.catalogueId);
    const product = catalogue.products[productId] as Record<string, unknown> | undefined;
    if (!product) continue;
    const next = value !== null && pricing ? productPricedInFiat(product, value, pricing, takesArrr) : withoutFiatPrice(product);
    if (canonical(next) === canonical(product)) continue;
    const copy = changed.get(entry.catalogueId) ?? structuredClone(catalogue);
    copy.products[productId] = next;
    changed.set(entry.catalogueId, copy);
    changedProducts.push(productId);
    const qort = qortPriceOf(next);
    if (qort !== undefined) dc.products[productId] = { ...entry, priceQort: qort };
  }
  const resources: PublishResource[] = [
    ...[...changed.values()].map((cat) => ({
      name,
      service: "DOCUMENT",
      identifier: cat.id,
      filename: "catalogue.json",
      data64: jsonToBase64(cat),
    })),
    {
      name,
      service: "DOCUMENT",
      identifier: dc.id || dataContainerIdentifier(dc.storeId),
      filename: "datacontainer.json",
      data64: jsonToBase64(dc),
    },
  ];
  return { dataContainer: dc, catalogues: [...changed.values()], changedProducts, resources };
}
