/**
 * The QDN identifiers Q-Shop reads and writes. They are shared data: the + app
 * and the original must build exactly the same ones (docs/apps/Q-Shop+.md →
 * Data contract; pinned by the *.pin tests and identifiers.test.ts).
 */

// The original also has commented-out test prefixes ("test-q-store-general" …);
// production uses these.
export const STORE_BASE = "q-store-general";
export const DATA_CONTAINER_BASE = "datacontainer";
export const CATALOGUE_BASE = "q-store-catalogue";
export const ORDER_BASE = "q-store-order";
export const STATUS_ORDER_BASE = "q-store-status-order";
export const REVIEW_BASE = "q-store-review";
export const PRODUCT_BASE = "q-store-product";

/** A shop's id from its short id: `q-store-general-<shortStoreId>`. */
export function storeIdentifier(shortStoreId: string): string {
  return `${STORE_BASE}-${shortStoreId}`;
}

/**
 * The short id inside a shop id (the original splits on `q-store-general-`
 * and takes the second part).
 */
export function shortStoreIdOf(storeId: string): string {
  return storeId.split(`${STORE_BASE}-`)[1] ?? "";
}

export function isStoreIdentifier(identifier: string): boolean {
  return identifier.startsWith(`${STORE_BASE}-`) && shortStoreIdOf(identifier).length > 0;
}

/** The shop's product index: `<storeId>-datacontainer`. */
export function dataContainerIdentifier(storeId: string): string {
  return `${storeId}-${DATA_CONTAINER_BASE}`;
}

export function catalogueIdentifier(shortStoreId: string, uid: string): string {
  return `${CATALOGUE_BASE}-${shortStoreId}-${uid}`;
}

/**
 * One of this shop's catalogues: `q-store-catalogue-<shortStoreId>-<uid>`,
 * the uid without dashes (ShortUniqueId's letters and digits). A search by
 * that prefix also finds `my-shop-2`'s catalogues for `my-shop`.
 */
export function isCatalogueOfShop(identifier: string, shortStoreId: string): boolean {
  const prefix = `${CATALOGUE_BASE}-${shortStoreId}-`;
  if (!shortStoreId || !identifier.startsWith(prefix)) return false;
  const uid = identifier.slice(prefix.length);
  return uid.length > 0 && !uid.includes("-");
}

/** A product's id inside its catalogue (there is no product resource on QDN). */
export function productIdentifier(shortStoreId: string, uid: string): string {
  return `${PRODUCT_BASE}-${shortStoreId}-${uid}`;
}

export function orderIdentifier(shortStoreId: string, uid: string): string {
  return `${ORDER_BASE}-${shortStoreId}-${uid}`;
}

/** The prefix of every order for one shop (all buyers). */
export function shopOrdersPrefix(shortStoreId: string): string {
  return `${ORDER_BASE}-${shortStoreId}-`;
}

/**
 * The seller's status document for an order: the order id with
 * `q-store-order` turned into `q-store-status-order`, as the original does
 * with `id.replace(/(q-store)(-order)/, "$1-status$2")`.
 */
export function statusIdentifierForOrder(orderId: string): string {
  return orderId.replace(/(q-store)(-order)/, "$1-status$2");
}

/** The order id a status document belongs to (the reverse of the above). */
export function orderIdForStatus(statusId: string): string {
  return statusId.replace(/(q-store)-status(-order)/, "$1$2");
}

/** The prefix of every status document of one shop. */
export function shopStatusPrefix(shortStoreId: string): string {
  return `${STATUS_ORDER_BASE}-${shortStoreId}-`;
}

/** `q-store-review-<shortStoreId>-<uid>-<rating×10>`. */
export function reviewIdentifier(shortStoreId: string, uid: string, rating: number): string {
  return `${REVIEW_BASE}-${shortStoreId}-${uid}-${Number(rating) * 10}`;
}

export function shopReviewsPrefix(shortStoreId: string): string {
  return `${REVIEW_BASE}-${shortStoreId}-`;
}

/**
 * The rating (0.5–5) a review identifier carries, or null when the identifier
 * isn't a review of this shop. Like the original, it drops the last two
 * dash-separated parts (uid and rating) and compares the rest exactly: Core's
 * `query` search matches substrings without case, so `my-shop-2`'s reviews also
 * come back for `my-shop`.
 */
export function ratingFromReviewIdentifier(identifier: string, shortStoreId?: string): number | null {
  const parts = identifier.split("-");
  if (parts.length < 3) return null;
  const prefix = parts.slice(0, parts.length - 2).join("-");
  if (shortStoreId !== undefined) {
    if (prefix !== `${REVIEW_BASE}-${shortStoreId}`) return null;
  } else if (!prefix.startsWith(`${REVIEW_BASE}-`)) {
    return null;
  }
  const rating = Number(parts[parts.length - 1]) / 10;
  if (!Number.isFinite(rating) || rating <= 0 || rating > 5) return null;
  return rating;
}

/** The short shop id a review identifier belongs to, or null. */
export function shortStoreIdOfReview(identifier: string): string | null {
  if (!identifier.startsWith(`${REVIEW_BASE}-`)) return null;
  const parts = identifier.slice(REVIEW_BASE.length + 1).split("-");
  if (parts.length < 3) return null;
  return parts.slice(0, parts.length - 2).join("-") || null;
}

/** The short shop id an order identifier belongs to (the uid has no dashes), or null. */
export function shortStoreIdOfOrder(identifier: string): string | null {
  if (!identifier.startsWith(`${ORDER_BASE}-`)) return null;
  const parts = identifier.slice(ORDER_BASE.length + 1).split("-");
  if (parts.length < 2) return null;
  return parts.slice(0, parts.length - 1).join("-") || null;
}

/**
 * The Q-Mail identifier of the order mail to the seller, as the original
 * builds it: `qortal_qmail_<seller.slice(0, 20)>_<sellerAddress.slice(-6)>_mail_<uid>`.
 */
export function orderMailIdentifier(seller: string, sellerAddress: string, uid: string): string {
  return `qortal_qmail_${seller.slice(0, 20)}_${sellerAddress.slice(-6)}_mail_${uid}`;
}

/**
 * A short shop id from what the seller types, as the original's Create Shop
 * form does: letters, digits, spaces and dashes only; spaces become dashes;
 * runs of dashes collapse; "post" and "q-shop" are removed; then (on
 * publish) one leading and one trailing dash are dropped.
 */
export function sanitizeShortStoreIdInput(value: string): string {
  let next = value
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  if (next.toLowerCase().includes("post")) next = next.replace(/post/gi, "");
  if (next.toLowerCase().includes("q-shop")) next = next.replace(/q-shop/gi, "");
  return next;
}

export function finalizeShortStoreId(value: string): string {
  let id = value;
  if (id.endsWith("-")) id = id.slice(0, -1);
  if (id.startsWith("-")) id = id.slice(1);
  return id;
}
