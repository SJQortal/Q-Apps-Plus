/**
 * Product drafts: what the Add product and Edit forms put in
 * `global.productsToSave` until the seller publishes. The objects are the
 * original's (NewProduct.addProduct), key order included, because they are
 * stored as they are inside the catalogues (docs/apps/Q-Shop+.md → Data
 * contract; pinned by ProductManager.pin.test.tsx and productDraft.test.ts).
 *
 * One fix (bug 3): an edit starts from the product's existing prices and keeps
 * them. The original's form filled in only the QORT price, so saving an edit
 * without retyping the ARRR price dropped it, and buyers then paid the
 * converted QORT price instead.
 */
import { assetIdOf, priceCurrencyKey } from "../money/coins";
import { productIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { isListedCategory } from "../constants/categories";
import { fiatPriceOf, parseFiat, priceListFromFiat, type FiatPricing } from "../money/fiatPricing";

export interface PriceEntry {
  currency: string;
  value: number;
}

export const PRODUCT_STATUSES = ["AVAILABLE", "OUT_OF_STOCK", "RETIRED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  OUT_OF_STOCK: "Out of stock",
  RETIRED: "Retired",
};

export const PRODUCT_TYPES = ["digital", "physical"] as const;
export const TYPE_LABEL: Record<string, string> = { digital: "Digital", physical: "Physical" };

/** The original's limits: 3 images, a 180-character title. */
export const MAX_PRODUCT_IMAGES = 3;
export const MAX_TITLE_LENGTH = 180;
/** QORT and the other coins have 8 decimals. */
export const MAX_DECIMALS = 8;

export interface ProductFormValues {
  title: string;
  description: string;
  images: string[];
  type: string;
  category: string;
  status: string;
  /** The typed price per coin (`QORT`, `ARRR`…, `ASSET:<id>`). */
  prices: Record<string, string>;
  /**
   * The typed price in the shop's currency (money/fiatPricing.ts), when the
   * shop prices in one; then QORT and ARRR follow from it. "" when not.
   */
  fiat?: string;
}

/** The shop's pricing in a currency, as the product form uses it. */
export interface FormPricing {
  pricing: FiatPricing | null;
  /** The shop takes ARRR (an ARRR price is worked out only then). */
  takesArrr: boolean;
}

/** The form's price in the currency, when the shop prices in one and it is filled in properly. */
export function typedFiat(values: ProductFormValues, pricing: FiatPricing | null | undefined): number | null {
  if (!pricing) return null;
  const n = parseFiat(values.fiat ?? "");
  return Number.isNaN(n) ? null : n;
}

/**
 * What the seller types into an amount field, cleaned as they type: a comma
 * becomes a dot (phone keyboards in many languages have only a comma), other
 * characters go, one dot at most, and at most 8 decimals.
 */
export function sanitizeAmountInput(text: string): string {
  const cleaned = text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot < 0) return cleaned;
  const whole = cleaned.slice(0, dot);
  const fraction = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, MAX_DECIMALS);
  return `${whole}.${fraction}`;
}

/** A typed amount as a number, or NaN when it isn't one. Empty is NaN too. */
export function parseAmount(text: string): number {
  const t = text.trim();
  if (!t || t === "." || !/^\d*\.?\d*$/.test(t)) return NaN;
  return Number(t);
}

/** A stored price as the text its field starts with (no exponent, no float noise). */
export function amountToText(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const text = n.toFixed(MAX_DECIMALS).replace(/0+$/, "").replace(/\.$/, "");
  // Below 8 decimals: show it as stored rather than as 0, so it isn't lost unseen.
  return Number(text) > 0 ? text : String(n);
}

/**
 * The price fields' starting text for each coin the form shows: the
 * product's own price in that coin, if it has one. This is the bug 3 fix.
 */
export function initialPriceText(
  product: { price?: { currency: string; value: number | string }[] } | null | undefined,
  coins: string[]
): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const coin of coins) {
    const entry = product?.price?.find((p) => p?.currency === priceCurrencyKey(coin));
    texts[coin] = amountToText(entry?.value);
  }
  return texts;
}

