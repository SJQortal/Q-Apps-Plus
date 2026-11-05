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
 *
 * A published group is edited as one (Simon, 2026-10-24: "edditing any even
 * if user chose each item on its own, edits all of those"): the form starts
 * from its items (groupFormValues), and saving makes a draft for each, new
 * items included; an item taken out is retired, or dropped while it is only
 * a draft (groupEditDrafts).
 */
import { stockFormProblem } from "../stock/catalog";
import type { ProductStock } from "../stock/model";
import { priceDecimals, type FiatPricing } from "../money/fiatPricing";
import { MAX_PRODUCT_PICTURES as MAX_PRODUCT_IMAGES } from "../qdn/productPictures";
import { productIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { editedProductDraft, formValuesFor, newProductDraft, parseAmount, typedFiat, type ProductFormValues } from "../seller/productDraft";
import { RETIRED } from "../constants/product-status";
import {
  MAX_OPTION_TEXT,
  MAX_OPTION_VALUES,
  MAX_VARIANTS,
  MAX_VARIANT_OPTIONS,
  itemCount,
  valuesKey,
  variantLabel,
  variantOf,
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
  /** In an edited group: the item's product (none for a new item). */
  productId?: string;
  /** In an edited group: its stock (a new item is available). */
  status?: string;
  /**
   * In an edited group: its own QORT price as published, when it has no
   * price in the shop's currency, kept while no price is typed for it.
   */
  qort?: string;
  /**
   * Its own price in the shop's other coins (`ASSET:<id>`, and ARRR when it
   * doesn't follow the currency), by coin; empty or absent: the product's.
   */
  coins?: Record<string, string>;
  /** Its units in stock now, as typed, when the product counts stock (stock/catalog.ts); "" keeps its count. */
  stock?: string;
  /** In an edited group: its count as published. */
  stockSaved?: ProductStock | null;
}

/** A variant as the form holds it: with a picture of its own for its items. */
export interface VariantFormOption extends VariantOption {
  picture?: string | null;
  /** The form's own (never stored): its items keep their rows while it is renamed. */
  id?: string;
}

let lastOptionId = 0;

/** A new, empty variant. */
export function newFormOption(): VariantFormOption {
  lastOptionId += 1;
  return { id: `v${lastOptionId}`, name: "", values: [], picture: null };
}

/** The key of an item's row: its variant (by its id, else its name) and its value. */
export function rowKey(option: VariantFormOption, value?: string): string {
  const variant = option.id ?? option.name.trim();
  return value === undefined ? variant : valuesKey([variant, value]);
}

export interface FormItem {
  values: string[];
  key: string;
}

/** Every item as typed, in order (variants/model.ts variantItems), with its row's key. At most MAX_VARIANTS. */
export function formItems(form: VariantFormValues): FormItem[] {
  const out: FormItem[] = [];
  for (const o of usedOptions(form)) {
    if (o.values.length === 0) out.push({ values: [o.name], key: rowKey(o) });
    else for (const v of o.values) out.push({ values: [o.name, v.name], key: rowKey(o, v.name) });
  }
  return out.slice(0, MAX_VARIANTS);
}

/** The options as stored: names, values and colours. */
function storedOptions(used: VariantFormOption[]): VariantOption[] {
  return used.map((o) => ({ name: o.name, values: o.values.map((v) => (v.color ? { name: v.name, color: v.color } : { name: v.name })) }));
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

/**
 * Items are priced in the shop's currency whenever it prices in one, with a
 * price for the product or not (Simon, 2026-10-24: "in variants user can add
 * USD price if he has USD or other currency price set up (not only when he
 * adds the USD price at the top)"); else in QORT.
 */
export function variantPriceUnit(_values: ProductFormValues, pricing: FiatPricing | null | undefined): string {
  return pricing ? pricing.currency : "QORT";
}

/**
 * The shop's coins an item can have its own price in besides its main one
 * (Simon, 2026-10-24: "for the variants the price in Q-asset that was
 * selected for the shop can also be added"): its Q-Assets, and ARRR unless
 * it follows the shop's currency.
 */
export function itemExtraCoins(coins: string[], pricing: FiatPricing | null | undefined): string[] {
  return coins.filter((c) => c !== "QORT" && !(pricing && c === "ARRR"));
}

/** The product's own price is set: in the shop's currency, or in QORT. */
export function hasBasePrice(values: ProductFormValues, pricing: FiatPricing | null | undefined): boolean {
  return typedFiat(values, pricing) !== null || parseAmount(values.prices.QORT ?? "") > 0;
}

/** The picture an item shows: its own, its variant's, or the product's first. */
export function itemPicture(form: VariantFormValues, values: ProductFormValues, item: string[]): string | null {
  const option = form.options.find((o) => o.name.trim() === item[0]);
  const row = form.rows[option ? rowKey(option, item[1]) : valuesKey(item)] ?? NO_ROW;
  return row.picture ?? option?.picture ?? values.images[0] ?? null;
}

/** What's wrong with the variants as typed, or null. */
export function variantFormProblem(
  form: VariantFormValues,
  values: ProductFormValues,
  pricing: FiatPricing | null | undefined,
  coinOptions: { label?: (coin: string) => string; wholeOnly?: string[] } = {}
): string | null {
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
  for (const { values: item, key } of formItems(form)) {
    const row = form.rows[key] ?? NO_ROW;
    const price = row.price.trim();
    if (price && !(new RegExp(`^\\d*\\.?\\d{0,${decimals}}$`).test(price) && Number(price) > 0)) return `Check the price of ${variantLabel(item)}.`;
    if (!price && !row.qort && !hasBasePrice(values, pricing)) return `Set a price for ${variantLabel(item)}, or one for the product.`;
    for (const [coin, text] of Object.entries(row.coins ?? {})) {
      const amount = text.trim();
      if (!amount) continue;
      const name = coinOptions.label?.(coin) ?? coin;
      if (!(parseAmount(amount) > 0)) return `Check the ${name} price of ${variantLabel(item)}.`;
      if (coinOptions.wholeOnly?.includes(coin) && !Number.isInteger(parseAmount(amount))) return `Use whole units for the ${name} price of ${variantLabel(item)}: it can't be split.`;
    }
    if (!itemPicture(form, values, item)) return `Add a picture for ${variantLabel(item)}: its own, its variant's, or the product's.`;
    const stock = stockFormProblem(values.stock?.tracked ? { tracked: true, quantity: row.stock ?? "", saved: row.stockSaved ?? null } : undefined, variantLabel(item));
    if (stock) return stock;
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
  const options = storedOptions(used);
  const group = args.uid();
  const items = formItems(form);
  const uids = items.map(() => args.uid());
  const leadId = productIdentifier(shortStoreIdOf(storeId), uids[0]);
  return items.map(({ values: item, key }, i) => {
    const priced = itemValues(values, form, used, item, form.rows[key] ?? NO_ROW, i === 0, pricing);
    const variant: ProductVariant = { group, title: values.title.trim(), options, values: item, display: form.display, lead: leadId };
    return { ...newProductDraft({ values: priced, coins, storeId, name, uid: uids[i], now, pricing }), variant };
  });
}

/** An item's own values: named for its variant and value, its pictures (the lead's own, then the product's) and its price. */
function itemValues(
  values: ProductFormValues,
  form: VariantFormValues,
  used: VariantFormOption[],
  item: string[],
  row: VariantRowValues,
  lead: boolean,
  pricing: FiatPricing | null | undefined
): ProductFormValues {
  const own = row.picture ?? used.find((o) => o.name === item[0])?.picture ?? null;
  const images = lead
    ? [...new Set([own, ...values.images].filter((img): img is string => !!img))].slice(0, MAX_PRODUCT_IMAGES)
    : [own ?? values.images[0]].filter((img): img is string => !!img);
  const price = row.price.trim();
  const inFiat = variantPriceUnit(values, pricing) !== "QORT";
  // Its own prices in other coins (a Q-Asset…) over the product's.
  const coinPrices = Object.fromEntries(Object.entries(row.coins ?? {}).filter(([, text]) => text.trim()).map(([coin, text]) => [coin, text.trim()]));
  const prices = { ...values.prices, ...coinPrices };
  return {
    ...values,
    title: variantTitle(values.title, item),
    images,
    prices,
    // Each item counts its own units (the product's switch turns counting on for all of them).
    stock: values.stock && (values.stock.tracked ? { tracked: true, quantity: row.stock ?? "", saved: row.stockSaved ?? null } : { tracked: false, quantity: "" }),
    ...(price
      ? inFiat
        ? { fiat: price }
        : { prices: { ...prices, QORT: price } }
      : // An edited item with a QORT price of its own (none in the currency) keeps it,
        // and the group's price before a sale (typed in the currency) doesn't apply to it.
        row.qort && { fiat: "", prices: { ...prices, QORT: row.qort }, ...(inFiat && { compareAt: undefined }) }),
  };
}

type Base = Record<string, any> & { id: string };

/**
 * An edited group as the form starts from it: its variants and values (with
 * their colours), how lists show it, and a row for each of its items: its
 * product and stock, its price when it isn't the lead's, and its picture
 * when it isn't the product's first. The product's own fields and pictures
 * are the lead's (`lead`, as formValuesFor gives them).
 */
export function groupFormValues(args: {
  variant: ProductVariant;
  members: Base[];
  lead: ProductFormValues;
  coins: string[];
  pricing?: FiatPricing | null;
}): VariantFormValues {
  const { variant, members, lead, coins, pricing } = args;
  const options: VariantFormOption[] = variant.options.map((o, i) => ({ id: `g${i}`, name: o.name, values: o.values.map((v) => ({ ...v })), picture: null }));
  const unit = variantPriceUnit(lead, pricing);
  const fiatOf = (v: ProductFormValues) => (v.fiat ?? "").trim();
  const qortOf = (v: ProductFormValues) => (v.prices.QORT ?? "").trim();
  const rows: Record<string, VariantRowValues> = {};
  for (const member of members) {
    const item = variantOf(member)?.values;
    const option = item && options.find((o) => o.name === item[0]);
    if (!item || !option) continue;
    const own = formValuesFor(member, coins, pricing);
    const picture = own.images[0] ?? null;
    const row: VariantRowValues = {
      productId: member.id,
      status: own.status,
      price: "",
      picture: picture && picture !== lead.images[0] ? picture : null,
      ...(own.stock?.saved && { stockSaved: own.stock.saved }),
    };
    if (unit === "QORT") {
      if (qortOf(own) && qortOf(own) !== qortOf(lead)) row.price = qortOf(own);
    } else if (fiatOf(own)) {
      if (fiatOf(own) !== fiatOf(lead)) row.price = fiatOf(own);
    } else if (qortOf(own) && (fiatOf(lead) || qortOf(own) !== qortOf(lead))) {
      // Priced in QORT only, unlike the product: it keeps that price until one is typed.
      row.qort = qortOf(own);
    }
    // Its own price in another coin, where it differs from the product's.
    for (const coin of itemExtraCoins(coins, pricing)) {
      const mine = (own.prices[coin] ?? "").trim();
      if (mine && mine !== (lead.prices[coin] ?? "").trim()) row.coins = { ...row.coins, [coin]: mine };
    }
    rows[rowKey(option, item[1])] = row;
  }
  return { options, display: variant.display, rows };
}

/** The group's products the form no longer has as items (a value or a variant taken out). */
export function removedMembers(form: VariantFormValues, members: Base[]): Base[] {
  const kept = new Set(formItems(form).map((item) => form.rows[item.key]?.productId).filter(Boolean));
  return members.filter((m) => !kept.has(m.id));
}

/**
 * An edited group's drafts: each item's product edited (or a new one for a
 * new item), named, priced and pictured as variantDrafts does, with its own
 * stock; the first is the lead. A product taken out is retired and leaves
 * the group (it stays in Products to delete), or is `dropped` from the
 * drafts while it was never published.
 */
export function groupEditDrafts(args: {
  values: ProductFormValues;
  form: VariantFormValues;
  group: string;
  members: Base[];
  coins: string[];
  storeId: string;
  name: string;
  uid: () => string;
  now: number;
  pricing?: FiatPricing | null;
}): { drafts: Base[]; dropped: string[] } {
  const { values, form, group, members, coins, storeId, name, now, pricing } = args;
  const used = usedOptions(form);
  const options = storedOptions(used);
  const byId = new Map(members.map((m) => [m.id, m]));
  const plan = formItems(form).map(({ values: item, key }) => {
    const row = form.rows[key] ?? NO_ROW;
    const base = row.productId ? byId.get(row.productId) : undefined;
    const uid = base ? "" : args.uid();
    return { item, row, base, uid, id: base?.id ?? productIdentifier(shortStoreIdOf(storeId), uid) };
  });
  const lead = plan[0]?.id ?? "";
  const drafts: Base[] = plan.map(({ item, row, base, uid }, i) => {
    const priced = { ...itemValues(values, form, used, item, row, i === 0, pricing), status: row.status ?? "AVAILABLE" };
    const variant: ProductVariant = { group, title: values.title.trim(), options, values: item, display: form.display, lead };
    const draft = base ? editedProductDraft({ base, values: priced, coins, name, pricing, now }) : newProductDraft({ values: priced, coins, storeId, name, uid, now, pricing });
    return { ...draft, variant };
  });
  const dropped: string[] = [];
  for (const member of removedMembers(form, members)) {
    if (!member.isUpdate && !member.catalogueId) {
      dropped.push(member.id);
      continue;
    }
    const { variant: _left, ...rest } = member;
    drafts.push({ ...rest, isUpdate: true, status: RETIRED, user: name });
  }
  return { drafts, dropped };
}
