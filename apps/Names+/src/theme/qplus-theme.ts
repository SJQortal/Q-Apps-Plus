import type { AppThemeConfig } from '../hub-theme';
import { darkThemeOptions, lightThemeOptions } from '../styles/theme/theme';

/** localStorage key for the chosen look. Must match STORAGE_KEY in index.html. */
export const THEME_STORAGE_KEY = 'namesplus-ui-theme';

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: 'Names Classic',
    description: 'The original Names colours',
    swatches: ['#313338', '#3e4044', '#649bf0', '#fafafa'],
    bootBackground: { light: '#fafafa', dark: '#313338' },
  },
  hub20Options: (mode) => (mode === 'dark' ? darkThemeOptions : lightThemeOptions),
};
