/**
 * MUI themes for the four Q-Apps+ looks. Targets MUI 9; also works on MUI 5 and 7.
 * Ported from Torq's src/styles/theme/theme.ts.
 */
import { alpha, createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import {
  HUB_BLUE,
  sharedThemeTokens,
  type ChromeTokens,
  type ColorMode,
  type Hub20Config,
  type ThemeTokens,
  type UiThemeId,
} from './tokens';

export interface AppThemeConfig {
  hub20: Hub20Config;
  /** The app's original MUI theme options, used as its Hub 2.0 theme. */
  hub20Options: (mode: ColorMode) => ThemeOptions;
}

const BREAKPOINTS = { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } };

const TYPOGRAPHY: Record<Exclude<UiThemeId, 'hub20'>, ThemeOptions['typography']> = {
  hub30: {
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.75rem', fontWeight: 500 },
    h3: { fontSize: '1.5rem', fontWeight: 500 },
    h4: { fontSize: '1.25rem', fontWeight: 500 },
    h5: { fontSize: '1rem', fontWeight: 500 },
    h6: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5, letterSpacing: 'normal' },
    body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.45, letterSpacing: '0.2px' },
  },
  black: {
    h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.25rem', fontWeight: 700 },
    h4: { fontSize: '1.125rem', fontWeight: 700 },
    h5: { fontSize: '1rem', fontWeight: 700 },
    h6: { fontSize: '0.95rem', fontWeight: 700 },
    body1: { fontSize: '1.0625rem', fontWeight: 400, lineHeight: 1.35 },
    body2: { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.35 },
  },
  white: {
    h1: { fontSize: '2rem', fontWeight: 650 },
    h2: { fontSize: '1.5rem', fontWeight: 650 },
    h6: { fontSize: '1rem', fontWeight: 650 },
    body1: { fontSize: '1rem', fontWeight: 400, lineHeight: 1.5 },
    body2: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.45 },
  },
};

function paletteOptions(t: ThemeTokens): ThemeOptions['palette'] {
  const p = t.palette;
  return {
    mode: t.mode,
    // Fills take black or white text only when it reads at 4.5:1 (DESIGN.md);
    // explicit contrastText values in the tokens still win.
    contrastThreshold: 4.5,
    primary: p.primary,
    secondary: { main: p.secondary },
    success: { main: p.success },
    error: { main: p.error },
    background: p.background,
    text: p.text,
    divider: p.divider,
    action: p.action,
  };
}

function componentOverrides(t: ThemeTokens): ThemeOptions['components'] {
  const dark = t.mode === 'dark';
  const { palette: p, shape: s, chrome: c } = t;

  if (t.id === 'hub30') {
    return {
      MuiCssBaseline: {
        styleOverrides: { body: { backgroundImage: c.appGradient, backgroundRepeat: 'no-repeat' } },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiDialog: {
        styleOverrides: { paper: { backgroundImage: 'none', borderRadius: s.dialog } },
      },
      MuiPopover: {
        styleOverrides: { paper: { backgroundImage: 'none', borderRadius: s.popover } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          // A callback on ownerState works on MUI 5, 7 and 9; the old
          // containedPrimary key was removed in MUI 9.
          root: ({ ownerState }) => ({
            borderRadius: s.button,
            textTransform: 'none',
            fontWeight: 650,
            padding: '8px 16px',
            transition:
              'background 180ms ease, box-shadow 180ms ease, border-color 180ms ease, color 180ms ease',
            ...(ownerState.variant === 'contained' && (ownerState.color ?? 'primary') === 'primary'
              ? {
                  background: `linear-gradient(180deg, ${HUB_BLUE.gradientTop} 0%, ${HUB_BLUE.gradientMid} 42%, ${HUB_BLUE.gradientBottom} 100%)`,
                  border: '1px solid rgba(143, 184, 243, 0.22)',
                  boxShadow:
                    '0 6px 18px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 0 18px rgba(132, 175, 240, 0.18)',
                  color: HUB_BLUE.contrast,
                  '&:hover': {
                    background: 'linear-gradient(180deg, #98BFF6 0%, #83B1F3 42%, #76A7F1 100%)',
                    boxShadow:
                      '0 8px 22px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(255, 255, 255, 0.04) inset, 0 0 22px rgba(132, 175, 240, 0.22)',
                  },
                }
              : {}),
          }),
        },
      },
      MuiIconButton: { styleOverrides: { root: { transition: 'all 0.2s ease' } } },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: s.card,
            border: dark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(15, 23, 42, 0.1)',
            boxShadow: dark ? '0 8px 18px rgba(0, 0, 0, 0.12)' : '0 12px 28px rgba(44, 38, 28, 0.07)',
          },
        },
      },
    };
  }

  // Black and White share a flat, bordered, pill-button look.
  const surface = p.background.paper;
  const border = `1px solid ${p.divider}`;
  return {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: p.background.default } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
          backgroundColor: surface,
          border,
          borderRadius: s.dialog,
          ...(t.id === 'white' ? { boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)' } : {}),
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { backgroundImage: 'none', backgroundColor: surface, border, borderRadius: s.popover },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: s.button,
          textTransform: 'none',
          fontWeight: t.id === 'black' ? 700 : 650,
          padding: '8px 16px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: s.card,
          backgroundImage: 'none',
          backgroundColor: t.id === 'black' ? p.background.elevated : surface,
          border,
          boxShadow: 'none',
        },
      },
    },
  };
}

