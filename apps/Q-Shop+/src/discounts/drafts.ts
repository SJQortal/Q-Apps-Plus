/**
 * The seller's working copy of their discount codes (seller/DiscountsCard.tsx):
 * each discount as published, with its code and name as typed when they're
 * known (the encrypted list, or this device's copy). Codes and names are
 * fingerprinted only when published.
 */
import { deliveryMoney } from "../delivery/model";
import { codeHash, discountNames, discountWhat, nameHash, type Discount, type DiscountSecret, type DiscountsDoc } from "./model";

export interface DiscountDraft extends Discount {
  /** The code as typed (in capitals), when known; absent for one set on another device whose list couldn't be read. */
  codeText?: string;
  /** The Qortal name it's for, as typed (a draft from before several names; see draftNames). */
  nameText?: string;
  /** The Qortal names it's for, as typed. */
  nameTexts?: string[];
}

/** The names a draft is for, as typed (none known: none, or set on another device). */
export function draftNames(draft: Pick<DiscountDraft, "nameText" | "nameTexts">): string[] {
  return draft.nameTexts ?? (draft.nameText ? [draft.nameText] : []);
}

/** A draft for names this device can't read (set on another device). */
export function hiddenNames(draft: DiscountDraft): boolean {
  return discountNames(draft).length > 0 && draftNames(draft).length === 0;
}

export function draftsOf(doc: DiscountsDoc | null, secret: DiscountSecret): DiscountDraft[] {
  return (doc?.discounts ?? []).map((d) => {
    const names = secret.nameLists?.[d.id] ?? (secret.names[d.id] ? [secret.names[d.id]] : []);
    return { ...d, ...(secret.codes[d.id] && { codeText: secret.codes[d.id] }), ...(names.length > 0 && { nameTexts: names }) };
  });
}

/** The document to publish (codes and names fingerprinted) and the seller's own list to encrypt and keep. */
export async function docFromDrafts(args: { storeId: string; currency: string; drafts: readonly DiscountDraft[]; now: number }): Promise<{ doc: DiscountsDoc; secret: DiscountSecret }> {
  const secret: DiscountSecret = { codes: {}, names: {} };
  const discounts: Discount[] = [];
  for (const draft of args.drafts) {
    const { codeText, nameText: _nameText, nameTexts: _nameTexts, code: oldCode, forName: oldName, forNames: oldNames, ...rest } = draft;
    const code = codeText ? await codeHash(args.storeId, codeText) : oldCode;
    const texts = draftNames(draft);
    // Names typed here are fingerprinted; names set elsewhere (not readable here) stay as they were.
    const hashes = texts.length > 0 ? await Promise.all(texts.map((n) => nameHash(args.storeId, n))) : (oldNames ?? (oldName ? [oldName] : []));
    const unique = [...new Set(hashes)];
    if (codeText) secret.codes[draft.id] = codeText;
    if (texts.length > 0) secret.names[draft.id] = texts[0];
    if (texts.length > 1) (secret.nameLists ??= {})[draft.id] = texts;
    discounts.push({ ...rest, ...(code && { code }), ...(unique[0] && { forName: unique[0] }), ...(unique.length > 1 && { forNames: unique }) });
  }
  return { doc: { v: 1, storeId: args.storeId, currency: args.currency, discounts, updated: args.now }, secret };
}

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "10% off and free delivery · 3 products · 1 Nov 2026 – 30 Nov 2026 · orders over 50.00 USD · for Ann" */
export function draftSummary(draft: DiscountDraft, currency: string): string {
  const parts = [discountWhat(draft)];
  parts.push(draft.products ? (draft.products.length === 1 ? "1 product" : `${draft.products.length} products`) : "every product");
  if (draft.starts !== undefined && draft.ends !== undefined) parts.push(`${day(draft.starts)} – ${day(draft.ends)}`);
  else if (draft.starts !== undefined) parts.push(`from ${day(draft.starts)}`);
  else if (draft.ends !== undefined) parts.push(`until ${day(draft.ends)}`);
  if (draft.minTotal !== undefined) parts.push(`orders over ${deliveryMoney(draft.minTotal, currency)}`);
  const who = forWhom(draft);
  if (who) parts.push(who);
  return parts.join(" · ");
}

/** "for Ann", "for Ann, Bo and Cy", "for 24 Qortal names"; null when it's for whoever has the code. */
function forWhom(draft: DiscountDraft): string | null {
  const names = draftNames(draft);
  const count = names.length || discountNames(draft).length;
  if (count === 0) return null;
  if (names.length === 1) return `for ${names[0]}`;
  if (names.length > 1 && names.length <= 3) return `for ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return count === 1 ? "for one Qortal name" : `for ${count} Qortal names`;
}

/** What the list calls a discount: its code, or who it's for. */
export function draftLabel(draft: DiscountDraft): string {
  if (draft.codeText) return draft.codeText;
  if (draft.code) return "A code set on another device";
  const who = forWhom(draft) ?? "for one Qortal name";
  return `${who[0].toUpperCase()}${who.slice(1)}, no code`;
}

// No 0/O or 1/I: easy to read out and type.
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A code nobody would guess: 14 letters and digits (about 70 bits, as its
 * fingerprint is public and guesses can be tried offline).
 */
export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]).join("");
}

/** A day typed in a date field (yyyy-mm-dd) as the start or the end of that day here. */
export function dayToTime(text: string, end: boolean): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const ms = new Date(`${text}T${end ? "23:59:59.999" : "00:00:00"}`).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/** The day a time falls on here, for a date field. */
export function timeToDay(ms: number | undefined): string {
  if (ms === undefined) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
