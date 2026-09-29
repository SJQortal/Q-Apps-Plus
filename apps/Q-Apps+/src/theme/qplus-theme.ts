/**
 * Theme kit config for Q-Apps+. The launcher is new, so its "Hub 2.0" is the
 * classic Qortal Q-App template look (the theme Names, Q-Node and Q-Tube
 * shipped with), which keeps it in the family with the other + apps.
 */
import type { ThemeOptions } from '@mui/material/styles';
import type { AppThemeConfig, ColorMode } from '../hub-theme';

export { THEME_STORAGE_KEY } from '../state/settings';

const classicCommon: ThemeOptions = {
  typography: {
    fontFamily: ['Inter', '"Segoe UI"', 'system-ui', 'sans-serif'].join(','),
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.75rem', fontWeight: 500 },
    h3: { fontSize: '1.5rem', fontWeight: 500 },
    h4: { fontSize: '1.25rem', fontWeight: 500 },
    h5: { fontSize: '1rem', fontWeight: 500 },
    h6: { fontSize: '0.875rem', fontWeight: 500 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.5px' },
    body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.4, letterSpacing: '0.2px' },
  },
  spacing: 8,
  shape: { borderRadius: 4 },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiPopover: { styleOverrides: { paper: { backgroundImage: 'none' } } },
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
  },
};

const classicLight: ThemeOptions = {
  ...classicCommon,
  palette: {
    mode: 'light',
    primary: { main: 'rgb(63, 81, 181)', dark: 'rgb(45, 60, 140)', light: 'rgb(180, 200, 235)' },
    secondary: { main: 'rgba(194, 222, 236, 1)' },
    background: { default: 'rgba(250, 250, 250, 1)', paper: 'rgb(220, 220, 220)' },
    text: { primary: 'rgba(0, 0, 0, 0.87)', secondary: 'rgba(0, 0, 0, 0.6)' },
  },
};

const classicDark: ThemeOptions = {
  ...classicCommon,
  palette: {
    mode: 'dark',
    primary: { main: 'rgb(100, 155, 240)', dark: 'rgb(45, 92, 201)', light: 'rgb(130, 185, 255)' },
    secondary: { main: 'rgb(69, 173, 255)' },
    background: { default: 'rgb(49, 51, 56)', paper: 'rgb(62, 64, 68)' },
    text: { primary: 'rgb(255, 255, 255)', secondary: 'rgb(179, 179, 179)' },
  },
};

export const themeConfig: AppThemeConfig = {
  hub20: {
    name: 'Qortal Classic',
    description: 'The classic Q-App greys and indigo',
    swatches: ['#313338', '#3e4044', '#649bf0', '#fafafa'],
    // Keep these in step with HUB20 in index.html.
    bootBackground: { light: '#fafafa', dark: '#313338' },
  },
  hub20Options: (mode: ColorMode) => (mode === 'dark' ? classicDark : classicLight),
};
