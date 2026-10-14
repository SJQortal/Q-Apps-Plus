/**
 * Status and accent colours as text that reads at 4.5:1 (docs/DESIGN.md) in
 * all four themes. Accents such as success, warning and Classic's teal are
 * made for icons and fills; as small text on a light surface some fall below
 * 4.5:1. These keep the hue and darken it (lighten it in dark themes) just
 * enough to read on every surface the app puts text on: page, paper,
 * surface and elevated.
 *
 *   <Typography sx={{ color: readable('success') }}>Accepted</Typography>
 *   const red = readableTone(theme, 'error');
 *
 * Icons and fills keep the plain palette colour (`success.main`).
 */
import { darken, getContrastRatio, lighten, type Theme } from '@mui/material/styles';

export type Tone = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

const AA = 4.5;
const STEPS = 20;
const cache = new WeakMap<Theme, Map<string, string>>();

function surfaces(theme: Theme): string[] {
  const b = theme.palette.background;
  return [b.paper, b.default, b.surface, b.elevated].filter((c): c is string => Boolean(c));
}

function worstContrast(colour: string, backgrounds: string[]): number {
  let worst = Infinity;
  for (const background of backgrounds) {
    try {
      worst = Math.min(worst, getContrastRatio(colour, background));
    } catch {
      // A colour MUI can't parse (a CSS variable): skip that surface.
    }
  }
  return worst === Infinity ? 0 : worst;
}

/** `colour`, or the nearest shade of it that reads at 4.5:1 on every surface. */
export function readableColor(theme: Theme, colour: string): string {
  let known = cache.get(theme);
  if (!known) {
    known = new Map();
    cache.set(theme, known);
  }
  const hit = known.get(colour);
  if (hit) return hit;
  const backgrounds = surfaces(theme);
  const shift = theme.palette.mode === 'dark' ? lighten : darken;
  let result = theme.palette.text.primary;
  for (let step = 0; step <= STEPS; step++) {
    let candidate: string;
    try {
      candidate = step === 0 ? colour : shift(colour, step / STEPS);
    } catch {
      break;
    }
    if (worstContrast(candidate, backgrounds) >= AA) {
      result = candidate;
      break;
    }
  }
  known.set(colour, result);
  return result;
}

/** The theme's `tone` colour, readable as text. */
export function readableTone(theme: Theme, tone: Tone): string {
  return readableColor(theme, theme.palette[tone].main);
}

/** For `sx`: `{ color: readable('success') }`. */
export function readable(tone: Tone): (theme: Theme) => string {
  return (theme) => readableTone(theme, tone);
}
