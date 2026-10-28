/**
 * A shop's pricing in a currency as its product index holds it, and its
 * rates as text (money/fiatPricing.ts has the rest): small and import-free,
 * so the header's QORT rate (components/layout/Navbar/QuickRateButton.tsx)
 * doesn't bring the pricing code into the first download.
 */

export interface FiatRates {
  /** One QORT in the currency. */
  QORT: number;
  /** One ARRR in the currency; none: buyers paying in ARRR pay the QORT price at the node's rate. */
  ARRR?: number;
}

export interface FiatPricing {
  currency: string;
  rates: FiatRates;
  updated: number;
}

/** Rates are typed with up to 8 decimals (one QORT may be worth less than a cent). */
export const RATE_DECIMALS = 8;

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

/** A currency the app can price in: 2 to 10 letters or digits, not the coins it works out (QORT, ARRR). */
export function isValidTicker(ticker: string): boolean {
  return /^[A-Z0-9]{2,10}$/.test(ticker) && ticker !== "QORT" && ticker !== "ARRR";
}

const isCurrency = (value: unknown): value is string => typeof value === "string" && isValidTicker(value);

/** The shop's pricing as its product index holds it, or null (none, stopped, or malformed). */
export function fiatPricingOf(index: object | null | undefined): FiatPricing | null {
  const raw = (index as { fiatPricing?: unknown } | null | undefined)?.fiatPricing;
  if (!raw || typeof raw !== "object") return null;
  const { currency, rates, updated } = raw as { currency?: unknown; rates?: unknown; updated?: unknown };
  if (!isCurrency(currency) || !rates || typeof rates !== "object") return null;
  const { QORT, ARRR } = rates as { QORT?: unknown; ARRR?: unknown };
  if (!positive(QORT)) return null;
  return { currency, rates: { QORT, ...(positive(ARRR) && { ARRR }) }, updated: positive(updated) ? updated : 0 };
}

/** A rate as typed: "0.18", never an exponent. */
export function rateToText(rate: number | undefined): string {
  if (!positive(rate)) return "";
  return rate.toFixed(RATE_DECIMALS).replace(/0+$/, "").replace(/\.$/, "");
}