function sharedTheme(id: Exclude<UiThemeId, 'hub20'>, hostMode: ColorMode): Theme {
  const t = sharedThemeTokens(id, hostMode);
  return createTheme({
    typography: { fontFamily: t.fontFamily, ...TYPOGRAPHY[id] },
    spacing: 8,
    shape: { borderRadius: t.shape.base },
    breakpoints: BREAKPOINTS,
    palette: paletteOptions(t),
    components: componentOverrides(t),
    qplus: { id: t.id, ...t.chrome },
  });
}

/** Chrome tokens for Hub 2.0, derived from the app's own palette. */
function deriveChrome(theme: Theme, hub20: Hub20Config, mode: ColorMode): ChromeTokens {
  const bg = theme.palette.background.default;
  const paper = theme.palette.background.paper;
  return {
    chrome: alpha(bg, 0.88),
    chromeStrong: alpha(bg, 0.96),
    chromeSoft: alpha(bg, 0.52),
    chromeMuted: alpha(paper, 0.72),
    chromeFaint: alpha(paper, 0.42),
    appGradient: bg,
    appGlow: 'none',
    fadeEdge: `linear-gradient(to left, ${alpha(bg, 0.96)}, transparent)`,
    embedFill: paper,
    primarySoft: alpha(theme.palette.primary.main, mode === 'dark' ? 0.15 : 0.1),
    boot: hub20.bootBackground[mode],
  };
}

function hub20Theme(hostMode: ColorMode, config: AppThemeConfig): Theme {
  const options = config.hub20Options(hostMode);
  const base = createTheme(options);
  return createTheme(options, { qplus: { id: 'hub20', ...deriveChrome(base, config.hub20, hostMode) } });
}

/** Build the MUI theme for a Q-Apps+ look. `hostMode` is the light/dark mode Hub passed in. */
export function createAppTheme(id: UiThemeId, hostMode: ColorMode, config: AppThemeConfig): Theme {
  if (id === 'hub20') return hub20Theme(hostMode, config);
  return sharedTheme(id, hostMode);
}

/** Read any built theme (including an app's Hub 2.0) back into tokens, for cssVariables(). */
export function tokensFromTheme(theme: Theme): Omit<ThemeTokens, 'id' | 'mode'> {
  const p = theme.palette;
  const { id, ...chrome } = theme.qplus;
  const radius = typeof theme.shape.borderRadius === 'number' ? theme.shape.borderRadius : 8;
  const shared = id === 'hub20' ? null : sharedThemeTokens(id, p.mode);
  return {
    fontFamily: String(theme.typography.fontFamily),
    palette: {
      primary: {
        main: p.primary.main,
        dark: p.primary.dark,
        light: p.primary.light,
        contrastText: p.primary.contrastText,
      },
      secondary: p.secondary.main,
      success: p.success.main,
      error: p.error.main,
      background: {
        default: p.background.default,
        paper: p.background.paper,
        surface: p.background.surface ?? p.background.paper,
        elevated: p.background.elevated ?? p.background.paper,
      },
      text: { primary: p.text.primary, secondary: p.text.secondary },
      divider: p.divider,
      action: { hover: p.action.hover, selected: p.action.selected },
    },
    chrome,
    shape: shared?.shape ?? {
      base: radius,
      button: radius,
      card: radius,
      dialog: radius * 1.5,
      popover: radius,
    },
  };
}

/* Helpers for surfaces MUI's palette has no slot for (headers, rails, embeds). */

type ChromeStrength = 'chrome' | 'chromeStrong' | 'chromeSoft' | 'chromeMuted' | 'chromeFaint';

export function headerFill(theme: Theme, strength: ChromeStrength = 'chrome'): string {
  return theme.qplus[strength];
}

export function appSurface(theme: Theme): string {
  return theme.qplus.appGradient;
}

export function appGlow(theme: Theme): string {
  return theme.qplus.appGlow;
}

export function fadeEdge(theme: Theme): string {
  return theme.qplus.fadeEdge;
}

export function embedFill(theme: Theme): string {
  const fill = theme.qplus.embedFill;
  // Embeds paint this as background-image, where a plain colour is dropped.
  return /gradient\(|^none$|^url\(/.test(fill) ? fill : `linear-gradient(${fill}, ${fill})`;
}

export function primarySoft(theme: Theme): string {
  return theme.qplus.primarySoft;
}

export function accentWash(theme: Theme, amount = 0.12): string {
  return alpha(theme.palette.primary.main, amount);
}
