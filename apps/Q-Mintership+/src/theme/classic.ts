/**
 * "Q-Mintership Classic" (Hub 2.0): the palette of the original app, lifted
 * from legacy/assets/css/forum-styles.css (`:root { --qm-* }`). The original
 * is dark only; the light variant keeps its teal and gold accents on pale
 * surfaces so the theme still follows Hub's light mode.
 */
import type { ThemeOptions } from '@mui/material/styles';

export const CLASSIC_DARK = {
  bg: '#07090b',
  surface: '#101519',
  surface2: '#151d22',
  surface3: '#1b252b',
  border: 'rgba(157, 193, 196, 0.22)',
  borderStrong: 'rgba(165, 218, 219, 0.42)',
  text: '#edf7f7',
  muted: '#a9bdc0',
  accent: '#73d0c3',
  accent2: '#f1bd6a',
  success: '#48b77a',
  danger: '#d76565',
} as const;

export const CLASSIC_LIGHT = {
  bg: '#eef4f4',
  surface: '#ffffff',
  surface2: '#f4f8f8',
  surface3: '#e6eeee',
  border: 'rgba(20, 60, 60, 0.18)',
  borderStrong: 'rgba(20, 60, 60, 0.36)',
  text: '#10201f',
  muted: '#4f6667',
  accent: '#1f8f82',
  accent2: '#b07a1c',
  success: '#2f8f5b',
  danger: '#b94848',
} as const;

const FONT_STACK = ['"DM Sans"', '"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'].join(',');

function classicOptions(p: typeof CLASSIC_DARK | typeof CLASSIC_LIGHT, mode: 'light' | 'dark'): ThemeOptions {
  return {
    palette: {
      mode,
      primary: {
        main: p.accent,
        contrastText: mode === 'dark' ? '#06120f' : '#ffffff',
      },
      secondary: { main: p.accent2 },
      success: { main: p.success },
      error: { main: p.danger },
      background: {
        default: p.bg,
        paper: p.surface,
        surface: p.surface2,
        elevated: p.surface3,
      },
      text: { primary: p.text, secondary: p.muted },
      divider: p.border,
      action: {
        hover: mode === 'dark' ? 'rgba(157, 193, 196, 0.08)' : 'rgba(20, 60, 60, 0.06)',
        selected: mode === 'dark' ? 'rgba(115, 208, 195, 0.16)' : 'rgba(31, 143, 130, 0.14)',
      },
    },
    shape: { borderRadius: 12 },
    typography: { fontFamily: FONT_STACK },
  };
}

export const classicDarkOptions: ThemeOptions = classicOptions(CLASSIC_DARK, 'dark');
export const classicLightOptions: ThemeOptions = classicOptions(CLASSIC_LIGHT, 'light');
