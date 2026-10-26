/**
 * A shop's STORE JSON, read safely. Any name can publish a STORE resource,
 * and the original's check (checkStructureStore) only asks that five fields
 * are there, so a shop can carry `"supportedCoins": 1`, `"foreignCoins":
 * {"ARRR": 5}`, `"acceptedAssets": {}` or an object as its title. Rendering
 * that threw, and one such shop took the whole app down for every visitor.
 *
 * The home cards (discovery/shopDetails) and the shop and product pages
 * (pages/Store/useShopData) read every shop through here first: a field of
 * the wrong type is dropped, everything else is kept as it is. This is
 * display only: nothing here is written back to QDN (an edit republishes the
 * seller's own copy, which doesn't come through here).
 */
import type { ShopAsset } from "../money/coins";
import { assetPricingOf } from "../money/assetRates";

/** The STORE JSON as the original writes it, plus the + app's additive fields (docs/apps/Q-Shop+.md → Data contract). */
export interface ShopJson {
  title?: string;
  description?: string;
  location?: string;
  shipsTo?: string;
  created?: number;
  shortStoreId?: string;
  logo?: string;
  supportedCoins?: string[];
  foreignCoins?: Record<string, string>;
  acceptedAssets?: ShopAsset[];
}

/** Text the pages render as it is. */
const TEXT_FIELDS = ["title", "description", "location", "shipsTo", "shortStoreId", "logo"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === "string";

/** A Qortal asset as the seller tools write it: a positive whole id and a name. */
function isShopAsset(value: unknown): value is ShopAsset {
  if (!isPlainObject(value)) return false;
  return Number.isSafeInteger(value.id) && (value.id as number) > 0 && isString(value.name);
}

function finiteNumber(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/**
 * The shop with every field it renders or pays with in the type the app
 * expects, or null when the JSON isn't an object at all:
 * - title, description, location, ships-to, short id and logo: text, or gone;
 * - created: a number, or gone;
 * - supportedCoins: the tickers (text) only;
 * - foreignCoins: the addresses (text) only;
 * - acceptedAssets: `{id, name}` with a positive whole id and a text name only, and a well-formed `price` setting.
 */
export function normalizeShopJson(json: unknown): (ShopJson & Record<string, unknown>) | null {
  if (!isPlainObject(json)) return null;
  const shop: Record<string, unknown> = { ...json };
  for (const field of TEXT_FIELDS) {
    if (field in shop && !isString(shop[field])) delete shop[field];
  }
  if ("created" in shop) {
    const created = finiteNumber(shop.created);
    if (created === undefined) delete shop.created;
    else shop.created = created;
  }
  if ("supportedCoins" in shop) {
    shop.supportedCoins = Array.isArray(shop.supportedCoins) ? shop.supportedCoins.filter(isString) : [];
  }
  if ("foreignCoins" in shop) {
    shop.foreignCoins = isPlainObject(shop.foreignCoins)
      ? Object.fromEntries(Object.entries(shop.foreignCoins).filter(([, address]) => isString(address)))
      : {};
  }
  if ("acceptedAssets" in shop) {
    shop.acceptedAssets = Array.isArray(shop.acceptedAssets)
      ? shop.acceptedAssets.filter(isShopAsset).map((asset) => {
          // Its price setting (money/assetRates.ts), when well formed.
          const price = assetPricingOf((asset as { price?: unknown }).price);
          return price ? { id: asset.id, name: asset.name, price } : { id: asset.id, name: asset.name };
        })
      : [];
  }
  return shop as ShopJson & Record<string, unknown>;
}
