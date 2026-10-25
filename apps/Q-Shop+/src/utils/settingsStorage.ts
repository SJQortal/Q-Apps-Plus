/**
 * Per-app settings kept in localStorage (the theme has its own key in the
 * hub-theme kit). Everything here is a convenience: the app works without it.
 */
import { SETTINGS_STORAGE_KEY } from "../constants/plus";
import { assetIdOf, isCoinTicker } from "../money/coins";

export { SETTINGS_STORAGE_KEY };

export interface StoredSettings {
  preferredCoin?: string;
  /** How a shop shows its products (utils/productView.ts). */
  productView?: string;
  /** Show names for sale (utils/namesSetting.ts); absent: shown. */
  showNames?: boolean;
  /** Show the account's balance in the header (wallet/balances.ts); absent: shown. This device only. */
  showBalance?: boolean;
  /** Where the buyer gets things delivered, for prices before checkout (delivery/buyerPlace.ts); this device only, not synced. */
  deliverTo?: { country?: unknown; state?: unknown };
}

/**
 * A coin the app can prefer: QORT, ARRR or a Qortal asset as `ASSET:<id>`.
 * Anything else (a typo, a coin an earlier build offered) is ignored, so
 * prices fall back to QORT.
 */
export function isPreferredCoin(value: unknown): value is string {
  return typeof value === "string" && (isCoinTicker(value) || assetIdOf(value) !== null);
}

export function readStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StoredSettings) : {};
  } catch {
    return {};
  }
}

export function writeStoredSettings(patch: StoredSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...readStoredSettings(), ...patch }));
  } catch {
    // storage can be unavailable in private windows; the setting still applies for this visit
  }
}
