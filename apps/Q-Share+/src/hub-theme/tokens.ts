/**
 * Q-Apps+ theme tokens: the single source of truth for the four themes every
 * + app ships. Values are lifted from Torq, whose Hub 3.0 theme was matched
 * to Qortal Hub 3.0.
 *
 * This file has no dependencies so React/MUI apps, plain-JS apps, and the
 * CSS generator (build-css.mjs) all read the same numbers. Edit it here, then
 * run `scripts/sync-theme.sh` to copy the kit into the apps.
 */

export type UiThemeId = 'hub30' | 'hub20' | 'black' | 'white';
export type ColorMode = 'light' | 'dark';

export const UI_THEME_IDS: readonly UiThemeId[] = ['hub30', 'hub20', 'black', 'white'];
export const DEFAULT_UI_THEME: UiThemeId = 'hub30';

export function isUiThemeId(value: unknown): value is UiThemeId {
  return typeof value === 'string' && (UI_THEME_IDS as readonly string[]).includes(value);
}

/**
 * Hub 3.0 and Hub 2.0 follow the light/dark mode Hub passes to the app.
 * Black is always dark and White is always light.
 */
export function resolveMode(id: UiThemeId, hostMode: ColorMode): ColorMode {
  if (id === 'black') return 'dark';
  if (id === 'white') return 'light';
  return hostMode;
}

export interface PaletteTokens {
  primary: { main: string; dark: string; light: string; contrastText: string };
  secondary: string;
  success: string;
  error: string;
  background: { default: string; paper: string; surface: string; elevated: string };
  text: { primary: string; secondary: string };
  divider: string;
  action: { hover: string; selected: string };
}

/** Translucent header/rail fills and page backdrops that MUI's palette has no slot for. */
export interface ChromeTokens {
  chrome: string;
  chromeStrong: string;
  chromeSoft: string;
  chromeMuted: string;
  chromeFaint: string;
  appGradient: string;
  appGlow: string;
  fadeEdge: string;
  embedFill: string;
  primarySoft: string;
  /** Solid colour painted before the app loads; matches the top of appGradient. */
  boot: string;
}

export interface ShapeTokens {
  base: number;
  button: number;
  card: number;
  dialog: number;
  popover: number;
}

export interface ThemeTokens {
  id: UiThemeId;
  mode: ColorMode;
  fontFamily: string;
  palette: PaletteTokens;
  chrome: ChromeTokens;
  shape: ShapeTokens;
}

export const HUB_BLUE = {
  primary: '#84AFF0',
  hover: '#6FA3F0',
  pressed: '#5A8FE0',
  contrast: 'rgba(10, 18, 30, 0.92)',
  gradientTop: '#8FB8F3',
  gradientMid: '#79AAF0',
  gradientBottom: '#6FA3F0',
} as const;

const INTER_STACK = ['Inter', '"Segoe UI"', 'ui-sans-serif', 'system-ui', 'sans-serif'].join(',');
const SYSTEM_STACK = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(',');

