import type { AppThemeConfig } from '../hub-theme';
import { darkThemeOptions, lightThemeOptions } from '../styles/theme';

/** localStorage key for the chosen look. Must match STORAGE_KEY in index.html. */
export const THEME_STORAGE_KEY = 'qtubeplus-ui-theme';

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: 'Q-Tube Classic',
    description: 'The original Q-Tube colours',
    swatches: ['#0C0C10', '#2E2E2E', '#90CAF9', '#f5f7fa'],
    bootBackground: { light: '#f5f7fa', dark: '#0C0C10' },
  },
  hub20Options: (mode) => (mode === 'dark' ? darkThemeOptions : lightThemeOptions),
};
