/**
 * The Explorer's field blocks: each fact or field (a label and its value)
 * on a soft panel of its own inside its card, so neighbouring fields read
 * apart at a glance. The tint comes from the theme's text colour, so it
 * follows all four themes in light and dark; the corners are the theme's.
 */
import { alpha, type Theme } from '@mui/material/styles';

/** The panel's fill: a light wash of the text colour (stronger in dark, where it shows less). */
export function fieldBlockFill(theme: Theme): string {
  return alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.06 : 0.045);
}

/** One field's panel. */
export const FIELD_BLOCK_SX = {
  bgcolor: fieldBlockFill,
  borderRadius: 1,
  px: 1.5,
  py: 1.25,
  minWidth: 0,
} as const;
