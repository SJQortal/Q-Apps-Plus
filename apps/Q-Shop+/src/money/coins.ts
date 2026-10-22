/**
 * The coins a shop can take. QORT and ARRR are the original's; BTC, LTC,
 * DOGE, DGB and RVN are the other coins Hub's SEND_COIN pays in (Hub
 * `qortal/get.ts` sendCoin); Qortal assets (Q-Assets) are paid with Hub's
 * TRANSFER_ASSET. The extra coins and assets are additive data
 * (docs/apps/Q-Shop+.md → Data contract).
 */

export type ForeignTicker = "ARRR" | "BTC" | "LTC" | "DOGE" | "DGB" | "RVN";
export type CoinTicker = "QORT" | ForeignTicker;
/** A coin as the app passes it around: a ticker, or `ASSET:<id>` for a Qortal asset. */
export type CoinId = CoinTicker | `ASSET:${number}`;

export interface CoinInfo {
  ticker: CoinTicker;
  label: string;
  /** Core's SupportedBlockchain for /crosschain/price, or null for QORT. */
  blockchain: string | null;
}

export const COINS: Record<CoinTicker, CoinInfo> = {
  QORT: { ticker: "QORT", label: "QORT", blockchain: null },
  ARRR: { ticker: "ARRR", label: "Pirate Chain (ARRR)", blockchain: "PIRATECHAIN" },
  BTC: { ticker: "BTC", label: "Bitcoin (BTC)", blockchain: "BITCOIN" },
  LTC: { ticker: "LTC", label: "Litecoin (LTC)", blockchain: "LITECOIN" },
  DOGE: { ticker: "DOGE", label: "Dogecoin (DOGE)", blockchain: "DOGECOIN" },
  DGB: { ticker: "DGB", label: "DigiByte (DGB)", blockchain: "DIGIBYTE" },
  RVN: { ticker: "RVN", label: "Ravencoin (RVN)", blockchain: "RAVENCOIN" },
};

/** The original's two, then the rest in Hub's order. */
export const FOREIGN_TICKERS: ForeignTicker[] = ["ARRR", "BTC", "LTC", "DOGE", "DGB", "RVN"];

export function isForeignTicker(value: string): value is ForeignTicker {
  return (FOREIGN_TICKERS as string[]).includes(value);
}

export function isCoinTicker(value: string): value is CoinTicker {
  return value === "QORT" || isForeignTicker(value);
}

const ASSET_PREFIX = "ASSET:";

export function assetCoinId(assetId: number): CoinId {
  return `${ASSET_PREFIX}${assetId}` as CoinId;
}

/** The asset id of an `ASSET:<id>` coin, or null. */
export function assetIdOf(coin: string): number | null {
  if (!coin.startsWith(ASSET_PREFIX)) return null;
  const id = Number(coin.slice(ASSET_PREFIX.length));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function isAssetCoin(coin: string): boolean {
  return assetIdOf(coin) !== null;
}

/**
 * The `currency` a product's price entry uses for a coin: the original writes
 * `"qort"` (lower case) for QORT and `"ARRR"` for ARRR; the + app writes the
 * other tickers the same way as ARRR, and `ASSET:<id>` for assets.
 */
export function priceCurrencyKey(coin: string): string {
  return coin === "QORT" ? "qort" : coin;
}

export interface ShopAsset {
  id: number;
  name: string;
}

export interface ShopCoinSettings {
  supportedCoins?: string[];
  foreignCoins?: Record<string, string>;
  acceptedAssets?: ShopAsset[];
}

/*
 * A shop's JSON is anyone's data, and checkStructureStore only checks five
 * other fields. Everything below reads the coin fields tolerantly: a value of
 * the wrong type counts as absent and is never thrown on, because the home
 * page calls shopCoins for every shop card while it renders.
 */

/** The shop's payout address for a foreign coin, trimmed, or "" when it has none. */
export function payoutAddress(shop: ShopCoinSettings | null | undefined, ticker: string): string {
  const coins: unknown = shop?.foreignCoins;
  if (!coins || typeof coins !== "object" || Array.isArray(coins)) return "";
  const value = (coins as Record<string, unknown>)[ticker];
  return typeof value === "string" ? value.trim() : "";
}

/** The tickers a shop lists as supported: only the strings of an array. */
function supportedTickers(shop: ShopCoinSettings | null | undefined): string[] {
  const supported: unknown = shop?.supportedCoins;
  return Array.isArray(supported) ? supported.filter((coin): coin is string => typeof coin === "string") : [];
}

/** The assets a shop lists with a valid id, each once, with a string name ("" when it has none). */
export function shopAssets(shop: ShopCoinSettings | null | undefined): ShopAsset[] {
  const assets: unknown = shop?.acceptedAssets;
  if (!Array.isArray(assets)) return [];
  const seen = new Set<number>();
  const out: ShopAsset[] = [];
  for (const asset of assets) {
    if (!asset || typeof asset !== "object") continue;
    const { id, name } = asset as { id?: unknown; name?: unknown };
    if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: typeof name === "string" ? name : "" });
  }
  return out;
}

/**
 * The coins a shop takes, QORT first: a foreign coin counts only with a
 * payout address (as the original requires for ARRR), an asset when listed.
 */
export function shopCoins(shop: ShopCoinSettings | null | undefined): CoinId[] {
  const coins: CoinId[] = ["QORT"];
  const supported = supportedTickers(shop);
  for (const ticker of FOREIGN_TICKERS) {
    if (supported.includes(ticker) && payoutAddress(shop, ticker)) coins.push(ticker);
  }
  for (const asset of shopAssets(shop)) coins.push(assetCoinId(asset.id));
  return coins;
}

/** A short label for a coin: the ticker, or the asset's name. Always a string. */
export function coinLabel(coin: string, shop?: ShopCoinSettings | null): string {
  const assetId = assetIdOf(coin);
  if (assetId !== null) {
    return shopAssets(shop).find((a) => a.id === assetId)?.name.trim() || `Asset #${assetId}`;
  }
  return coin;
}
