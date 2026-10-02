import { useMediaQuery } from "@mui/material";

/**
 * Phones in landscape: touch screens shorter than 500 px. In Hub at 844×390
 * the app frame is only 266 px tall, so the bottom bar goes compact there.
 */
export const LANDSCAPE_PHONE_MEDIA = "(pointer: coarse) and (max-height: 500px)";

/**
 * The phone layout applies below 600 px (phones in portrait and narrow Hub
 * panes) and on any touch screen shorter than 500 px (phones in landscape),
 * so a rotated phone keeps the bottom bar, sheets and 44 px targets.
 * Styled components use the same query via `@media ${PHONE_MEDIA}`.
 */
export const PHONE_MEDIA = `(max-width:599.95px), (${LANDSCAPE_PHONE_MEDIA})`;

/**
 * The compact bottom bar: a short touch screen that is also wide, as a phone
 * in landscape is. The width matters because GO resizes the app for the soft
 * keyboard (adjustResize), so a portrait phone with the keyboard open is short
 * too (about 320 px at 360×740) but stays under 600 px wide, and its bar must
 * not change while the user types.
 */
export const COMPACT_BAR_MEDIA = `${LANDSCAPE_PHONE_MEDIA} and (min-width: 600px)`;

export function usePhoneLayout(): boolean {
  return useMediaQuery(`@media ${PHONE_MEDIA}`);
}

/** True on a phone in landscape, where the bottom bar goes compact (see COMPACT_BAR_MEDIA). */
export function useLandscapePhone(): boolean {
  return useMediaQuery(`@media ${COMPACT_BAR_MEDIA}`);
}

/** True below 900 px: the desktop rails collapse. */
export function useNarrowLayout(): boolean {
  return useMediaQuery("(max-width:899.95px)");
}
