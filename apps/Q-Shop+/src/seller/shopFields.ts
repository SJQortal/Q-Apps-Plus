/**
 * The shop form (Create shop, Edit shop) as plain values, and how they become
 * the StoreFields the payload builders take (qdn/payloads.ts). The shapes are
 * the original's (docs/apps/Q-Shop+.md → Data contract): `supportedCoins`
 * starts with QORT; `foreignCoins` always carries `ARRR` (an empty string when
 * there is none, as the original wrote it) plus the payout address of every
 * other coin that has one; `acceptedAssets` is the + app's additive list.
 */
import { FOREIGN_TICKERS, type ForeignTicker, type ShopAsset } from "../money/coins";
import type { StoreFields } from "../qdn/payloads";

export interface ShopFormValues {
  logo: string | null;
  title: string;
  description: string;
  location: string;
  shipsTo: string;
  /** Coins the shop takes besides QORT. */
  coins: Record<ForeignTicker, boolean>;
  /** Payout address per coin, kept while a coin is switched off. */
  addresses: Record<ForeignTicker, string>;
  assets: ShopAsset[];
}

/** The original's limit for a shop title. */
export const MAX_SHOP_TITLE = 50;
/** The original's limit for a shop id. */
export const MAX_SHOP_ID = 25;

function perTicker<T>(make: (t: ForeignTicker) => T): Record<ForeignTicker, T> {
  return Object.fromEntries(FOREIGN_TICKERS.map((t) => [t, make(t)])) as Record<ForeignTicker, T>;
}

/** The form's starting values: empty for a new shop, the shop's own for an edit. */
export function shopFormValues(store?: {
  logo?: string;
  title?: string;
  description?: string;
  location?: string;
  shipsTo?: string;
  supportedCoins?: string[];
  foreignCoins?: Record<string, string>;
  acceptedAssets?: ShopAsset[];
} | null): ShopFormValues {
  const supported = Array.isArray(store?.supportedCoins) ? store.supportedCoins : [];
  return {
    logo: store?.logo || null,
    title: store?.title ?? "",
    description: store?.description ?? "",
    location: store?.location ?? "",
    shipsTo: store?.shipsTo ?? "",
    coins: perTicker((t) => supported.includes(t)),
    addresses: perTicker((t) => (typeof store?.foreignCoins?.[t] === "string" ? store.foreignCoins[t] : "")),
    assets: Array.isArray(store?.acceptedAssets)
      ? store.acceptedAssets.filter((a) => Number.isSafeInteger(a?.id) && a.id > 0).map((a) => ({ id: a.id, name: String(a.name ?? "") }))
      : [],
  };
}

/** What the payload builders take. */
export function toStoreFields(values: ShopFormValues): StoreFields {
  const supportedCoins = ["QORT", ...FOREIGN_TICKERS.filter((t) => values.coins[t])];
  const foreignCoins: Record<string, string> = { ARRR: values.addresses.ARRR.trim() };
  for (const t of FOREIGN_TICKERS) {
    if (t === "ARRR") continue;
    const address = values.addresses[t].trim();
    if (address) foreignCoins[t] = address;
  }
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location.trim(),
    shipsTo: values.shipsTo.trim(),
    logo: values.logo ?? "",
    foreignCoins,
    supportedCoins,
    acceptedAssets: values.assets.map((a) => ({ id: a.id, name: a.name })),
  };
}

/** The first problem, in plain words, or null. */
export function validateShopForm(values: ShopFormValues): string | null {
  if (!values.logo) return "Add a shop logo";
  if (!values.title.trim()) return "Add a title";
  if (!values.description.trim()) return "Add a description";
  if (!values.location.trim()) return "Add a location";
  if (!values.shipsTo.trim()) return "Say where the shop ships to";
  for (const t of FOREIGN_TICKERS) {
    if (values.coins[t] && !values.addresses[t].trim()) return `Add your ${t} payout address, or switch ${t} off`;
  }
  return null;
}

const BASE58 = "[1-9A-HJ-NP-Za-km-z]";
const ADDRESS_PATTERNS: Record<ForeignTicker, RegExp> = {
  ARRR: /^zs1[02-9ac-hj-np-z]{60,}$/,
  BTC: new RegExp(`^(bc1[02-9ac-hj-np-z]{25,87}|[13]${BASE58}{25,34})$`),
  LTC: new RegExp(`^(ltc1[02-9ac-hj-np-z]{25,87}|[LM3]${BASE58}{26,33})$`),
  DOGE: new RegExp(`^[DA9]${BASE58}{25,34}$`),
  DGB: new RegExp(`^(dgb1[02-9ac-hj-np-z]{25,87}|[DS3]${BASE58}{25,34})$`),
  RVN: new RegExp(`^[Rr]${BASE58}{25,34}$`),
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