const HUB30: Record<ColorMode, Omit<ThemeTokens, 'id' | 'mode'>> = {
  dark: {
    fontFamily: INTER_STACK,
    palette: {
      primary: {
        main: HUB_BLUE.primary,
        dark: HUB_BLUE.pressed,
        light: HUB_BLUE.gradientTop,
        contrastText: HUB_BLUE.contrast,
      },
      secondary: HUB_BLUE.hover,
      success: 'rgb(94, 176, 73)',
      error: 'rgb(177, 70, 70)',
      background: { default: '#0E0F14', paper: '#1D1F27', surface: '#1B1D24', elevated: '#23262F' },
      text: { primary: 'rgb(244, 247, 251)', secondary: '#989BA7' },
      divider: '#23262F',
      action: { hover: '#23262F', selected: '#262931' },
    },
    chrome: {
      chrome: 'rgba(14, 15, 20, 0.88)',
      chromeStrong: 'rgba(14, 15, 20, 0.96)',
      chromeSoft: 'rgba(14, 15, 20, 0.52)',
      chromeMuted: 'rgba(29, 31, 39, 0.72)',
      chromeFaint: 'rgba(29, 31, 39, 0.42)',
      appGradient: 'linear-gradient(180deg, #0E0F14 0%, #0E0F14 100%)',
      appGlow:
        'radial-gradient(circle at 18% 12%, rgba(132, 175, 240, 0.08) 0%, transparent 42%), radial-gradient(circle at 82% 88%, rgba(132, 175, 240, 0.05) 0%, transparent 48%)',
      fadeEdge: 'linear-gradient(to left, rgba(14, 15, 20, 0.96), transparent)',
      embedFill: 'linear-gradient(180deg, rgba(29, 31, 39, 0.92) 0%, rgba(27, 29, 36, 0.92) 100%)',
      primarySoft: 'rgba(132, 175, 240, 0.16)',
      boot: '#0E0F14',
    },
    shape: { base: 8, button: 8, card: 8, dialog: 12, popover: 10 },
  },
  light: {
    fontFamily: INTER_STACK,
    palette: {
      primary: {
        main: HUB_BLUE.primary,
        dark: HUB_BLUE.pressed,
        light: HUB_BLUE.gradientTop,
        contrastText: HUB_BLUE.contrast,
      },
      secondary: HUB_BLUE.hover,
      success: 'rgb(94, 176, 73)',
      error: 'rgb(177, 70, 70)',
      background: { default: '#DDD6CA', paper: '#F6F2EA', surface: '#EEE7DC', elevated: '#E2D9CB' },
      text: { primary: 'rgba(21, 26, 35, 0.94)', secondary: 'rgba(88, 96, 110, 0.86)' },
      divider: 'rgba(28, 36, 52, 0.12)',
      action: { hover: 'rgba(28, 36, 52, 0.06)', selected: 'rgba(41, 121, 218, 0.12)' },
    },
    chrome: {
      chrome: 'rgba(246, 242, 234, 0.88)',
      chromeStrong: 'rgba(246, 242, 234, 0.96)',
      chromeSoft: 'rgba(238, 231, 220, 0.62)',
      chromeMuted: 'rgba(238, 231, 220, 0.72)',
      chromeFaint: 'rgba(221, 214, 202, 0.45)',
      appGradient: 'linear-gradient(180deg, #EEE7DC 0%, #DDD6CA 100%)',
      appGlow:
        'radial-gradient(circle at 20% 20%, rgba(132, 175, 240, 0.12) 0%, transparent 46%), radial-gradient(circle at 80% 80%, rgba(132, 175, 240, 0.08) 0%, transparent 50%)',
      fadeEdge: 'linear-gradient(to left, rgba(246, 242, 234, 0.96), transparent)',
      embedFill:
        'linear-gradient(180deg, rgba(246, 242, 234, 0.92) 0%, rgba(238, 231, 220, 0.92) 100%)',
      primarySoft: 'rgba(132, 175, 240, 0.16)',
      boot: '#EEE7DC',
    },
    shape: { base: 8, button: 8, card: 8, dialog: 12, popover: 10 },
  },
};

/** Torq's "X Theme" in its lights-out variant. */
const BLACK: Omit<ThemeTokens, 'id' | 'mode'> = {
  fontFamily: SYSTEM_STACK,
  palette: {
    // Black text on the X blue: white read at 3.2:1 on it (DESIGN.md asks for 4.5:1).
    primary: { main: '#1d9bf0', dark: '#1a8cd8', light: '#8ecdf8', contrastText: '#000000' },
    secondary: '#e7e9ea',
    success: '#00ba7c',
    error: '#f91880',
    background: { default: '#000000', paper: '#000000', surface: '#000000', elevated: '#16181c' },
    // #8b9096 instead of X's #71767b: the input labels read at 3.9:1 on the elevated surface.
    text: { primary: '#e7e9ea', secondary: '#8b9096' },
    divider: '#2f3336',
    action: { hover: 'rgba(231, 233, 234, 0.1)', selected: 'rgba(29, 155, 240, 0.12)' },
  },
  chrome: {
    chrome: 'rgba(0, 0, 0, 0.92)',
    chromeStrong: 'rgba(0, 0, 0, 0.98)',
    chromeSoft: 'rgba(0, 0, 0, 0.72)',
    chromeMuted: 'rgba(0, 0, 0, 0.84)',
    chromeFaint: 'rgba(0, 0, 0, 0.55)',
    appGradient: '#000000',
    appGlow: 'none',
    fadeEdge: 'linear-gradient(to left, rgba(0, 0, 0, 0.98), transparent)',
    embedFill: '#16181c',
    primarySoft: 'rgba(29, 155, 240, 0.12)',
    boot: '#000000',
  },
  shape: { base: 16, button: 999, card: 16, dialog: 16, popover: 12 },
};

const WHITE: Omit<ThemeTokens, 'id' | 'mode'> = {
  fontFamily: ['Inter', SYSTEM_STACK].join(','),
  palette: {
    primary: { main: '#111111', dark: '#000000', light: '#3a3a3a', contrastText: '#ffffff' },
    secondary: '#5f6b76',
    success: '#067d52',
    error: '#d01268',
    background: { default: '#ffffff', paper: '#ffffff', surface: '#ffffff', elevated: '#f6f6f6' },
    text: { primary: '#111111', secondary: '#5f6b76' },
    divider: '#e6e6e6',
    action: { hover: 'rgba(17, 17, 17, 0.05)', selected: 'rgba(17, 17, 17, 0.08)' },
  },
  chrome: {
    chrome: 'rgba(255, 255, 255, 0.96)',
    chromeStrong: '#ffffff',
    chromeSoft: 'rgba(255, 255, 255, 0.8)',
    chromeMuted: '#ffffff',
    chromeFaint: 'rgba(255, 255, 255, 0.7)',
    appGradient: '#ffffff',
    appGlow: 'none',
    fadeEdge: 'linear-gradient(to left, #ffffff, transparent)',
    embedFill: '#fafafa',
    primarySoft: 'rgba(17, 17, 17, 0.06)',
    boot: '#ffffff',
  },
  shape: { base: 12, button: 999, card: 16, dialog: 16, popover: 12 },
};

