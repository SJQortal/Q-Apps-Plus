/**
 * The product form's variants (variants/model.ts): the variants as typed,
 * each with its values (and their colours) and a picture of its own, how
 * lists show them, and each item's own price and picture; and the drafts
 * they make, one product per item, which wait in Ready to publish like any
 * other.
 *
 * Pictures: an item shows its own picture, else its variant's, else the
 * product's first. Those of the variants and items come on top of the
 * product's (up to 10), so a group can have many more pictures than one
 * product; the product's own aren't needed when every item has one.
 */
import { priceDecimals, type FiatPricing } from "../money/fiatPricing";
import { MAX_PRODUCT_PICTURES as MAX_PRODUCT_IMAGES } from "../qdn/productPictures";
import { productIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { newProductDraft, typedFiat, type ProductFormValues } from "../seller/productDraft";
import {
  MAX_OPTION_TEXT,
  MAX_OPTION_VALUES,
  MAX_VARIANTS,
  MAX_VARIANT_OPTIONS,
  itemCount,
  valuesKey,
  variantItems,
  variantLabel,
  variantTitle,
  type ProductVariant,
  type VariantDisplay,
  type VariantOption,
} from "./model";

export interface VariantRowValues {
  /** Its price as typed (in the shop's currency when the product's is, else QORT); "" is the product's. */
  price: string;
  /** Its own picture (one of the product's, or one added for it), or none. */
  picture: string | null;
}

/** A variant as the form holds it: with a picture of its own for its items. */
export interface VariantFormOption extends VariantOption {
  picture?: string | null;
}

export interface VariantFormValues {
  options: VariantFormOption[];
  display: VariantDisplay;
  /** By valuesKey(item). */
  rows: Record<string, VariantRowValues>;
}

export const NO_ROW: VariantRowValues = { price: "", picture: null };

/** The variants worth making items of: named, their values trimmed. */
export function usedOptions(form: VariantFormValues): VariantFormOption[] {
  return form.options
    .map((o) => ({ ...o, name: o.name.trim(), values: o.values.map((v) => ({ ...v, name: v.name.trim() })).filter((v) => v.name) }))
    .filter((o) => o.name);
}

/** A variant's price is in the shop's currency when the product's is (else QORT). */
export function variantPriceUnit(values: ProductFormValues, pricing: FiatPricing | null | undefined): string {
  return pricing && typedFiat(values, pricing) !== null ? pricing.currency : "QORT";
}

/** The picture an item shows: its own, its variant's, or the product's first. */
export function itemPicture(form: VariantFormValues, values: ProductFormValues, item: string[]): string | null {
  const row = form.rows[valuesKey(item)] ?? NO_ROW;
  return row.picture ?? form.options.find((o) => o.name.trim() === item[0])?.picture ?? values.images[0] ?? null;
}

/** What's wrong with the variants as typed, or null. */
export function variantFormProblem(form: VariantFormValues, values: ProductFormValues, pricing: FiatPricing | null | undefined): string | null {
  if (form.options.some((o) => !o.name.trim() && o.values.some((v) => v.name.trim()))) return "Name each variant (Round, Large…).";
  const options = usedOptions(form);
  if (options.length === 0) return "Add a variant, or turn variants off.";
  if (options.length > MAX_VARIANT_OPTIONS) return `Use at most ${MAX_VARIANT_OPTIONS} variants.`;
  if (new Set(options.map((o) => o.name.toLowerCase())).size !== options.length) return "Two variants have the same name.";
  for (const o of options) {
    if (o.name.length > MAX_OPTION_TEXT || o.values.some((v) => v.name.length > MAX_OPTION_TEXT)) return `Keep names and values to ${MAX_OPTION_TEXT} characters.`;
    if (o.values.length > MAX_OPTION_VALUES) return `${o.name}: at most ${MAX_OPTION_VALUES} values.`;
    if (new Set(o.values.map((v) => v.name.toLowerCase())).size !== o.values.length) return `${o.name} has the same value twice.`;
  }
  const total = itemCount(options);
  if (total < 2) return "Variants need at least two choices: two variants, or a variant with two values.";
  if (total > MAX_VARIANTS) return `That makes ${total} items: ${MAX_VARIANTS} at most. Use fewer values.`;
  const unit = variantPriceUnit(values, pricing);
  const decimals = unit === "QORT" ? 8 : priceDecimals(unit);
  for (const item of variantItems(options)) {
    const row = form.rows[valuesKey(item)] ?? NO_ROW;
    const price = row.price.trim();
    if (price && !(new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(price) && Number(price) > 0)) return `Check the price of ${variantLabel(item)}.`;
    if (!itemPicture(form, values, item)) return `Add a picture for ${variantLabel(item)}: its own, its variant's, or the product's.`;
  }
  return null;
}

/**
 * One draft per item, the first one the lead: it carries the product's
 * pictures after its own; the others theirs only. Each is named for its
 * variant and value, and priced at its own price or the product's.
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
  const used = usedOptions(form);
  const options: VariantOption[] = used.map((o) => ({ name: o.name, values: o.values.map((v) => (v.color ? { name: v.name, color: v.color } : { name: v.name })) }));
  const group = args.uid();
  const items = variantItems(options);
  const inFiat = variantPriceUnit(values, pricing) !== "QORT";
  const uids = items.map(() => args.uid());
  const leadId = productIdentifier(shortStoreIdOf(storeId), uids[0]);
  return items.map((item, i) => {
    const row = form.rows[valuesKey(item)] ?? NO_ROW;
    const own = row.picture ?? used.find((o) => o.name === item[0])?.picture ?? null;
    const images = i === 0 ? [...new Set([own, ...values.images].filter((img): img is string => !!img))].slice(0, MAX_PRODUCT_IMAGES) : [own ?? values.images[0]];
    const price = row.price.trim();
    const priced: ProductFormValues = {
      ...values,
      title: variantTitle(values.title, item),
      images,
      ...(price && (inFiat ? { fiat: price } : { prices: { ...values.prices, QORT: price } })),
    };
    const variant: ProductVariant = { group, title: values.title.trim(), options, values: item, display: form.display, lead: leadId };
    return { ...newProductDraft({ values: priced, coins, storeId, name, uid: uids[i], now, pricing }), variant };
  });
}
