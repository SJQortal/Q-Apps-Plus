import { useSyncExternalStore } from "react";

/**
 * App settings kept on this device (localStorage). Additive and local: nothing
 * here is written to QDN. Components read them with `useAppSettings()`.
 */
export const SETTINGS_STORAGE_KEY = "qshareplus-settings";

export type SortOrder = "newest" | "oldest";

export interface AppSettings {
  /** Show image attachments up to 5 MB on the share page without a click. */
  autoPreviewImages: boolean;
  /** Sort order Home starts with. */
  defaultSort: SortOrder;
  /** Names whose shares and comments are hidden in this app only (not a Qortal block). */
  hiddenNames: string[];
  /** Show the "Following" feed chip on Home. */
  followingFeed: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoPreviewImages: true,
  defaultSort: "newest",
  hiddenNames: [],
  followingFeed: true,
};

const listeners = new Set<() => void>();
let cached: AppSettings | null = null;

function sanitize(raw: unknown): AppSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof AppSettings, unknown>>;
  return {
    autoPreviewImages:
      typeof r.autoPreviewImages === "boolean" ? r.autoPreviewImages : DEFAULT_SETTINGS.autoPreviewImages,
    defaultSort: r.defaultSort === "oldest" ? "oldest" : "newest",
    hiddenNames: Array.isArray(r.hiddenNames)
      ? [...new Set(r.hiddenNames.filter((n): n is string => typeof n === "string").map((n) => n.trim()).filter(Boolean))]
      : [],
    followingFeed: typeof r.followingFeed === "boolean" ? r.followingFeed : DEFAULT_SETTINGS.followingFeed,
  };
}

export function readSettings(): AppSettings {
  if (cached) return cached;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(SETTINGS_STORAGE_KEY);
    cached = sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    cached = { ...DEFAULT_SETTINGS };
  }
  return cached;
}

export function writeSettings(patch: Partial<AppSettings>): AppSettings {
  const next = sanitize({ ...readSettings(), ...patch });
  cached = next;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage may be unavailable; the value still applies for this visit
  }
  listeners.forEach((l) => l());
  return next;
}

/** Case-insensitive check against the in-app hidden list. */
export function isNameHidden(name: string | undefined | null, settings: AppSettings = readSettings()): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return settings.hiddenNames.some((n) => n.toLowerCase() === lower);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SETTINGS_STORAGE_KEY) {
      cached = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppSettings(): AppSettings {
  return useSyncExternalStore(subscribe, readSettings, readSettings);
}

/** For tests. */
export function resetSettingsCache(): void {
  cached = null;
}
