import {
  UI_THEME_HUB,
  UI_THEME_QUITTER,
  UI_THEME_WHITE,
  UI_THEME_X,
  isUiThemeId,
  type TorqUiThemeId,
} from '../styles/theme/theme';
import { resolveQdnBase } from './hubLocation';

const UI_THEME_STORAGE_KEY = 'torq-ui-theme-v2';

export type HubFrameTheme = 'dark' | 'light';

export function readHubFrameTheme(): HubFrameTheme {
  if (typeof window === 'undefined') return 'dark';
  const injected = (window as Window & { _qdnTheme?: string })._qdnTheme;
  if (injected === 'light' || injected === 'dark') return injected;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('theme');
    if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;
  } catch {
    // ignore invalid search
  }
  return 'dark';
}

export function readStoredUiTheme(): TorqUiThemeId {
  if (typeof window === 'undefined') return UI_THEME_HUB;
  try {
    const raw = window.localStorage.getItem(UI_THEME_STORAGE_KEY);
    if (!raw) return UI_THEME_HUB;
    const parsed = JSON.parse(raw);
    return isUiThemeId(parsed) ? parsed : UI_THEME_HUB;
  } catch {
    return UI_THEME_HUB;
  }
}

export function bootBackground(
  mode: HubFrameTheme,
  ui: TorqUiThemeId = UI_THEME_HUB
): string {
  if (ui === UI_THEME_WHITE) return '#ffffff';
  if (ui === UI_THEME_X) return mode === 'light' ? '#ffffff' : '#000000';
  if (mode === 'light') {
    return ui === UI_THEME_QUITTER ? '#f7f9fc' : '#EEE7DC';
  }
  return ui === UI_THEME_QUITTER ? '#15202b' : '#0E0F14';
}

/** GO 3.0 and Hub both host the Q-app in an iframe shorter than the device screen. */
export function isEmbeddedFrame(win: Window = window): boolean {
  try {
    return win.parent !== win;
  } catch {
    return true;
  }
}

export function embeddedAppHeight(framed: boolean, innerHeight = 0): string {
  if (!framed) return '100dvh';
  if (innerHeight > 0) return `${Math.round(innerHeight)}px`;
  return '100%';
}

export function applyEmbeddedFrame(win: Window = window) {
  if (typeof win.document === 'undefined') return;
  const framed = isEmbeddedFrame(win);
  const root = win.document.documentElement;
  root.classList.toggle('torq-framed', framed);
  const innerHeight = framed ? win.innerHeight : 0;
  root.style.setProperty(
    '--torq-app-height',
    embeddedAppHeight(framed, innerHeight)
  );
}

/** Hub resizes the iframe; keep both side columns as tall as that frame. */
export function watchEmbeddedFrame(win: Window = window): () => void {
  const apply = () => applyEmbeddedFrame(win);
  apply();
  win.addEventListener('resize', apply);
  return () => win.removeEventListener('resize', apply);
}

export function applyDocumentChrome(
  mode: HubFrameTheme = readHubFrameTheme(),
  ui: TorqUiThemeId = readStoredUiTheme()
) {
  if (typeof document === 'undefined') return;
  const background = bootBackground(mode, ui);
  const root = document.documentElement;
  root.setAttribute('data-theme', mode);
  root.setAttribute('data-ui-theme', ui);
  root.style.colorScheme = mode;
  root.style.background = background;
  if (document.body) {
    document.body.style.background = background;
  }
}

const HUB_CHROME_QUERY = new Set([
  'theme',
  'lang',
  'identifier',
  'time',
  'isManualNavigation',
]);

/** Drop Hub iframe chrome (`theme`, `lang`, `identifier`, `time`) from the visible URL. */
export function stripHubChromeSearch(): string {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    const kept = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      if (!HUB_CHROME_QUERY.has(key)) kept.append(key, value);
    });
    const search = kept.toString();
    const cleaned = `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (cleaned !== current) {
      window.history.replaceState(window.history.state, '', cleaned);
    }
    return cleaned;
  } catch {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }
}

export function ensureQdnBaseHref(): string {
  if (typeof document === 'undefined') return '';
  const base = resolveQdnBase();
  if (!base) return '';
  const href = `${base}/`;
  let tag = document.querySelector('base');
  if (!tag) {
    tag = document.createElement('base');
    document.head.insertBefore(tag, document.head.firstChild);
  }
  if (tag.getAttribute('href') !== href) {
    tag.setAttribute('href', href);
  }
  return href;
}

/** Hub refresh concatenates this path, then appends `?theme&identifier&time`. */
export function hubRefreshRenderUrl(
  service: string,
  name: string,
  path: string,
  extras: { theme?: string; lang?: string; identifier?: string; time?: string | number } = {}
): string {
  const theme = extras.theme ?? 'dark';
  const lang = extras.lang ?? 'en';
  const identifier = extras.identifier ?? '';
  const time = extras.time ?? 1;
  return `/render/${service}/${name}${path ?? ''}?theme=${theme}&lang=${lang}&identifier=${identifier}&time=${time}`;
}