/**
 * The product's `price` array as the original writes it: `{currency: "qort",
 * value}` first, then each other coin the shop takes that has a price (the
 * original wrote ARRR as `"ARRR"`; `ASSET:<id>` follows the same pattern), as
 * numbers. Coins with an empty or zero field are left
 * out, as the original did for ARRR. Entries for coins the form doesn't show
 * (a coin the shop no longer takes) are kept as they were, at the end.
 */
export function buildPriceList(
  prices: Record<string, string>,
  coins: string[],
  existing: { currency: string; value: number }[] = []
): PriceEntry[] {
  const list: PriceEntry[] = [{ currency: "qort", value: parseAmount(prices.QORT ?? "") }];
  for (const coin of coins) {
    if (coin === "QORT") continue;
    const value = parseAmount(prices[coin] ?? "");
    if (value > 0) list.push({ currency: priceCurrencyKey(coin), value });
  }
  const shown = new Set(coins.map(priceCurrencyKey));
  for (const entry of existing) {
    if (!entry || entry.currency === "qort" || shown.has(entry.currency)) continue;
    if (list.some((p) => p.currency === entry.currency)) continue;
    list.push(entry);
  }
  return list;
}

/**
 * The first problem with the form, in plain words, or null. The category
 * must be one of the list (constants/categories.ts), or the product's own old
 * one (`oldCategory`), kept while it is edited.
 */
export function validateProductForm(
  values: ProductFormValues,
  coins: string[],
  options: { oldCategory?: string | null; pricing?: FiatPricing | null } = {}
): string | null {
  if (values.images.length === 0) return "Add at least one image";
  if (values.images.length > MAX_PRODUCT_IMAGES) return `Use at most ${MAX_PRODUCT_IMAGES} images`;
  if (!values.title.trim()) return "Add a title";
  if (!values.category.trim()) return "Pick a category";
  if (!isListedCategory(values.category) && values.category !== options.oldCategory) return "Pick a category from the list";
  const fiatText = options.pricing ? (values.fiat ?? "").trim() : "";
  if (fiatText && typedFiat(values, options.pricing) === null) return `Check the ${options.pricing?.currency} price`;
  // A price in the shop's currency gives the QORT and ARRR prices.
  const fromFiat = !!fiatText;
  if (!fromFiat && !(parseAmount(values.prices.QORT ?? "") > 0)) return "Set a price in QORT above 0";
  for (const coin of coins) {
    if (coin === "QORT" || (fromFiat && coin === "ARRR")) continue;
    const text = (values.prices[coin] ?? "").trim();
    if (text && Number.isNaN(parseAmount(text))) {
      return `Check the ${assetIdOf(coin) !== null ? "asset" : coin} price`;
    }
  }
  return null;
}

/**
 * A new product, exactly as the original's NewProduct.addProduct builds it
 * (the same keys in the same order). It joins a catalogue when published.
 */
export function newProductDraft(args: {
  values: ProductFormValues;
  coins: string[];
  storeId: string;
  name: string;
  uid: string;
  now: number;
  pricing?: FiatPricing | null;
}) {
  const { values, coins, storeId, name, uid, now } = args;
  const shortStoreId = shortStoreIdOf(storeId);
  const draft = {
    title: values.title,
    description: values.description,
    created: now,
    version: 1,
    images: values.images,
    mainImageIndex: 0,
    type: values.type,
    price: buildPriceList(values.prices, coins),
    storeId,
    shortStoreId,
    category: values.category,
    id: productIdentifier(shortStoreId, uid),
    status: "AVAILABLE",
    user: name,
  };
  return withFormFiat(draft, values, coins, args.pricing);
}

/**
 * A draft priced from the form's price in the shop's currency, when it has
 * one (money/fiatPricing.ts: QORT and ARRR from the rates, `fiatPrice` added
 * at the end); else the draft as built, without a `fiatPrice` it no longer
 * follows.
 */
function withFormFiat<T extends Record<string, unknown>>(
  draft: T,
  values: ProductFormValues,
  coins: string[],
  pricing: FiatPricing | null | undefined
): T {
  const value = typedFiat(values, pricing);
  const { fiatPrice: _old, ...rest } = draft as Record<string, unknown>;
  if (value === null || !pricing) return rest as T;
  const price = priceListFromFiat(draft.price as PriceEntry[], value, pricing.rates, coins.includes("ARRR"));
  return { ...rest, price, fiatPrice: { currency: pricing.currency, value, qort: price[0].value } } as unknown as T;
}

