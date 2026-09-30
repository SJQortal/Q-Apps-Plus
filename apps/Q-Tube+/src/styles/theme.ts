import type { ThemeOptions } from '@mui/material/styles';

/**
 * Q-Tube's original look. These options build the "Q-Tube Classic" (Hub 2.0)
 * theme through the theme kit (src/theme/qplus-theme.ts). Roboto is no longer
 * bundled (it cost 1.8 MB of TTF files); the OS copy is used where there is
 * one, otherwise the kit's Inter.
 */
const commonThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: ['Roboto', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif'].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 700, // changed from 600 to match Roboto weights
      lineHeight: 1.2,
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '0.5px',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.2,
      letterSpacing: '0.2px',
    },
  },
  spacing: 8,
  shape: {
    borderRadius: 4,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
};

const commonComponents: ThemeOptions['components'] = {
  MuiDialog: {
    styleOverrides: {
      paper: {
        backgroundImage: 'none',
      },
    },
  },
  MuiPopover: {
    styleOverrides: {
      paper: {
        backgroundImage: 'none',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        color: '#ffffff', // White text color for buttons
      },
    },
  },
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      body: {
        backgroundColor: theme.palette.background.default,
      },
    }),
  },
};

export const lightThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      dark: '#115293',
      light: '#63a4ff',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0288d1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#757575',
    },
    superlike: {
      main: '#B8860B', // dark goldenrod for better contrast in light mode
    },
    background: {
      default: '#f5f7fa', // soft off-white background
      paper: '#ffffff', // card/dialog base
      paper2: '#f0f2f5', // secondary surface
      unSelected: '#e0e0e0', // e.g., unselected tabs or nav
    },
    text: {
      primary: '#1a1a1a', // near-black for contrast
      secondary: '#4f4f4f', // dimmed text
      tertiary: '#9e9e9e', // labels, hints, etc
    },
    action: {
      selected: 'rgba(0, 0, 0, 0.08)',
      active: '#4a4a4a',
    },
  },
  components: commonComponents,
};

export const darkThemeOptions: ThemeOptions = {
  ...commonThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#90CAF9',
      dark: 'rgba(66, 165, 245, 1)',
      light: 'rgb(130, 185, 255)',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: '#29B6F6',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    secondary: {
      main: '#757575',
    },
    superlike: {
      main: '#FFD700', // gold color in hex format for dark mode
    },
    background: {
      default: '#0C0C10',
      paper: '#2E2E2E',
      paper2: '#101115',
      unSelected: '#333336',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgb(179, 179, 179)',
      tertiary: '#757575',
    },
    action: {
      selected: 'rgba(255, 255, 255, 0.16)',
      active: '#949496',
    },
  },
  components: commonComponents,
};
