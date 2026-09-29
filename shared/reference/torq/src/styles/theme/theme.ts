import { alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import type { TorqThemeTokens, TorqUiThemeId } from './theme.d';

export const UI_THEME_QUITTER = 'quitter' as const;
export const UI_THEME_HUB = 'hub30' as const;
export const UI_THEME_X = 'x' as const;
export const UI_THEME_WHITE = 'white' as const;

export const HUB_BLUE = {
  primary: '#84AFF0',
  hover: '#6FA3F0',
  pressed: '#5A8FE0',
  contrast: 'rgba(10, 18, 30, 0.92)',
  gradientTop: '#8FB8F3',
  gradientMid: '#79AAF0',
  gradientBottom: '#6FA3F0',
} as const;

const quitterTypography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    '"Helvetica Neue"',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: { fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
  h2: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.01em' },
  h3: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.01em' },
  h4: { fontSize: '1.5rem', fontWeight: 600 },
  h5: { fontSize: '1.25rem', fontWeight: 600 },
  h6: { fontSize: '1rem', fontWeight: 600 },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
};

const hubTypography = {
  fontFamily: ['Inter', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'].join(
    ','
  ),
  h1: { fontSize: '2rem', fontWeight: 600 },
  h2: { fontSize: '1.75rem', fontWeight: 500 },
  h3: { fontSize: '1.5rem', fontWeight: 500 },
  h4: { fontSize: '1.25rem', fontWeight: 500 },
  h5: { fontSize: '1rem', fontWeight: 500 },
  h6: { fontSize: '0.875rem', fontWeight: 600 },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 'normal',
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: '0.2px',
  },
};

function quitterTokens(mode: 'light' | 'dark'): TorqThemeTokens {
  if (mode === 'light') {
    return {
      id: UI_THEME_QUITTER,
      chrome: 'rgba(255, 255, 255, 0.85)',
      chromeStrong: 'rgba(255, 255, 255, 0.95)',
      chromeSoft: 'rgba(255, 255, 255, 0.5)',
      chromeMuted: 'rgba(255, 255, 255, 0.6)',
      chromeFaint: 'rgba(255, 255, 255, 0.4)',
      appGradient: 'linear-gradient(135deg, #f7f9fc 0%, #e9f2f9 100%)',
      appGlow:
        'radial-gradient(circle at 20% 50%, rgba(29, 155, 240, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(120, 86, 255, 0.03) 0%, transparent 50%)',
      fadeEdge: 'linear-gradient(to left, rgba(255, 255, 255, 0.95), transparent)',
      embedFill: 'none',
      primarySoft: 'rgba(29, 155, 240, 0.1)',
    };
  }
  return {
    id: UI_THEME_QUITTER,
    chrome: 'rgba(21, 32, 43, 0.85)',
    chromeStrong: 'rgba(21, 32, 43, 0.95)',
    chromeSoft: 'rgba(21, 32, 43, 0.5)',
    chromeMuted: 'rgba(21, 32, 43, 0.6)',
    chromeFaint: 'rgba(21, 32, 43, 0.4)',
    appGradient: 'linear-gradient(135deg, #15202b 0%, #192734 100%)',
    appGlow:
      'radial-gradient(circle at 20% 50%, rgba(29, 155, 240, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(120, 86, 255, 0.05) 0%, transparent 50%)',
    fadeEdge: 'linear-gradient(to left, rgba(21, 32, 43, 0.95), transparent)',
    embedFill: 'linear-gradient(180deg, rgba(17,20,25,0.76) 0%, rgba(13,16,20,0.76) 100%)',
    primarySoft: 'rgba(29, 155, 240, 0.15)',
  };
}

function hubTokens(mode: 'light' | 'dark'): TorqThemeTokens {
  if (mode === 'light') {
    return {
      id: UI_THEME_HUB,
      chrome: 'rgba(246, 242, 234, 0.88)',
      chromeStrong: 'rgba(246, 242, 234, 0.96)',
      chromeSoft: 'rgba(238, 231, 220, 0.62)',
      chromeMuted: 'rgba(238, 231, 220, 0.72)',
      chromeFaint: 'rgba(221, 214, 202, 0.45)',
      appGradient: 'linear-gradient(180deg, #EEE7DC 0%, #DDD6CA 100%)',
      appGlow:
        'radial-gradient(circle at 20% 20%, rgba(132, 175, 240, 0.12) 0%, transparent 46%), radial-gradient(circle at 80% 80%, rgba(132, 175, 240, 0.08) 0%, transparent 50%)',
      fadeEdge: 'linear-gradient(to left, rgba(246, 242, 234, 0.96), transparent)',
      embedFill: 'linear-gradient(180deg, rgba(246, 242, 234, 0.92) 0%, rgba(238, 231, 220, 0.92) 100%)',
      primarySoft: 'rgba(132, 175, 240, 0.16)',
    };
  }
  return {
    id: UI_THEME_HUB,
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
  };
}

