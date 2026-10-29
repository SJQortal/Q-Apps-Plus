/**
 * Reads what Hub tells the app about light/dark mode, and paints the page
 * background before React mounts. Ported from Torq's src/utils/hubBoot.ts.
 */
import {
  DEFAULT_UI_THEME,
  bootBackground,
  isUiThemeId,
  resolveMode,
  type ColorMode,
  type Hub20Config,
  type UiThemeId,
} from './tokens';

/**
 * Where Hub's light/dark mode is remembered, for reloads that lose it. One
 * key for every Q-App on the node's origin: Hub's mode is the same for all.
 */
export const HOST_MODE_KEY = 'qplus-hub-mode';

/** The mode Hub posted during this page's life (THEME_CHANGED): newer than the URL's. */
let toldThisPage: ColorMode | null = null;

function isMode(value: unknown): value is ColorMode {
  return value === 'light' || value === 'dark';
}

/** Remember Hub's mode for the next load (storage can be unavailable: then it's for this page). */
export function rememberHostMode(mode: ColorMode): void {
  try {
    window.localStorage.setItem(HOST_MODE_KEY, mode);
  } catch {
    // private windows: the mode still applies to this page
  }
}

function rememberedHostMode(): ColorMode | null {
  try {
    const value = window.localStorage.getItem(HOST_MODE_KEY);
    return isMode(value) ? value : null;
  } catch {
    return null;
  }
}

/** Hub switched light/dark while the app is open: that wins until the next load, and is remembered. */
export function noteHostMode(mode: ColorMode): void {
  toldThisPage = mode;
  rememberHostMode(mode);
}

/**
 * Hub's light/dark mode. Hub and GO open an app with `?theme=light|dark`,
 * which Core also injects as `window._qdnTheme`. In-app navigation changes
 * the path and drops that query, so a reload afterwards has no `theme`, and
 * Core then injects its own default, "light", whatever Hub's mode. So, in
 * order: what Hub posted during this page's life, the URL's `theme` (which
 * is remembered), the remembered mode, the injected value, and outside Hub
 * (plain `npm run dev`) dark.
 */
export function readHostMode(): ColorMode {
  if (typeof window === 'undefined') return 'dark';
  if (toldThisPage) return toldThisPage;
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(window.location.search).get('theme');
  } catch {
    // ignore malformed search strings
  }
  if (isMode(fromUrl)) {
    rememberHostMode(fromUrl);
    return fromUrl;
  }
  const remembered = rememberedHostMode();
  if (remembered) return remembered;
  const injected = (window as Window & { _qdnTheme?: string })._qdnTheme;
  return isMode(injected) ? injected : 'dark';
}

/** Tests: forget what Hub posted during this page's life. */
export function resetHostModeForTests(): void {
  toldThisPage = null;
}

/**
 * Hub posts `{ action: 'THEME_CHANGED', theme: 'light' | 'dark' }` into the
 * app's frame when the user flips Hub's own light/dark switch. Returns the new
 * mode, or null for any other message.
 */
export function hostModeFromMessage(data: unknown): ColorMode | null {
  if (!data || typeof data !== 'object') return null;
  const { action, theme } = data as { action?: unknown; theme?: unknown };
  if (action !== 'THEME_CHANGED') return null;
  return theme === 'light' || theme === 'dark' ? theme : null;
}

/** The theme is stored as a JSON string so it matches jotai's atomWithStorage format. */
export function readStoredUiTheme(storageKey: string): UiThemeId {
  if (typeof window === 'undefined') return DEFAULT_UI_THEME;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_UI_THEME;
    const parsed: unknown = JSON.parse(raw);
    return isUiThemeId(parsed) ? parsed : DEFAULT_UI_THEME;
  } catch {
    return DEFAULT_UI_THEME;
  }
}

export function writeStoredUiTheme(storageKey: string, id: UiThemeId): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(id));
  } catch {
    // storage can be unavailable in private windows; the theme still applies for this visit
  }
}

/** Sets data-theme / data-ui-theme on <html> and paints the background. */
export function applyDocumentChrome(id: UiThemeId, hostMode: ColorMode, hub20: Hub20Config): void {
  if (typeof document === 'undefined') return;
  const mode = resolveMode(id, hostMode);
  const background = bootBackground(id, hostMode, hub20);
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.setAttribute('data-ui-theme', id);
  root.style.colorScheme = mode;
  root.style.background = background;
  if (document.body) document.body.style.background = background;
}