/**
 * An edited product, as the original builds it: the product as loaded (the
 * index row merged with its catalogue entry), then the form's fields,
 * `isUpdate: true`, the status and the publishing name. A new product that is
 * still a draft stays a new product: only its fields change.
 */
export function editedProductDraft(args: {
  base: Record<string, any> & { id: string };
  values: ProductFormValues;
  coins: string[];
  name: string;
  pricing?: FiatPricing | null;
}) {
  const { base, values, coins, name } = args;
  // Without the shop's pricing the form shows no price in a currency: the product keeps what it has.
  if (!args.pricing) return editedWithoutFiat(base, values, coins, name);
  return withFormFiat(editedWithoutFiat(base, values, coins, name), values, coins, args.pricing);
}

function editedWithoutFiat(base: Record<string, any> & { id: string }, values: ProductFormValues, coins: string[], name: string) {
  const price = buildPriceList(values.prices, coins, Array.isArray(base.price) ? base.price : []);
  if (!base.isUpdate && !base.catalogueId) {
    return {
      ...base,
      title: values.title,
      description: values.description,
      images: values.images,
      mainImageIndex: 0,
      type: values.type,
      price,
      category: values.category,
      user: name,
    };
  }
  return {
    ...base,
    title: values.title,
    description: values.description,
    images: values.images,
    mainImageIndex: 0,
    type: values.type,
    price,
    category: values.category,
    isUpdate: true,
    status: values.status,
    user: name,
  };
}

/**
 * A published product as the edit form starts from it, as the original's
 * product table merged it: the index row (`created`, `catalogueId`, `id`,
 * `user`, `status`), then everything in its catalogue entry, then the row's
 * catalogue id again.
 */
export function productForEdit(
  row: { created: number; catalogueId: string; productId?: string; user?: string; status: string },
  catalogueProduct: Record<string, any> | undefined
): Record<string, any> & { id: string } {
  const merged: Record<string, any> & { id: string } = {
    created: row.created,
    catalogueId: row.catalogueId,
    id: row.productId || "",
    user: row.user || "",
    status: row.status || "",
    ...(catalogueProduct ?? {}),
  };
  merged.catalogueId = row.catalogueId || "";
  return merged;
}

/**
 * A product its index row names but its catalogue doesn't hold (a publish in
 * which the catalogue failed and the index landed). As the original did, the
 * edit form starts from the index row, so saving writes the product back
 * into its catalogue. The QORT price and category come from the row, with
 * the fields every product carries; the title, images and description have
 * to be filled in again.
 */
export function productFromIndexRow(
  row: { created: number; catalogueId: string; productId: string; user?: string; status: string; priceQort: number; category: string },
  storeId: string
): Record<string, any> & { id: string } {
  const priceQort = Number(row.priceQort);
  return productForEdit(row, {
    version: 1,
    price: Number.isFinite(priceQort) && priceQort > 0 ? [{ currency: "qort", value: priceQort }] : [],
    storeId,
    shortStoreId: shortStoreIdOf(storeId),
    category: typeof row.category === "string" ? row.category : "",
  });
}

/** The form's starting values for a product (new when `product` is null). */
export function formValuesFor(product: Record<string, any> | null, coins: string[], pricing?: FiatPricing | null): ProductFormValues {
  if (!product) {
    return {
      title: "",
      description: "",
      images: [],
      type: "digital",
      category: "",
      status: "AVAILABLE",
      prices: initialPriceText(null, coins),
      ...(pricing && { fiat: "" }),
    };
  }
  const fiat = pricing ? fiatPriceOf(product, pricing.currency) : null;
  return {
    ...(pricing && { fiat: fiat ? fiat.value.toFixed(2) : "" }),
    title: typeof product.title === "string" ? product.title : "",
    description: typeof product.description === "string" ? product.description : "",
    images: Array.isArray(product.images) ? product.images.filter((i: unknown) => typeof i === "string") : [],
    type: product.type === "physical" ? "physical" : "digital",
    category: typeof product.category === "string" ? product.category : "",
    status: (PRODUCT_STATUSES as readonly string[]).includes(product.status) ? product.status : "AVAILABLE",
    prices: initialPriceText(product as { price?: { currency: string; value: number }[] }, coins),
  };
}
