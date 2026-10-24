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
import { MAX_PRODUCT_PICTURES, withPicturesRef } from "../qdn/productPictures";
import { MAX_DESCRIPTION_HTML, descriptionHtmlOf, htmlToPlainText, isPlainHtml } from "../richtext/plainText";
import { normalizeQuillHtml } from "../richtext/quillHtml";
import { DEFAULT_EXTEND_MINUTES, auctionTermsOf, auctionTermsProblem, roundQort, type AuctionTerms } from "../auctions/rules";
import { isListedCategory } from "../constants/categories";
import { fiatPriceOf, fiatToText, parseFiat, priceDecimals, priceListFromFiat, type FiatPricing } from "../money/fiatPricing";
import type { VariantFormValues } from "../variants/drafts";
import type { VariantDisplay } from "../variants/model";

export interface PriceEntry {
  currency: string;
  value: number;
}

export const PRODUCT_STATUSES = ["AVAILABLE", "OUT_OF_STOCK", "RETIRED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  AUCTION: "Auction",
  OUT_OF_STOCK: "Out of stock",
  RETIRED: "Retired",
};

/** Physical first: the default for a new product (Simon, 2026-10-22). */
export const PRODUCT_TYPES = ["physical", "digital"] as const;
export const TYPE_LABEL: Record<string, string> = { digital: "Digital", physical: "Physical" };

/** Up to 10 pictures (the original's 3 in the catalogue, the rest beside it: qdn/productPictures.ts); the original's 180-character title. */
export const MAX_PRODUCT_IMAGES = MAX_PRODUCT_PICTURES;
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
  /** How it sells: at its price (the default), or to the highest bidder (auctions/rules.ts). */
  sale?: "fixed" | "auction";
  /** The auction's terms as typed, when it sells by auction. */
  auction?: AuctionFormValues;
  /** A new product's variants as typed (variants/drafts.ts); null or absent: none. Not stored as such. */
  variants?: VariantFormValues | null;
  /** An existing variant: how lists show its group (variants/model.ts). */
  variantDisplay?: VariantDisplay;
}

/** An auction's terms as the form holds them (times as `datetime-local` text, in the seller's time). */
export interface AuctionFormValues {
  startingBid: string;
  /** "" starts it when the product is saved. */
  start: string;
  end: string;
  reserve: string;
  buyNow: string;
  /** Minutes a late bid moves the end; "0" turns it off. */
  extendMinutes: string;
  /** Bids the seller voided (their ids): they no longer count. */
  voided?: string[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A time as `datetime-local` text, in this device's time zone. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local` text as a time (NaN when it isn't one). */
export function fromLocalInput(text: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) ? new Date(text).getTime() : NaN;
}

/** A new auction: it starts when saved and runs seven days, to the hour; late bids add five minutes. */
export function defaultAuctionValues(now: number): AuctionFormValues {
  const end = Math.ceil((now + 7 * 86_400_000) / 3_600_000) * 3_600_000;
  return { startingBid: "", start: "", end: toLocalInput(end), reserve: "", buyNow: "", extendMinutes: String(DEFAULT_EXTEND_MINUTES) };
}

function auctionFormOf(terms: AuctionTerms): AuctionFormValues {
  const text = (v: number | undefined) => (v === undefined ? "" : String(v));
  return {
    startingBid: String(terms.startingBid),
    start: toLocalInput(terms.start),
    end: toLocalInput(terms.end),
    reserve: text(terms.reserve),
    buyNow: text(terms.buyNow),
    extendMinutes: String(terms.extendMinutes),
    voided: terms.voided ?? [],
  };
}

/** The terms with the form's voided bids (none: no field, as before any void). */
function withVoids(terms: AuctionTerms, voided: string[] | undefined): AuctionTerms {
  const ids = [...new Set((voided ?? []).filter((id) => typeof id === "string" && id))].slice(0, 500);
  const rest = { ...terms };
  delete rest.voided;
  return ids.length ? { ...rest, voided: ids } : rest;
}

function sameTerms(a: AuctionTerms, b: AuctionTerms): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.startingBid === b.startingBid &&
    a.reserve === b.reserve &&
    a.buyNow === b.buyNow &&
    a.extendMinutes === b.extendMinutes
  );
}

/**
 * The auction's terms from the form, or what is wrong with them, by where a
 * saved auction stands:
 *
 * - Terms left as they were saved pass as they are (an auction that has
 *   ended can still have its description edited). The form shows times to
 *   the minute, so a time left as shown keeps its saved value.
 * - Before it starts, anything can change.
 * - Once bidding has started, the terms are the bidders': only a later end.
 * - Once it has ended, it can run again: from a new start (empty: now), so
 *   the earlier bids no longer count.
 */
