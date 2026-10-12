/**
 * Accent text that stays readable in all four themes: the first colour that
 * reaches 4.5:1 against the card it sits on, else the plain text colour.
 * (Some theme accents, e.g. Classic light's teal, are made for fills rather
 * than small text.)
 */
import { getContrastRatio, type Theme } from '@mui/material/styles';

const AA = 4.5;

function readable(theme: Theme, candidates: string[]): string {
  const background = theme.palette.background.paper;
  for (const colour of candidates) {
    try {
      if (getContrastRatio(colour, background) >= AA) return colour;
    } catch {
      // A colour MUI can't parse (a CSS variable): try the next one.
    }
  }
  return theme.palette.text.primary;
}

/** The primary accent for small text (eyebrows, links in running text). */
export function readablePrimary(theme: Theme): string {
  return readable(theme, [theme.palette.primary.main, theme.palette.primary.dark]);
}

/** The success colour for small text ("You've accepted ✓"). */
export function readableSuccess(theme: Theme): string {
  return readable(theme, [theme.palette.success.main, theme.palette.success.dark]);
}
