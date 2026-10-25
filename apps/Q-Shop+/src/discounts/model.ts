/**
 * Discount codes (Simon, 2026-10-25: "discount codes that sellers can set …
 * percent only … to certain items only or certain time period … give a
 * specific qortal user a discount … also free-delivery codes").
 *
 * One DOCUMENT of the seller's, `q-store-discounts-<shortStoreId>`
 * (discounts/discountsDoc.ts), additive: the original never reads it. Each
 * discount takes a percentage off (1–99 %), makes delivery free, or both,
 * and can be limited to some products, a period, a minimum order (in the
 * shop's currency: its pricing currency, else QORT) and one Qortal name.
 *
 * Codes stay secret: the document holds each code's fingerprint (SHA-256 of
 * the shop id and the code), so a code works only for someone who knows it;
 * a name is kept the same way. The seller's own list (the codes and names as
 * typed) travels in `secret`, encrypted to the seller with Hub's
 * ENCRYPT_DATA. A code anyone could guess (SALE10) can still be found from
 * its fingerprint, so the editor offers random ones.
 *
 * Anyone can publish JSON under their name: only well-formed parts are read.
 */

export const MAX_DISCOUNTS = 50;
export const MAX_PERCENT = 99;
export const MAX_DISCOUNT_PRODUCTS = 300;
/** The order line a discount adds (discounts/apply.ts), as the delivery fee adds `q-store-delivery`. */
export const DISCOUNT_LINE_ID = "q-store-discount";
/** 3–24 letters, digits, "-" or "_", as the code is kept: in capitals. */
export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,23}$/;

export interface Discount {
  id: string;
  /** The code's fingerprint (codeHash); absent for a discount for one name that needs no code. */
  code?: string;
  /** 1–99, or 0 when it only makes delivery free. */
  percent: number;
  freeDelivery?: true;
  /** When it starts and ends (ms). */
  starts?: number;
  ends?: number;
  /** The least the order's products must come to, in the document's currency. */
  minTotal?: number;
  /** Only these products (ids); every product when absent. */
  products?: string[];
  /** Only for this Qortal name: its fingerprint (nameHash). */
  forName?: string;
  paused?: true;
}

/** What only the seller reads: the codes and names as typed, by discount id. */
export interface DiscountSecret {
  codes: Record<string, string>;
  names: Record<string, string>;
}

export interface DiscountsDoc {
  v: 1;
  storeId: string;
  /** "QORT", or the shop's pricing currency (USD…): what `minTotal` is in. */
  currency: string;
  discounts: Discount[];
  updated: number;
  /** DiscountSecret as JSON, encrypted to the seller (ENCRYPT_DATA). */
  secret?: string;
}

const HASH = /^[0-9a-f]{32}$/;
const idOf = (value: unknown): string | null => (typeof value === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null);
const timeOf = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined);

/** A code as it's compared: capitals, no spaces ("spring 10" → "SPRING10"). */
export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/\s+/g, "");
}

async function fingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A code's fingerprint for this shop (another shop's same code has another). */
export function codeHash(storeId: string, code: string): Promise<string> {
  return fingerprint(`${storeId}\ncode:${normalizeCode(code)}`);
}

/** A Qortal name's fingerprint for this shop (names compared in lower case). */
export function nameHash(storeId: string, name: string): Promise<string> {
  return fingerprint(`${storeId}\nname:${name.trim().toLowerCase()}`);
}

