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

/**
 * The coins a shop takes, QORT first: a foreign coin counts only with a
 * payout address (as the original requires for ARRR), an asset when listed.
 */
export function shopCoins(shop: ShopCoinSettings | null | undefined): CoinId[] {
  const coins: CoinId[] = ["QORT"];
  const supported = shop?.supportedCoins ?? [];
  for (const ticker of FOREIGN_TICKERS) {
    if (supported.includes(ticker) && shop?.foreignCoins?.[ticker]?.trim()) coins.push(ticker);
  }
  for (const asset of shop?.acceptedAssets ?? []) {
    if (Number.isSafeInteger(asset?.id) && asset.id > 0) coins.push(assetCoinId(asset.id));
  }
  return coins;
}

/** A short label for a coin: the ticker, or the asset's name. */
export function coinLabel(coin: string, shop?: ShopCoinSettings | null): string {
  const assetId = assetIdOf(coin);
  if (assetId !== null) {
    return shop?.acceptedAssets?.find((a) => a.id === assetId)?.name || `Asset #${assetId}`;
  }
  return coin;
}