export function auctionFromForm(form: AuctionFormValues, now: number, saved?: AuctionTerms | null): { terms: AuctionTerms } | { problem: string } {
  const startingBid = parseAmount(form.startingBid);
  const keep = (text: string, savedAt: number | undefined) => (savedAt !== undefined && text === toLocalInput(savedAt) ? savedAt : fromLocalInput(text));
  const start = form.start.trim() ? keep(form.start, saved?.start) : now;
  const end = keep(form.end, saved?.end);
  const reserve = form.reserve.trim() ? parseAmount(form.reserve) : undefined;
  const buyNow = form.buyNow.trim() ? parseAmount(form.buyNow) : undefined;
  const extend = Number(form.extendMinutes);
  if (!Number.isFinite(start)) return { problem: "Check when the auction starts" };
  if (!Number.isFinite(end)) return { problem: "Set when the auction ends" };
  if (reserve !== undefined && !(reserve > 0)) return { problem: "Check the reserve price" };
  if (buyNow !== undefined && !(buyNow > 0)) return { problem: "Check the buy-now price" };
  const terms: AuctionTerms = {
    v: 1,
    start,
    end,
    startingBid: roundQort(startingBid),
    ...(reserve !== undefined && { reserve: roundQort(reserve) }),
    ...(buyNow !== undefined && { buyNow: roundQort(buyNow) }),
    extendMinutes: Number.isFinite(extend) ? Math.max(0, Math.min(60, Math.floor(extend))) : DEFAULT_EXTEND_MINUTES,
  };
  // Voiding bids is the seller's at any time (an absurd bid, a winner who didn't pay); the rest follows the rules above.
  if (saved && sameTerms(terms, saved)) return { terms: withVoids(saved, form.voided) };
  if (saved && now >= saved.start && now < saved.end) {
    if (!sameTerms({ ...terms, end: saved.end }, saved)) return { problem: "Bidding has started: only the end can change now, to later" };
    if (terms.end < saved.end) return { problem: "Bidding has started: the end can only move later" };
  }
  if (saved && now >= saved.end && terms.start < saved.end) {
    return { problem: "This auction has ended. To run it again, clear Starts (or set a new start) and set a new end" };
  }
  const problem = auctionTermsProblem(terms, now);
  return problem ? { problem } : { terms: withVoids(terms, form.voided) };
}

/**
 * A product sold by auction: its terms, its starting bid as its one (QORT)
 * price, and OUT_OF_STOCK for the original Q-Shop, which knows no auctions
 * and would otherwise sell it at that price. A fixed-price product loses any
 * terms it had.
 */
function withSale<T extends Record<string, unknown>>(draft: T, values: ProductFormValues, now: number, saved: AuctionTerms | null): T {
  if (values.sale !== "auction") {
    if (!("auction" in draft)) return draft;
    const rest = { ...draft };
    delete rest.auction;
    return rest;
  }
  const result = auctionFromForm(values.auction ?? defaultAuctionValues(now), now, saved);
  if ("problem" in result) throw new Error(result.problem);
  const rest = { ...draft } as Record<string, unknown>;
  delete rest.fiatPrice;
  // Out of stock for the original app, unless the seller retires it (once it has sold, say).
  const status = values.status === "RETIRED" ? "RETIRED" : "OUT_OF_STOCK";
  return { ...rest, price: [{ currency: "qort", value: result.terms.startingBid }], status, auction: result.terms } as unknown as T;
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
  const n = parseFiat(values.fiat ?? "", priceDecimals(pricing.currency));
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
  options: {
    oldCategory?: string | null;
    pricing?: FiatPricing | null;
    wholeOnly?: string[];
    now?: number;
    savedAuction?: AuctionTerms | null;
    /** In variants, each item can bring its own picture (variants/drafts.ts checks each has one). */
    imagesOptional?: boolean;
  } = {}
): string | null {
  if (values.images.length === 0 && !options.imagesOptional) return "Add at least one image";
  if (values.images.length > MAX_PRODUCT_IMAGES) return `Use at most ${MAX_PRODUCT_IMAGES} images`;
  if (!values.title.trim()) return "Add a title";
  // Only formatted HTML is stored as such (plain text is the original's description, which has no limit).
  if (!isPlainHtml(values.description) && normalizeQuillHtml(values.description).length > MAX_DESCRIPTION_HTML) {
    return "Shorten the description: it is too long to publish with its formatting";
  }
  if (!values.category.trim()) return "Pick a category";
  if (!isListedCategory(values.category) && values.category !== options.oldCategory) return "Pick a category from the list";
  if (values.sale === "auction") {
    const result = auctionFromForm(values.auction ?? defaultAuctionValues(options.now ?? Date.now()), options.now ?? Date.now(), options.savedAuction);
    return "problem" in result ? result.problem : null;
  }
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
    // An indivisible asset moves in whole units only (qdn/assets.ts).
    if (text && options.wholeOnly?.includes(coin) && !Number.isInteger(parseAmount(text))) {
      return "Use whole units for the price in an asset that can't be split";
    }
  }
  return null;
}

