/**
 * Q-Mail+ theme configuration for the shared Hub theme kit (src/hub-theme).
 *
 * Hub 2.0 is "Q-Mail Classic": the palette, type and shape of the original
 * Q-Mail 3.x theme (src/styles/theme.ts) plus its --qmail-* CSS variables in
 * index.css, which only apply while <html data-ui-theme="hub20">.
 */
import type { AppThemeConfig } from '../hub-theme';
import { darkThemeOptions, lightThemeOptions } from '../styles/theme';

/** localStorage key; must match STORAGE_KEY in the index.html boot snippet. */
export const THEME_STORAGE_KEY = 'qmailplus-ui-theme';

/** Page backgrounds of the original theme, painted before React mounts. */
export const CLASSIC_BOOT_BACKGROUND = { light: '#e7f0ff', dark: '#0b1220' } as const;

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: 'Q-Mail Classic',
    description: 'The original Q-Mail blues',
    swatches: ['#0b1220', '#131f35', '#39afff', '#e7f0ff'],
    bootBackground: { ...CLASSIC_BOOT_BACKGROUND },
  },
  hub20Options: (mode) => (mode === 'dark' ? darkThemeOptions : lightThemeOptions),
};