function quitterShadows(mode: 'light' | 'dark') {
  return (
    mode === 'light'
      ? [
          'none',
          '0px 1px 3px rgba(0, 0, 0, 0.04)',
          '0px 2px 8px rgba(0, 0, 0, 0.06)',
          '0px 4px 12px rgba(0, 0, 0, 0.08)',
          '0px 8px 24px rgba(0, 0, 0, 0.10)',
          '0px 12px 32px rgba(0, 0, 0, 0.12)',
          '0px 16px 40px rgba(0, 0, 0, 0.14)',
          '0px 20px 48px rgba(0, 0, 0, 0.16)',
          '0px 24px 56px rgba(0, 0, 0, 0.18)',
          '0px 28px 64px rgba(0, 0, 0, 0.20)',
          ...Array(15).fill('none'),
        ]
      : [
          'none',
          '0px 1px 3px rgba(0, 0, 0, 0.3)',
          '0px 2px 8px rgba(0, 0, 0, 0.35)',
          '0px 4px 12px rgba(0, 0, 0, 0.40)',
          '0px 8px 24px rgba(0, 0, 0, 0.45)',
          '0px 12px 32px rgba(0, 0, 0, 0.50)',
          '0px 16px 40px rgba(0, 0, 0, 0.55)',
          '0px 20px 48px rgba(0, 0, 0, 0.60)',
          '0px 24px 56px rgba(0, 0, 0, 0.65)',
          '0px 28px 64px rgba(0, 0, 0, 0.70)',
          ...Array(15).fill('none'),
        ]
  ) as Theme['shadows'];
}

function createQuitterTheme(mode: 'light' | 'dark') {
  const tokens = quitterTokens(mode);
  return createTheme({
    typography: quitterTypography,
    spacing: 8,
    shape: { borderRadius: 16 },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
    torq: tokens,
    palette:
      mode === 'light'
        ? {
            mode,
            primary: { main: '#1d9bf0', dark: '#1a8cd8', light: '#4db8ff' },
            secondary: { main: '#7856ff', dark: '#5e3fd9', light: '#9d82ff' },
            success: { main: '#00ba7c' },
            error: { main: '#f91880' },
            background: { default: '#f7f9fc', paper: '#ffffff' },
            text: { primary: '#0f1419', secondary: '#536471' },
            divider: 'rgba(0, 0, 0, 0.08)',
          }
        : {
            mode,
            primary: { main: '#1d9bf0', dark: '#1a8cd8', light: '#4db8ff' },
            secondary: { main: '#7856ff', dark: '#5e3fd9', light: '#9d82ff' },
            success: { main: '#00ba7c' },
            error: { main: '#f91880' },
            background: { default: '#15202b', paper: '#192734' },
            text: { primary: '#e7e9ea', secondary: '#8b98a5' },
            divider: 'rgba(255, 255, 255, 0.08)',
          },
    shadows: quitterShadows(mode),
    components: {
      MuiDialog: {
        styleOverrides: { paper: { backgroundImage: 'none', borderRadius: 20 } },
      },
      MuiPopover: {
        styleOverrides: { paper: { backgroundImage: 'none', borderRadius: 12 } },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 24,
            textTransform: 'none',
            fontWeight: 600,
            padding: '10px 24px',
            transition: 'all 0.3s ease',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: { root: { transition: 'all 0.2s ease' } },
      },
    },
  });
}

