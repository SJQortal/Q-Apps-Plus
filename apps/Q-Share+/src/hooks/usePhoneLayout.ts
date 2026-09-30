import { useMediaQuery } from "@mui/material";

/**
 * The phone layout applies below 600 px (phones in portrait and narrow Hub
 * panes) and on any touch screen shorter than 500 px (phones in landscape),
 * so a rotated phone keeps the bottom bar, sheets and 44 px targets.
 * Styled components use the same query via `@media ${PHONE_MEDIA}`.
 */
export const PHONE_MEDIA = "(max-width:599.95px), ((pointer: coarse) and (max-height: 500px))";

export function usePhoneLayout(): boolean {
  return useMediaQuery(`@media ${PHONE_MEDIA}`);
}

/** True below 900 px: the desktop rails collapse. */
export function useNarrowLayout(): boolean {
  return useMediaQuery("(max-width:899.95px)");
}
