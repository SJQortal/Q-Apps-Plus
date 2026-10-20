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
import {
  darken,
  decomposeColor,
  getContrastRatio,
  lighten,
  type Theme,
} from '@mui/material/styles';

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

/** `colour` laid over `background` at `amount` (0–1), as an opaque rgb(). */
function over(background: string, colour: string, amount: number): string {
  try {
    const bg = decomposeColor(background).values;
    const fg = decomposeColor(colour).values;
    const mix = [0, 1, 2].map((i) => Math.round(bg[i] * (1 - amount) + fg[i] * amount));
    return `rgb(${mix.join(', ')})`;
  } catch {
    return background;
  }
}

/** `colour`, or the nearest shade of it that reads at 4.5:1 on every surface. */
export function readableColor(theme: Theme, colour: string): string {
  return readableOn(theme, colour, 0);
}

/**
 * `colour` as text on a wash of itself (`wash`, 0–1: a tinted chip), or the
 * nearest shade that reads at 4.5:1 on that wash over every surface.
 */
export function readableOn(theme: Theme, colour: string, wash: number): string {
  return readableAgainst(
    theme,
    colour,
    wash ? surfaces(theme).map((surface) => over(surface, colour, wash)) : surfaces(theme),
    wash ? `${colour}@${wash}` : colour
  );
}

/**
 * `colour` as text on a panel tinted with the text colour (`tint`, 0–1: the
 * Explorer's field blocks), or the nearest shade that reads at 4.5:1 there
 * and on every plain surface.
 */
export function readableOnTint(theme: Theme, colour: string, tint: number): string {
  const text = theme.palette.text.primary;
  return readableAgainst(
    theme,
    colour,
    [...surfaces(theme), ...surfaces(theme).map((surface) => over(surface, text, tint))],
    `${colour}~${tint}`
  );
}

function readableAgainst(theme: Theme, colour: string, backgrounds: string[], key: string): string {
  let known = cache.get(theme);
  if (!known) {
    known = new Map();
    cache.set(theme, known);
  }
  const hit = known.get(key);
  if (hit) return hit;
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
  known.set(key, result);
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