/**
 * A new product, exactly as the original's NewProduct.addProduct builds it
 * (the same keys in the same order). It joins a catalogue when published.
 */
/**
 * `htmlDescription` (additive) for a description with formatting, videos or
 * files, in Quill 1's shape; nothing for plain text, which `description`
 * holds alone, as the original writes it (richtext/plainText.ts).
 */
function richDescription(html: string): { htmlDescription?: string } {
  return isPlainHtml(html) ? {} : { htmlDescription: normalizeQuillHtml(html) };
}

/** The product with `htmlDescription` as the form's HTML calls for: set, or taken off when it is plain again. */
function withHtmlDescription<T extends Record<string, unknown>>(product: T, html: string): T {
  const rich = richDescription(html);
  if (rich.htmlDescription) return { ...product, htmlDescription: rich.htmlDescription };
  const rest = { ...product };
  delete rest.htmlDescription;
  return rest;
}

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
    description: htmlToPlainText(values.description),
    ...richDescription(values.description),
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
  if (values.sale === "auction") return withPicturesRef(withSale(draft, values, now, null));
  return withPicturesRef(withFormFiat(draft, values, coins, args.pricing));
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
  /**
   * The product's pictures past the third couldn't be read: its pictures
   * (the form's 3 and the pointer) stay exactly as they are.
   */
  picturesKept?: boolean;
  /** When it is saved (an auction starting "now" starts then). */
  now?: number;
}) {
  const { base, values, coins, name } = args;
  const pictures = args.picturesKept ? <T,>(draft: T) => draft : withPicturesRef;
  // Sold by auction (or no longer): its terms, its starting bid as its price (auctions/rules.ts).
  if (values.sale === "auction" || "auction" in base) {
    const edited = editedWithoutFiat(base, values, coins, name);
    const sold = withSale(edited, values, args.now ?? Date.now(), auctionTermsOf(base));
    if (values.sale === "auction" || !args.pricing) return pictures(sold);
    return pictures(withFormFiat(sold, values, coins, args.pricing));
  }
  // Without the shop's pricing the form shows no price in a currency: the product keeps what it has.
  if (!args.pricing) return pictures(editedWithoutFiat(base, values, coins, name));
  return pictures(withFormFiat(editedWithoutFiat(base, values, coins, name), values, coins, args.pricing));
}

function editedWithoutFiat(base: Record<string, any> & { id: string }, values: ProductFormValues, coins: string[], name: string) {
  const price = buildPriceList(values.prices, coins, Array.isArray(base.price) ? base.price : []);
  if (!base.isUpdate && !base.catalogueId) {
    return withHtmlDescription(
      {
        ...base,
        title: values.title,
        description: htmlToPlainText(values.description),
        images: values.images,
        mainImageIndex: 0,
        type: values.type,
        price,
        category: values.category,
        user: name,
      },
      values.description
    );
  }
  return withHtmlDescription(
    {
      ...base,
      title: values.title,
      description: htmlToPlainText(values.description),
      images: values.images,
      mainImageIndex: 0,
      type: values.type,
      price,
      category: values.category,
      isUpdate: true,
      status: values.status,
      user: name,
    },
    values.description
  );
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
      type: "physical",
      category: "",
      status: "AVAILABLE",
      prices: initialPriceText(null, coins),
      ...(pricing && { fiat: "" }),
    };
  }
  const fiat = pricing ? fiatPriceOf(product, pricing.currency) : null;
  return {
    ...(pricing && { fiat: fiat ? fiatToText(fiat.value, pricing.currency) : "" }),
    title: typeof product.title === "string" ? product.title : "",
    // The editor's HTML: the product's formatted description, else its plain one (richtext/plainText.ts).
    description: descriptionHtmlOf(product),
    images: Array.isArray(product.images) ? product.images.filter((i: unknown) => typeof i === "string") : [],
    // As checkout reads it (money/order.ts): only "digital" skips the delivery address.
    type: product.type === "digital" ? "digital" : "physical",
    category: typeof product.category === "string" ? product.category : "",
    status: (PRODUCT_STATUSES as readonly string[]).includes(product.status) ? product.status : "AVAILABLE",
    prices: initialPriceText(product as { price?: { currency: string; value: number }[] }, coins),
    ...auctionValuesOf(product),
  };
}

/** A product sold by auction opens with its terms (none for a fixed-price one, so its values stay as they were). */
function auctionValuesOf(product: Record<string, any>): Pick<ProductFormValues, "sale" | "auction"> {
  const terms = auctionTermsOf(product);
  return terms ? { sale: "auction", auction: auctionFormOf(terms) } : {};
}
