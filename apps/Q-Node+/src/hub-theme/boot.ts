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
 * Hub and GO inject `window._qdnTheme` and also pass `?theme=light|dark`.
 * Outside Hub (plain `npm run dev`) this falls back to dark.
 */
export function readHostMode(): ColorMode {
  if (typeof window === 'undefined') return 'dark';
  const injected = (window as Window & { _qdnTheme?: string })._qdnTheme;
  if (injected === 'light' || injected === 'dark') return injected;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('theme');
    if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;
  } catch {
    // ignore malformed search strings
  }
  return 'dark';
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
