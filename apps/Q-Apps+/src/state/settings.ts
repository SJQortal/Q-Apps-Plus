/**
 * Launcher settings, saved per app in localStorage as JSON (the same format
 * as the theme kit, so the keys sit side by side).
 */
import { atomWithStorage } from 'jotai/utils';

export const THEME_STORAGE_KEY = 'qappsplus-ui-theme';
export const RECENT_STORAGE_KEY = 'qappsplus-recent';
export const FAVOURITES_STORAGE_KEY = 'qappsplus-favourites';
export const LAYOUT_STORAGE_KEY = 'qappsplus-layout';
export const SHOW_RECENT_STORAGE_KEY = 'qappsplus-show-recent';
export const SHOW_ORIGINALS_STORAGE_KEY = 'qappsplus-show-originals';

export const MAX_RECENT = 6;

export interface RecentEntry {
  name: string;
  /** ms since epoch */
  at: number;
}

export type LayoutMode = 'grid' | 'list';

const opts = { getOnInit: true } as const;

export const recentAppsAtom = atomWithStorage<RecentEntry[]>(RECENT_STORAGE_KEY, [], undefined, opts);
export const favouriteAppsAtom = atomWithStorage<string[]>(FAVOURITES_STORAGE_KEY, [], undefined, opts);
export const layoutModeAtom = atomWithStorage<LayoutMode>(LAYOUT_STORAGE_KEY, 'grid', undefined, opts);
export const showRecentAtom = atomWithStorage<boolean>(SHOW_RECENT_STORAGE_KEY, true, undefined, opts);
export const showOriginalsAtom = atomWithStorage<boolean>(SHOW_ORIGINALS_STORAGE_KEY, true, undefined, opts);

/** Newest first, one entry per app, capped at MAX_RECENT. */
export function pushRecent(list: RecentEntry[], name: string, at: number): RecentEntry[] {
  const rest = list.filter((entry) => entry.name !== name);
  return [{ name, at }, ...rest].slice(0, MAX_RECENT);
}

export function toggleFavourite(list: string[], name: string): string[] {
  return list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
}