function discountOf(raw: unknown): Discount | null {
  const d = raw as Partial<Record<keyof Discount, unknown>> | null;
  const id = idOf(d?.id);
  if (!d || !id || typeof d.percent !== "number" || !Number.isInteger(d.percent) || d.percent < 0 || d.percent > MAX_PERCENT) return null;
  const freeDelivery = d.freeDelivery === true;
  // A discount that takes nothing off isn't one.
  if (d.percent === 0 && !freeDelivery) return null;
  const code = typeof d.code === "string" && HASH.test(d.code) ? d.code : undefined;
  const forName = typeof d.forName === "string" && HASH.test(d.forName) ? d.forName : undefined;
  // Without a code it's for one name, or for no one.
  if (!code && !forName) return null;
  const starts = timeOf(d.starts);
  const ends = timeOf(d.ends);
  const minTotal = typeof d.minTotal === "number" && Number.isFinite(d.minTotal) && d.minTotal > 0 ? d.minTotal : undefined;
  const products = Array.isArray(d.products)
    ? [...new Set(d.products.filter((p): p is string => typeof p === "string" && p.length > 0 && p.length <= 80))].slice(0, MAX_DISCOUNT_PRODUCTS)
    : [];
  return {
    id,
    ...(code && { code }),
    percent: d.percent,
    ...(freeDelivery && { freeDelivery: true as const }),
    ...(starts !== undefined && { starts }),
    ...(ends !== undefined && { ends }),
    ...(minTotal !== undefined && { minTotal }),
    ...(products.length > 0 && { products }),
    ...(forName && { forName }),
    ...(d.paused === true && { paused: true as const }),
  };
}

/** A shop's discount codes as published, or null (none, not this shop's, deleted or malformed). */
export function discountsDocOf(raw: unknown, storeId: string): DiscountsDoc | null {
  const d = raw as (Partial<Record<keyof DiscountsDoc, unknown>> & { deleted?: unknown }) | null;
  if (!d || typeof d !== "object" || d.deleted === true || d.storeId !== storeId || typeof d.currency !== "string" || !d.currency) return null;
  const discounts: Discount[] = [];
  for (const raw of Array.isArray(d.discounts) ? d.discounts : []) {
    const discount = discountOf(raw);
    if (discount && !discounts.some((x) => x.id === discount.id)) discounts.push(discount);
    if (discounts.length >= MAX_DISCOUNTS) break;
  }
  return {
    v: 1,
    storeId,
    currency: d.currency,
    discounts,
    updated: typeof d.updated === "number" ? d.updated : 0,
    ...(typeof d.secret === "string" && d.secret && { secret: d.secret }),
  };
}

/** The seller's list read back from its decrypted JSON: only well-formed codes and names. */
export function discountSecretOf(raw: unknown): DiscountSecret {
  const s = raw as { codes?: unknown; names?: unknown } | null;
  const pick = (value: unknown, ok: (text: string) => boolean): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!value || typeof value !== "object" || Array.isArray(value)) return out;
    for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
      if (idOf(key) && typeof text === "string" && ok(text)) out[key] = text;
    }
    return out;
  };
  return { codes: pick(s?.codes, (t) => CODE_PATTERN.test(t)), names: pick(s?.names, (t) => t.trim().length > 0 && t.length <= 40) };
}

export type DiscountStatus = "active" | "scheduled" | "ended" | "paused";

export function discountStatus(discount: Pick<Discount, "paused" | "starts" | "ends">, now: number): DiscountStatus {
  if (discount.paused) return "paused";
  if (discount.ends !== undefined && now > discount.ends) return "ended";
  if (discount.starts !== undefined && now < discount.starts) return "scheduled";
  return "active";
}

/** "10% off", "free delivery", "10% off and free delivery". */
export function discountWhat(discount: Pick<Discount, "percent" | "freeDelivery">): string {
  const parts = [discount.percent > 0 ? `${discount.percent}% off` : "", discount.freeDelivery ? "free delivery" : ""].filter(Boolean);
  return parts.join(" and ");
}

/** The order line's title: "Discount SPRING10: 10% off", or "Your discount: 15% off" when it needs no code. */
export function discountTitle(discount: Pick<Discount, "percent" | "freeDelivery">, code?: string): string {
  return `${code ? `Discount ${code}` : "Your discount"}: ${discountWhat(discount)}`;
}

/** An order line that is a discount (discounts/apply.ts), by its key or its pseudo-product. */
export function isDiscountLine(key: string, line: { product?: { id?: unknown; type?: unknown } } | null | undefined): boolean {
  return key === DISCOUNT_LINE_ID || line?.product?.id === DISCOUNT_LINE_ID || line?.product?.type === "discount";
}
