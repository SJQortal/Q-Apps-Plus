/**
 * The shop form (Create shop, Edit shop) as plain values, and how they become
 * the StoreFields the payload builders take (qdn/payloads.ts). The shapes are
 * the original's (docs/apps/Q-Shop+.md → Data contract): `supportedCoins`
 * starts with QORT; `foreignCoins` always carries `ARRR` (an empty string when
 * there is none, as the original wrote it); `acceptedAssets` and
 * `metaDescription` are the + app's additive fields.
 */
import { FOREIGN_TICKERS, type ForeignTicker, type ShopAsset } from "../money/coins";
import { US, shippingCountriesOf, shippingStatesOf, shippingSummaryWithStates } from "../constants/shipping";
import type { StoreFields } from "../qdn/payloads";
import { MAX_RETURNS_TEXT, MAX_TERMS_TEXT, policiesForPublish, policiesOf } from "../shop/policies";
import { awayForPublish, awayOf, dayToInput } from "../shop/away";
import { languagesOf } from "../shop/languages";
import { MAX_SHOP_LINKS, isShopLinkUrl, shopLinksOf } from "../shop/links";

export interface ShopFormValues {
  logo: string | null;
  title: string;
  description: string;
  /** The short text under the shop in lists (empty: the start of the description). */
  metaDescription: string;
  location: string;
  /** The typed "Ships to" (shops from before the country list; kept while the list is unused). */
  shipsTo: string;
  /** The countries it ships to (constants/shipping.ts); null keeps the typed text. */
  shippingCountries: string[] | null;
  /** The US states it ships to, when it ships to the United States; null: every state. */
  shippingStates: string[] | null;
  /** Coins the shop takes besides QORT. */
  coins: Record<ForeignTicker, boolean>;
  /** Payout address per coin, kept while a coin is switched off. */
  addresses: Record<ForeignTicker, string>;
  assets: ShopAsset[];
  /** Policies (shop/policies.ts): working days to dispatch, days to return (0: none), null: not said. */
  dispatchDays: number | null;
  returnDays: number | null;
  returns: string;
  terms: string;
  /** Away (shop/away.ts): on, the day back ("" for not said, a date field's value) and a note. */
  away: boolean;
  awayUntil: string;
  awayNote: string;
  /** The languages the seller answers in (shop/languages.ts codes). */
  languages: string[];
  /** The shop's qortal:// links (shop/links.ts), as typed: a row may still be empty. */
  links: { url: string; label: string }[];
}

/** The original's limit for a shop title. */
export const MAX_SHOP_TITLE = 50;
/** The original's limit for a shop id. */
export const MAX_SHOP_ID = 25;
/**
 * A meta description's length: what two lines of a shop card hold at its
 * narrowest (Simon, 2026-10-22: "way less than 180 characters, only these fit
 * there"). The metadata itself takes up to 180, as the original writes it.
 */
export const MAX_META_DESCRIPTION = 70;
/** The narrowest a shop card's text is (four cards a row on a wide screen). */
export const SHOP_CARD_TEXT_WIDTH = 270;

function perTicker<T>(make: (t: ForeignTicker) => T): Record<ForeignTicker, T> {
  return Object.fromEntries(FOREIGN_TICKERS.map((t) => [t, make(t)])) as Record<ForeignTicker, T>;
}

/** The form's starting values: empty for a new shop, the shop's own for an edit. */
export function shopFormValues(store?: {
  logo?: string;
  title?: string;
  description?: string;
  metaDescription?: unknown;
  location?: string;
  shipsTo?: string;
  shippingCountries?: unknown;
  shippingStates?: unknown;
  supportedCoins?: string[];
  foreignCoins?: Record<string, string>;
  acceptedAssets?: ShopAsset[];
  policies?: unknown;
  away?: unknown;
  languages?: unknown;
  links?: unknown;
} | null): ShopFormValues {
  const supported = Array.isArray(store?.supportedCoins) ? store.supportedCoins : [];
  const policies = policiesOf(store);
  const away = awayOf(store);
  return {
    logo: store?.logo || null,
    title: store?.title ?? "",
    description: store?.description ?? "",
    metaDescription: typeof store?.metaDescription === "string" ? store.metaDescription : "",
    location: store?.location ?? "",
    shipsTo: store?.shipsTo ?? "",
    // A new shop picks countries; an older one keeps its typed text until the seller ticks some.
    shippingCountries: shippingCountriesOf(store) ?? (store ? null : []),
    shippingStates: shippingStatesOf(store),
    coins: perTicker((t) => supported.includes(t)),
    addresses: perTicker((t) => (typeof store?.foreignCoins?.[t] === "string" ? store.foreignCoins[t] : "")),
    assets: Array.isArray(store?.acceptedAssets)
      ? store.acceptedAssets.filter((a) => Number.isSafeInteger(a?.id) && a.id > 0).map((a) => ({ id: a.id, name: String(a.name ?? "") }))
      : [],
    dispatchDays: policies?.dispatchDays ?? null,
    returnDays: policies?.returnDays ?? null,
    returns: policies?.returns ?? "",
    terms: policies?.terms ?? "",
    away: !!away,
    awayUntil: dayToInput(away?.until),
    awayNote: away?.note ?? "",
    languages: languagesOf(store),
    links: shopLinksOf(store).map((l) => ({ url: l.url, label: l.label ?? "" })),
  };
}

