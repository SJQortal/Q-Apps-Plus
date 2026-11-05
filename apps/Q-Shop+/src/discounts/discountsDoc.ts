/**
 * Reading and publishing a shop's discount codes (discounts/model.ts): one
 * DOCUMENT of the seller's, `q-store-discounts-<shortStoreId>`, read when a
 * buyer reaches checkout's Confirm (one search, cached for the session; a
 * fetch only for shops that have codes) and in the seller's Shop Settings.
 *
 * The seller's own list (codes and names as typed) is `secret`, encrypted
 * to the seller with Hub's ENCRYPT_DATA and read back with DECRYPT_DATA, as
 * orders are. A copy stays on the seller's device too, so the list still
 * shows if Hub can't encrypt or decrypt it.
 */
import { dataContainerIdentifier, discountsIdentifier, shortStoreIdOf } from "../qdn/identifiers";
import { base64ToJson, jsonToBase64 } from "../qdn/payloads";
import { QdnDeletedError, fetchQdnJson, invalidateQdnSearches, primeQdnJson, resourceExists } from "../qdn/search";
import { fiatPricingOf, type FiatPricing } from "../money/fiatPricing";
import { STORAGE_PREFIX } from "../constants/plus";
import { discountSecretOf, discountsDocOf, type DiscountSecret, type DiscountsDoc } from "./model";

/** The shop's discount codes, or null when it has none. Rejects when it has some the node can't serve now. */
export async function fetchDiscountsDoc(owner: string, storeId: string, options: { fresh?: boolean } = {}): Promise<DiscountsDoc | null> {
  const identifier = discountsIdentifier(shortStoreIdOf(storeId));
  if (!(await resourceExists("DOCUMENT", owner, identifier, options))) return null;
  try {
    return discountsDocOf(await fetchQdnJson("DOCUMENT", owner, identifier, options), storeId);
  } catch (error) {
    if (error instanceof QdnDeletedError) return null;
    throw error;
  }
}

export interface ShopDiscounts {
  doc: DiscountsDoc | null;
  /** The shop's rates, when its minimum orders are in a currency (its product list's). */
  pricing: FiatPricing | null;
}

/** The shop's codes, with its rates when they're in a currency (a minimum order then counts QORT-priced products at them). */
export async function loadShopDiscounts(owner: string, storeId: string): Promise<ShopDiscounts> {
  const doc = await fetchDiscountsDoc(owner, storeId);
  if (!doc || doc.currency === "QORT" || !doc.discounts.some((d) => d.minTotal !== undefined)) return { doc, pricing: null };
  const index = await fetchQdnJson("DOCUMENT", owner, dataContainerIdentifier(storeId)).catch(() => null);
  return { doc, pricing: index ? fiatPricingOf(index) : null };
}

export function buildDiscountsPublish(args: { name: string; doc: DiscountsDoc }) {
  const identifier = discountsIdentifier(shortStoreIdOf(args.doc.storeId));
  return {
    action: "PUBLISH_QDN_RESOURCE" as const,
    name: args.name,
    service: "DOCUMENT",
    identifier,
    filename: "discounts.json",
    data64: jsonToBase64(args.doc),
    title: "Discount codes",
    description: "A shop's discount codes on Q-Shop",
  };
}

/** After a publish: this session reads what was just published (the node may serve the old one for a while). */
export function rememberDiscountsDoc(owner: string, doc: DiscountsDoc): void {
  const identifier = discountsIdentifier(shortStoreIdOf(doc.storeId));
  invalidateQdnSearches((url) => url.includes(identifier));
  primeQdnJson("DOCUMENT", owner, identifier, doc);
}

/** The seller's list, encrypted to their own key (null when Hub can't, or they declined: the device copy then stands). */
export async function encryptDiscountSecret(secret: DiscountSecret, publicKey: string): Promise<string | null> {
  try {
    const encrypted = await qortalRequest({ action: "ENCRYPT_DATA", data64: jsonToBase64(secret), publicKeys: [publicKey] });
    return typeof encrypted === "string" && encrypted ? encrypted : null;
  } catch {
    return null;
  }
}

/** The seller's list from the document, decrypted (empty when there's none, or it can't be read here). */
export async function decryptDiscountSecret(doc: DiscountsDoc, publicKey: string): Promise<DiscountSecret> {
  if (!doc.secret) return { codes: {}, names: {} };
  try {
    const decrypted = await qortalRequest({ action: "DECRYPT_DATA", encryptedData: doc.secret, publicKey });
    return typeof decrypted === "string" && decrypted ? discountSecretOf(base64ToJson(decrypted)) : { codes: {}, names: {} };
  } catch {
    return { codes: {}, names: {} };
  }
}

const localKey = (storeId: string) => `${STORAGE_PREFIX}discount-codes-${storeId}`;

/** The copy of the seller's list kept on this device. */
export function localDiscountSecret(storeId: string): DiscountSecret {
  try {
    return discountSecretOf(JSON.parse(localStorage.getItem(localKey(storeId)) ?? "{}"));
  } catch {
    return { codes: {}, names: {} };
  }
}

export function keepDiscountSecret(storeId: string, secret: DiscountSecret): void {
  try {
    localStorage.setItem(localKey(storeId), JSON.stringify(secret));
  } catch {
    // Storage full or blocked: the encrypted copy in the document stands.
  }
}
