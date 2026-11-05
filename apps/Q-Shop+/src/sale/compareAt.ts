/**
 * A product on sale (Simon, 2026-10-25: what a marketplace for everyone still
 * misses): the price it had before, in the product's JSON as
 * `compareAt: {currency, value}` (additive: the original ignores it), in the
 * currency its price is typed in: QORT, or the shop's currency for a product
 * priced in one. Buyers see it crossed out with what they save. Checkout
 * never reads it: the price paid is the product's price, as always.
 */
import { qortPrice, type PricedProduct } from "../money/pricing";
import { fiatPriceOf } from "../money/fiatPricing";
import { jsonToBase64, type CatalogueDoc, type DataContainerDoc, type ProductDraft, type PublishResource } from "../qdn/payloads";

export interface CompareAt {
  currency: string;
  value: number;
}

/** The price before the sale, when the product has a well-formed one. */
export function compareAtOf(product: { compareAt?: unknown } | null | undefined): CompareAt | null {
  const raw = product?.compareAt as { currency?: unknown; value?: unknown } | undefined;
  if (!raw || typeof raw !== "object" || typeof raw.currency !== "string" || !raw.currency.trim()) return null;
  const value = typeof raw.value === "number" ? raw.value : NaN;
  return Number.isFinite(value) && value > 0 ? { currency: raw.currency.trim(), value } : null;
}

export interface Sale {
  was: CompareAt;
  /** The price now, in the same currency. */
  now: number;
  /** Whole percent off, 1 or more. */
  percent: number;
}

/** The product's sale: its price before is above its price now, in the same currency. Null when it isn't on sale. */
export function saleOf(product: (PricedProduct & { compareAt?: unknown }) | null | undefined): Sale | null {
  const was = compareAtOf(product);
  if (!was) return null;
  const now = was.currency === "QORT" ? qortPrice(product) : fiatPriceOf(product as never, was.currency)?.value;
  if (typeof now !== "number" || !(now > 0) || !(was.value > now)) return null;
  const percent = percentOff(was.value, now);
  return percent >= 1 ? { was, now, percent } : null;
}

/** Whole percent off (floating point aside: 10 → 8 is 20%, not 19%). */
export function percentOff(was: number, now: number): number {
  return Math.floor((1 - now / was) * 100 + 1e-9);
}

/** The draft with the form's price before the sale, or without one; `currency` is the price's own. */
export function withCompareAt<T extends Record<string, unknown>>(draft: T, typed: string | undefined, currency: string): T {
  if (typed === undefined) return draft;
  const value = Number(typed.trim().replace(",", "."));
  const rest = { ...draft } as Record<string, unknown>;
  delete rest.compareAt;
  if (!typed.trim() || !Number.isFinite(value) || value <= 0) return rest as T;
  return { ...rest, compareAt: { currency, value } } as unknown as T;
}

/** A product row's percent off (the index carries it, so lists show and filter sales without reading catalogues). */
export function rowSaleOf(entry: { sale?: unknown } | null | undefined): number | undefined {
  const sale = entry?.sale;
  return typeof sale === "number" && Number.isInteger(sale) && sale >= 1 && sale <= 99 ? sale : undefined;
}

/** Each saved product's row with its percent off (or without one), as published. */
export function withSaleRows<T extends { dataContainer: DataContainerDoc; resources: PublishResource[]; catalogues: CatalogueDoc[] }>(
  built: T,
  drafts: Record<string, ProductDraft>
): T {
  let changed = false;
  const products = { ...built.dataContainer.products } as Record<string, Record<string, unknown>>;
  for (const draft of Object.values(drafts)) {
    const row = products[draft.id];
    if (!row) continue;
    const percent = saleOf(draft as never)?.percent;
    if (percent) {
      if (row.sale !== percent) {
        products[draft.id] = { ...row, sale: Math.min(99, percent) };
        changed = true;
      }
    } else if ("sale" in row) {
      const rest = { ...row };
      delete rest.sale;
      products[draft.id] = rest;
      changed = true;
    }
  }
  if (!changed) return built;
  const dataContainer = { ...built.dataContainer, products } as DataContainerDoc;
  const resources = built.resources.map((r) => (r.identifier === dataContainer.id && r.service === "DOCUMENT" ? { ...r, data64: jsonToBase64(dataContainer) } : r));
  return { ...built, dataContainer, resources };
}
