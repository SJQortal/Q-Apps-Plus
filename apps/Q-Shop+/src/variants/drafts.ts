/**
 * The product form's variants (variants/model.ts): the options as typed,
 * how lists show them, and each combination's own price and picture; and
 * the drafts they make, one product per combination, which wait in Ready to
 * publish like any other.
 */
import { priceDecimals, type FiatPricing } from "../money/fiatPricing";
import { productIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { newProductDraft, typedFiat, type ProductFormValues } from "../seller/productDraft";
import {
  MAX_OPTION_TEXT,
  MAX_OPTION_VALUES,
  MAX_VARIANTS,
  MAX_VARIANT_OPTIONS,
  combinations,
  valuesKey,
  variantTitle,
  type ProductVariant,
  type VariantDisplay,
  type VariantOption,
} from "./model";

export interface VariantRowValues {
  /** Its price as typed (in the shop's currency when it prices in one, else QORT); "" is the product's. */
  price: string;
  /** Which of the product's pictures is its own (an index), or none: the product's first. */
  picture: number | null;
}

export interface VariantFormValues {
  options: VariantOption[];
  display: VariantDisplay;
  /** By valuesKey(values). */
  rows: Record<string, VariantRowValues>;
}

export const NO_ROW: VariantRowValues = { price: "", picture: null };

/** The options worth making variants of: named, with values. */
export function usedOptions(form: VariantFormValues): VariantOption[] {
  return form.options
    .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
    .filter((o) => o.name && o.values.length > 0);
}

/** A variant's price is in the shop's currency when the product's is (else QORT). */
export function variantPriceUnit(values: ProductFormValues, pricing: FiatPricing | null | undefined): string {
  return pricing && typedFiat(values, pricing) !== null ? pricing.currency : "QORT";
}

/** What's wrong with the variants as typed, or null. */
export function variantFormProblem(form: VariantFormValues, values: ProductFormValues, pricing: FiatPricing | null | undefined): string | null {
  const options = usedOptions(form);
  if (form.options.some((o) => !o.name.trim() && o.values.some((v) => v.trim()))) return "Name each option (Size, Colour…).";
  if (form.options.some((o) => o.name.trim() && o.values.every((v) => !v.trim()))) return "Give each option its values (S, M, L…).";
  if (options.length === 0) return "Add an option with its values, or turn variants off.";
  if (options.length > MAX_VARIANT_OPTIONS) return `Use at most ${MAX_VARIANT_OPTIONS} options.`;
  if (new Set(options.map((o) => o.name.toLowerCase())).size !== options.length) return "Two options have the same name.";
  for (const o of options) {
    if (o.name.length > MAX_OPTION_TEXT || o.values.some((v) => v.length > MAX_OPTION_TEXT)) return `Keep option names and values to ${MAX_OPTION_TEXT} characters.`;
    if (o.values.length > MAX_OPTION_VALUES) return `${o.name}: at most ${MAX_OPTION_VALUES} values.`;
    if (new Set(o.values.map((v) => v.toLowerCase())).size !== o.values.length) return `${o.name} has the same value twice.`;
  }
  const all = combinations(options);
  if (all.length < 2) return "Variants need at least two choices (two sizes, say).";
  const total = options.reduce((n, o) => n * o.values.length, 1);
  if (total > MAX_VARIANTS) return `That makes ${total} variants: ${MAX_VARIANTS} at most. Use fewer values.`;
  const unit = variantPriceUnit(values, pricing);
  const decimals = unit === "QORT" ? 8 : priceDecimals(unit);
  for (const combo of all) {
    const row = form.rows[valuesKey(combo)] ?? NO_ROW;
    const price = row.price.trim();
    if (price && !(new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(price) && Number(price) > 0)) return `Check the price of ${combo.join(" / ")}.`;
    if (row.picture !== null && !values.images[row.picture]) return `Pick ${combo.join(" / ")}'s picture again.`;
  }
  return null;
}

/**
 * One draft per combination, the first one the lead: it carries the
 * product's pictures (its own first), the others theirs only (or the
 * product's first). Each is named for its options, and priced at its own
 * price or the product's.
 */
export function variantDrafts(args: {
  values: ProductFormValues;
  form: VariantFormValues;
  coins: string[];
  storeId: string;
  name: string;
  /** A new uid each call: the group's, then each product's. */
  uid: () => string;
  now: number;
  pricing?: FiatPricing | null;
}) {
  const { values, form, coins, storeId, name, now, pricing } = args;
  const options = usedOptions(form);
  const group = args.uid();
  const all = combinations(options);
  const inFiat = variantPriceUnit(values, pricing) !== "QORT";
  const uids = all.map(() => args.uid());
  const leadId = productIdentifier(shortStoreIdOf(storeId), uids[0]);
  return all.map((combo, i) => {
    const row = form.rows[valuesKey(combo)] ?? NO_ROW;
    const own = row.picture !== null ? values.images[row.picture] : undefined;
    const images = i === 0 ? (own ? [own, ...values.images.filter((img) => img !== own)] : values.images) : [own ?? values.images[0]];
    const price = row.price.trim();
    const priced: ProductFormValues = {
      ...values,
      title: variantTitle(values.title, combo),
      images,
      ...(price && (inFiat ? { fiat: price } : { prices: { ...values.prices, QORT: price } })),
    };
    const variant: ProductVariant = { group, title: values.title.trim(), options, values: combo, display: form.display, lead: leadId };
    return { ...newProductDraft({ values: priced, coins, storeId, name, uid: uids[i], now, pricing }), variant };
  });
}