function createHubTheme(mode: 'light' | 'dark') {
  const tokens = hubTokens(mode);
  const options: ThemeOptions = {
    typography: hubTypography,
    spacing: 8,
    shape: { borderRadius: 8 },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
    torq: tokens,
    palette:
      mode === 'light'
        ? {
            mode,
            primary: {
              main: HUB_BLUE.primary,
              dark: HUB_BLUE.pressed,
              light: HUB_BLUE.gradientTop,
              contrastText: HUB_BLUE.contrast,
            },
            secondary: { main: HUB_BLUE.hover },
            success: { main: 'rgb(94, 176, 73)' },
            error: { main: 'rgb(177, 70, 70)' },
            background: {
              default: '#DDD6CA',
              paper: '#F6F2EA',
              surface: '#EEE7DC',
              elevated: '#E2D9CB',
            },
            text: {
              primary: 'rgba(21, 26, 35, 0.94)',
              secondary: 'rgba(88, 96, 110, 0.86)',
            },
            divider: 'rgba(28, 36, 52, 0.12)',
            action: {
              hover: 'rgba(28, 36, 52, 0.06)',
              selected: 'rgba(41, 121, 218, 0.12)',
            },
          }
        : {
            mode,
            primary: {
              main: HUB_BLUE.primary,
              dark: HUB_BLUE.pressed,
              light: HUB_BLUE.gradientTop,
              contrastText: HUB_BLUE.contrast,
            },
            secondary: { main: HUB_BLUE.hover },
            success: { main: 'rgb(94, 176, 73)' },
            error: { main: 'rgb(177, 70, 70)' },
            background: {
              default: '#0E0F14',
              paper: '#1D1F27',
              surface: '#1B1D24',
              elevated: '#23262F',
            },
            text: {
              primary: 'rgb(244, 247, 251)',
              secondary: '#989BA7',
            },
            divider: '#23262F',
            action: {
              hover: '#23262F',
              selected: '#262931',
            },
          },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundImage: tokens.appGradient,
            backgroundRepeat: 'no-repeat',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 12,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 10,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 650,
            padding: '8px 16px',
            transition:
              'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 180ms ease',
          },
          containedPrimary: {
            background: `linear-gradient(180deg, ${HUB_BLUE.gradientTop} 0%, ${HUB_BLUE.gradientMid} 42%, ${HUB_BLUE.gradientBottom} 100%)`,
            border: '1px solid rgba(143, 184, 243, 0.22)',
            boxShadow:
              '0 6px 18px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 0 18px rgba(132, 175, 240, 0.18)',
            color: HUB_BLUE.contrast,
            '&:hover': {
              background: `linear-gradient(180deg, #98BFF6 0%, #83B1F3 42%, #76A7F1 100%)`,
              boxShadow:
                '0 8px 22px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 0 22px rgba(132, 175, 240, 0.22)',
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { transition: 'all 0.2s ease' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(15, 23, 42, 0.1)',
            boxShadow:
              mode === 'dark'
                ? '0 8px 18px rgba(0, 0, 0, 0.12)'
                : '0 12px 28px rgba(44, 38, 28, 0.07)',
          },
        },
      },
    },
  };
  return createTheme(options);
}

const xTypography = {
  fontFamily: [
    '-apple-system',
    'BlinkMacSystemFont',
    '"Segoe UI"',
    'Roboto',
    'Helvetica',
    'Arial',
    'sans-serif',
  ].join(','),
  h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' },
  h3: { fontSize: '1.25rem', fontWeight: 700 },
  h4: { fontSize: '1.125rem', fontWeight: 700 },
  h5: { fontSize: '1rem', fontWeight: 700 },
  h6: { fontSize: '0.95rem', fontWeight: 700 },
  body1: { fontSize: '1.0625rem', fontWeight: 400, lineHeight: 1.35 },
  body2: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.35 },
};

function xTokens(mode: 'light' | 'dark'): TorqThemeTokens {
  if (mode === 'light') {
    return {
      id: UI_THEME_X,
      chrome: 'rgba(255, 255, 255, 0.92)',
      chromeStrong: 'rgba(255, 255, 255, 0.98)',
      chromeSoft: 'rgba(255, 255, 255, 0.72)',
      chromeMuted: 'rgba(255, 255, 255, 0.84)',
      chromeFaint: 'rgba(255, 255, 255, 0.6)',
      appGradient: '#ffffff',
      appGlow: 'none',
      fadeEdge: 'linear-gradient(to left, rgba(255, 255, 255, 0.98), transparent)',
      embedFill: '#f7f9f9',
      primarySoft: 'rgba(29, 155, 240, 0.1)',
    };
  }
  return {
    id: UI_THEME_X,
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
  };
}