/**
 * Tokens for the three shared themes. Hub 2.0 is each app's own original look,
 * so it is not defined here; see `Hub20Config`.
 */
export function sharedThemeTokens(
  id: Exclude<UiThemeId, 'hub20'>,
  hostMode: ColorMode
): ThemeTokens {
  const mode = resolveMode(id, hostMode);
  if (id === 'black') return { id, mode, ...BLACK };
  if (id === 'white') return { id, mode, ...WHITE };
  return { id, mode, ...HUB30[mode] };
}

/** What an app declares about its original look so Hub 2.0 can be offered. */
export interface Hub20Config {
  /** Card title, e.g. "Q-Mail Classic". Defaults to "Hub 2.0". */
  name?: string;
  /** One line under the title, e.g. "The original Q-Mail blues". */
  description: string;
  /** Four colours shown on the theme card, darkest first. */
  swatches: [string, string, string, string];
  /** Page background painted before the app loads, per mode. */
  bootBackground: Record<ColorMode, string>;
}

export interface ThemeOptionInfo {
  id: UiThemeId;
  name: string;
  description: string;
  swatches: string[];
}

/** The four cards shown in Settings, in display order. */
export function themeOptions(hub20: Hub20Config): ThemeOptionInfo[] {
  return [
    {
      id: 'hub30',
      name: 'Hub 3.0',
      description: 'Hub surfaces and soft blue',
      swatches: ['#0E0F14', '#1D1F27', HUB_BLUE.primary, '#F6F2EA'],
    },
    {
      id: 'hub20',
      name: hub20.name ?? 'Hub 2.0',
      description: hub20.description,
      swatches: [...hub20.swatches],
    },
    {
      id: 'black',
      name: 'Black',
      description: 'Lights-out black, X blue, grey borders',
      swatches: ['#000000', '#16181c', '#2f3336', '#1d9bf0'],
    },
    {
      id: 'white',
      name: 'White',
      description: 'Clean white surfaces and black text',
      swatches: ['#ffffff', '#f6f6f6', '#111111', '#e6e6e6'],
    },
  ];
}

/**
 * CSS custom properties for a theme. HubThemeProvider sets these at runtime in
 * React apps and build-css.mjs writes them into hub-theme.css for plain-JS
 * apps, so hand-written CSS can use the same names everywhere.
 */
export function cssVariables(t: Omit<ThemeTokens, 'id' | 'mode'>): Record<string, string> {
  const { palette: p, chrome: c, shape: s } = t;
  return {
    '--qp-font': t.fontFamily,
    '--qp-primary': p.primary.main,
    '--qp-primary-dark': p.primary.dark,
    '--qp-primary-light': p.primary.light,
    '--qp-on-primary': p.primary.contrastText,
    '--qp-secondary': p.secondary,
    '--qp-success': p.success,
    '--qp-error': p.error,
    '--qp-bg': p.background.default,
    '--qp-paper': p.background.paper,
    '--qp-surface': p.background.surface,
    '--qp-elevated': p.background.elevated,
    '--qp-text': p.text.primary,
    '--qp-text-secondary': p.text.secondary,
    '--qp-divider': p.divider,
    '--qp-hover': p.action.hover,
    '--qp-selected': p.action.selected,
    '--qp-chrome': c.chrome,
    '--qp-chrome-strong': c.chromeStrong,
    '--qp-chrome-soft': c.chromeSoft,
    '--qp-chrome-muted': c.chromeMuted,
    '--qp-chrome-faint': c.chromeFaint,
    '--qp-app-gradient': c.appGradient,
    '--qp-app-glow': c.appGlow,
    '--qp-fade-edge': c.fadeEdge,
    '--qp-embed-fill': c.embedFill,
    '--qp-primary-soft': c.primarySoft,
    '--qp-radius': `${s.base}px`,
    '--qp-radius-button': `${s.button}px`,
    '--qp-radius-card': `${s.card}px`,
    '--qp-radius-dialog': `${s.dialog}px`,
    '--qp-radius-popover': `${s.popover}px`,
  };
}

/** Background to paint before React mounts, so there is no flash on load. */
export function bootBackground(id: UiThemeId, hostMode: ColorMode, hub20: Hub20Config): string {
  if (id === 'hub20') return hub20.bootBackground[hostMode];
  return sharedThemeTokens(id, hostMode).chrome.boot;
}
