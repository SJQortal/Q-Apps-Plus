/**
 * Green for small "done" text ("Accepted", "You support this"). The kit's
 * success colour is made for icons and fills; on the light papers (Hub 3.0
 * and Classic in Hub's light mode) it falls under 4.5:1 as text, so light
 * modes use the palette's darker shade.
 */
import type { Theme } from '@mui/material/styles';

export function successText(theme: Theme): string {
  return theme.palette.mode === 'light' ? theme.palette.success.dark : theme.palette.success.main;
}