function createXTheme(mode: 'light' | 'dark') {
  const tokens = xTokens(mode);
  const dark = mode === 'dark';
  return createTheme({
    typography: xTypography,
    spacing: 8,
    shape: { borderRadius: 16 },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
    torq: tokens,
    palette: dark
      ? {
          mode,
          primary: { main: '#1d9bf0', dark: '#1a8cd8', light: '#8ecdf8', contrastText: '#ffffff' },
          secondary: { main: '#e7e9ea' },
          success: { main: '#00ba7c' },
          error: { main: '#f91880' },
          background: {
            default: '#000000',
            paper: '#000000',
            surface: '#000000',
            elevated: '#16181c',
          },
          text: { primary: '#e7e9ea', secondary: '#71767b' },
          divider: '#2f3336',
          action: {
            hover: 'rgba(231, 233, 234, 0.1)',
            selected: 'rgba(29, 155, 240, 0.12)',
          },
        }
      : {
          mode,
          primary: { main: '#1d9bf0', dark: '#1a8cd8', light: '#8ecdf8', contrastText: '#ffffff' },
          secondary: { main: '#0f1419' },
          success: { main: '#00ba7c' },
          error: { main: '#f91880' },
          background: {
            default: '#ffffff',
            paper: '#ffffff',
            surface: '#ffffff',
            elevated: '#f7f9f9',
          },
          text: { primary: '#0f1419', secondary: '#536471' },
          divider: '#eff3f4',
          action: {
            hover: 'rgba(15, 20, 25, 0.1)',
            selected: 'rgba(29, 155, 240, 0.1)',
          },
        },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: dark ? '#000000' : '#ffffff' },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: dark ? '#000000' : '#ffffff',
            border: `1px solid ${dark ? '#2f3336' : '#eff3f4'}`,
            borderRadius: 16,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: dark ? '#000000' : '#ffffff',
            border: `1px solid ${dark ? '#2f3336' : '#eff3f4'}`,
            borderRadius: 12,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 700,
            padding: '8px 16px',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none',
            backgroundColor: dark ? '#16181c' : '#f7f9f9',
            border: `1px solid ${dark ? '#2f3336' : '#eff3f4'}`,
            boxShadow: 'none',
          },
        },
      },
    },
  });
}

function createWhiteTheme() {
  const tokens: TorqThemeTokens = {
    id: UI_THEME_WHITE,
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
  };
  return createTheme({
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: { fontSize: '2rem', fontWeight: 650 },
      h2: { fontSize: '1.5rem', fontWeight: 650 },
      h6: { fontSize: '1rem', fontWeight: 650 },
      body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
      body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.45 },
    },
    spacing: 8,
    shape: { borderRadius: 12 },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
    torq: tokens,
    palette: {
      mode: 'light',
      primary: { main: '#111111', dark: '#000000', light: '#3a3a3a', contrastText: '#ffffff' },
      secondary: { main: '#5f6b76' },
      success: { main: '#067d52' },
      error: { main: '#d01268' },
      background: {
        default: '#ffffff',
        paper: '#ffffff',
        surface: '#ffffff',
        elevated: '#f6f6f6',
      },
      text: { primary: '#111111', secondary: '#5f6b76' },
      divider: '#e6e6e6',
      action: {
        hover: 'rgba(17, 17, 17, 0.05)',
        selected: 'rgba(17, 17, 17, 0.08)',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: { body: { backgroundColor: '#ffffff' } },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: '#ffffff',
            border: '1px solid #e6e6e6',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: 'none',
            fontWeight: 650,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundColor: '#ffffff',
            border: '1px solid #e6e6e6',
            boxShadow: 'none',
          },
        },
      },
    },
  });
}

export function resolveTorqTheme(
  mode: 'light' | 'dark',
  uiTheme: TorqUiThemeId = UI_THEME_HUB
) {
  if (uiTheme === UI_THEME_WHITE) return createWhiteTheme();
  if (uiTheme === UI_THEME_X) return createXTheme(mode);
  if (uiTheme === UI_THEME_HUB) return createHubTheme(mode);
  return createQuitterTheme(mode);
}

export function isUiThemeId(value: unknown): value is TorqUiThemeId {
  return (
    value === UI_THEME_QUITTER ||
    value === UI_THEME_HUB ||
    value === UI_THEME_X ||
    value === UI_THEME_WHITE
  );
}

export function headerFill(
  theme: Theme,
  strength: keyof Pick<
    TorqThemeTokens,
    'chrome' | 'chromeStrong' | 'chromeSoft' | 'chromeMuted' | 'chromeFaint'
  > = 'chrome'
) {
  return theme.torq?.[strength] || quitterTokens(theme.palette.mode)[strength];
}

export function appSurface(theme: Theme) {
  return theme.torq?.appGradient || quitterTokens(theme.palette.mode).appGradient;
}

export function appGlow(theme: Theme) {
  return theme.torq?.appGlow || quitterTokens(theme.palette.mode).appGlow;
}

export function fadeEdge(theme: Theme) {
  return theme.torq?.fadeEdge || quitterTokens(theme.palette.mode).fadeEdge;
}

export function embedFill(theme: Theme) {
  const fill =
    theme.torq?.embedFill || quitterTokens(theme.palette.mode).embedFill;
  // Embeds paint this as background-image, where a plain colour is dropped.
  return /gradient\(|^none$|^url\(/.test(fill)
    ? fill
    : `linear-gradient(${fill}, ${fill})`;
}

export function primarySoft(theme: Theme) {
  return (
    theme.torq?.primarySoft ||
    alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.1)
  );
}

export function accentWash(theme: Theme, amount = 0.12) {
  return alpha(theme.palette.primary.main, amount);
}

export const lightTheme = createQuitterTheme('light');
export const darkTheme = createQuitterTheme('dark');
