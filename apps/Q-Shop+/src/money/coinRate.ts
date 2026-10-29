/**
 * The rate a shop's prices convert at for a coin, wherever prices are worked
 * out (a shop's prices, the cart, checkout): the node's rate for a foreign
 * coin (money/rates.ts), or a Q-Asset's when the shop gives it a price
 * setting (money/assetRates.ts). QORT and an asset without one have none.
 */
import { assetIdOf, isForeignTicker, shopAssets, type ShopCoinSettings } from "./coins";
import { cachedRate, getRate } from "./rates";
import { assetRate, type AssetPricing, type AssetRate } from "./assetRates";

function pricingOf(coin: string, shop: ShopCoinSettings | null | undefined): AssetPricing | undefined {
  const id = assetIdOf(coin);
  return id === null ? undefined : shopAssets(shop).find((a) => a.id === id)?.price;
}

/** Whether prices in `coin` at this shop convert at a rate (that has to be read). */
export function needsRate(coin: string, shop: ShopCoinSettings | null | undefined): boolean {
  return isForeignTicker(coin) || !!pricingOf(coin, shop);
}

/** A key for a coin at a shop that changes with the asset's price setting (for caches and effects). */
export function rateKey(coin: string, shop: ShopCoinSettings | null | undefined): string {
  const pricing = pricingOf(coin, shop);
  return pricing ? `${coin} ${JSON.stringify(pricing)}` : coin;
}

const assetCache = new Map<string, { value: AssetRate; at: number }>();
const ASSET_TTL_MS = 5 * 60_000;

/** The rate, read now (cached a few minutes); rejects when there is none. */
export async function coinRate(coin: string, shop: ShopCoinSettings | null | undefined, options: { fresh?: boolean } = {}): Promise<{ rate: number; asset: AssetRate | null }> {
  const id = assetIdOf(coin);
  if (id === null) return { rate: await getRate(coin, options), asset: null };
  const pricing = pricingOf(coin, shop);
  const key = rateKey(coin, shop);
  const hit = assetCache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < ASSET_TTL_MS) return { rate: hit.value.rate, asset: hit.value };
  const found = await assetRate(id, pricing);
  if (!found) throw new Error("No price");
  assetCache.set(key, { value: found, at: Date.now() });
  return { rate: found.rate, asset: found };
}

/** The rate if one is fresh, without asking the node. */
export function cachedCoinRate(coin: string, shop: ShopCoinSettings | null | undefined): { rate: number; asset: AssetRate | null } | null {
  if (assetIdOf(coin) === null) {
    const rate = isForeignTicker(coin) ? cachedRate(coin) : null;
    return rate === null ? null : { rate, asset: null };
  }
  const hit = assetCache.get(rateKey(coin, shop));
  return hit && Date.now() - hit.at < ASSET_TTL_MS ? { rate: hit.value.rate, asset: hit.value } : null;
}

/** Why converted prices can't be shown in `coin` now: "Your node has no ARRR exchange rate right now". */
export function noRateText(coin: string, label: string): string {
  return assetIdOf(coin) !== null ? `The Q-Assets trade portal has no ${label} price on your node right now` : `Your node has no ${label} exchange rate right now`;
}

/** For tests. */
export function resetCoinRates(): void {
  assetCache.clear();
}
