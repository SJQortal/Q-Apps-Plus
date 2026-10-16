/**
 * Each compared account's letter (A–D) and colour. The colours are the
 * theme's info blue turned to four hues (keeping its saturation and
 * lightness, as Decisions' section accents do), so they sit in all four
 * themes. Colour is never the only mark: the letter always shows, and the
 * name beside it. The letter itself is in the theme's text colour on a light
 * tint of its colour, so it reads in every theme.
 */
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Letter } from '../../../rules/explorer/compare';

export function LetterBadge({
  letter,
  accent,
  size = 28,
}: {
  letter: Letter;
  accent: string;
  size?: number;
}) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${accent}`,
        bgcolor: alpha(accent, theme.palette.mode === 'dark' ? 0.24 : 0.16),
        color: 'text.primary',
        fontWeight: 800,
        fontSize: size >= 28 ? 15 : 14,
        lineHeight: 1,
        verticalAlign: 'middle',
      })}
    >
      {letter}
    </Box>
  );
}
