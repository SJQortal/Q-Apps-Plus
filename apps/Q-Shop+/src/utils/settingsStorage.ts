/**
 * Per-app settings kept in localStorage (the theme has its own key in the
 * hub-theme kit). Everything here is a convenience: the app works without it.
 */
export const SETTINGS_STORAGE_KEY = "qshopplus-settings";

export interface StoredSettings {
  preferredCoin?: string;
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