/** What the payload builders take. */
export function toStoreFields(values: ShopFormValues): StoreFields {
  const supportedCoins = ["QORT", ...FOREIGN_TICKERS.filter((t) => values.coins[t])];
  const foreignCoins: Record<string, string> = { ARRR: values.addresses.ARRR.trim() };
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    metaDescription: values.metaDescription.trim(),
    location: values.location.trim(),
    shipsTo:
      values.shippingCountries && values.shippingCountries.length > 0 ? shippingSummaryWithStates(values.shippingCountries, usStates(values)) : values.shipsTo.trim(),
    // With the country list, the states always say where (an empty list: every state, so the field goes).
    ...(values.shippingCountries !== null && { shippingCountries: values.shippingCountries, shippingStates: usStates(values) ?? [] }),
    logo: values.logo ?? "",
    foreignCoins,
    supportedCoins,
    acceptedAssets: values.assets.map((a) => ({ id: a.id, name: a.name })),
    policies: policiesForPublish(values) ?? null,
    away: awayForPublish(values),
    languages: values.languages.length > 0 ? [...values.languages] : null,
    links: linksForPublish(values),
  };
}

/** The links with an address, trimmed, at most four (null: none, so the field goes). */
function linksForPublish(values: ShopFormValues): { url: string; label?: string }[] | null {
  const links = values.links
    .map((l) => ({ url: l.url.trim(), label: l.label.trim() }))
    .filter((l) => l.url)
    .slice(0, MAX_SHOP_LINKS)
    .map((l) => (l.label ? l : { url: l.url }));
  return links.length > 0 ? links : null;
}

/** The US states it ships to when that is some only (null: every state, or not the United States). */
function usStates(values: ShopFormValues): string[] | null {
  return values.shippingCountries?.includes(US) ? values.shippingStates : null;
}

/** The first problem, in plain words, or null. */
export function validateShopForm(values: ShopFormValues): string | null {
  if (!values.logo) return "Add a shop logo";
  if (!values.title.trim()) return "Add a title";
  if (!values.description.trim()) return "Add a description";
  if (values.metaDescription.trim().length > MAX_META_DESCRIPTION) return `Shorten the meta description to ${MAX_META_DESCRIPTION} characters: more doesn't fit under a shop`;
  if (!values.location.trim()) return "Add a location";
  if (values.shippingCountries !== null ? values.shippingCountries.length === 0 : !values.shipsTo.trim()) {
    return "Tick where the shop ships to (Worldwide for anywhere)";
  }
  if (usStates(values)?.length === 0) return "Tick the US states the shop ships to, or untick the United States";
  if (values.returns.trim().length > MAX_RETURNS_TEXT) return `Shorten what you say about returns to ${MAX_RETURNS_TEXT} characters`;
  if (values.terms.trim().length > MAX_TERMS_TEXT) return `Shorten your other terms to ${MAX_TERMS_TEXT} characters`;
  if (values.links.some((l) => l.url.trim() && !isShopLinkUrl(l.url.trim()))) return "Use a qortal:// address for each link (Hub opens only those)";
  for (const t of FOREIGN_TICKERS) {
    if (values.coins[t] && !values.addresses[t].trim()) return `Add your ${t} payout address, or switch ${t} off`;
  }
  return null;
}

const ADDRESS_PATTERNS: Record<ForeignTicker, RegExp> = {
  ARRR: /^zs1[02-9ac-hj-np-z]{60,}$/,
};

/**
 * A warning when an address doesn't look like the coin's (buyers pay to it,
 * and a typo loses their money), or null. Only a hint: it never blocks.
 */
export function addressWarning(ticker: ForeignTicker, address: string): string | null {
  const a = address.trim();
  if (!a) return null;
  if (/^Q[1-9A-HJ-NP-Za-km-z]{32,33}$/.test(a)) return `That's a Qortal address. Buyers paying in ${ticker} need your ${ticker} address.`;
  if (!ADDRESS_PATTERNS[ticker].test(a)) return `This doesn't look like a ${ticker} address. Check it: buyers pay to it.`;
  return null;
}
