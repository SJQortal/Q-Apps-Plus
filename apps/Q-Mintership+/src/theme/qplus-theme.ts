import type { AppThemeConfig } from '../hub-theme';
import { CLASSIC_DARK, CLASSIC_LIGHT, classicDarkOptions, classicLightOptions } from './classic';

/** localStorage key for the chosen look. Must match STORAGE_KEY in index.html. */
export const THEME_STORAGE_KEY = 'qmintershipplus-ui-theme';

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: 'Q-Mintership Classic',
    description: 'The original teal and gold on near-black',
    swatches: [CLASSIC_DARK.bg, CLASSIC_DARK.surface2, CLASSIC_DARK.accent, CLASSIC_DARK.accent2],
    bootBackground: { light: CLASSIC_LIGHT.bg, dark: CLASSIC_DARK.bg },
  },
  hub20Options: (mode) => (mode === 'dark' ? classicDarkOptions : classicLightOptions),
};
