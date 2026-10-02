/**
 * Hub's frame, not the device screen (docs/QORTAL.md → Hub & GO pitfalls 3).
 *
 * Hub and GO host the app in an iframe shorter than the screen: at 844×390
 * (a phone held sideways) Q-Mail+ gets a frame of 703×201 CSS px in Hub.
 * `useAppViewport` sizes the app to that frame; this module says when the
 * frame is short, so the bars go compact, the floating button goes and the
 * reading pane takes the whole width. Adapted from Q-Share+'s hubFrame.ts
 * and usePhoneLayout.ts (PHONE_MEDIA).
 */
import { useMediaQuery } from '@mui/material';

/** A frame under 500 px tall: a phone in landscape, or a portrait phone with the keyboard open. */
export const SHORT_FRAME_MEDIA = '(max-height: 500px)';

/**
 * A short frame that is also wide, as a phone in landscape is. The width
 * matters because GO resizes the app for the soft keyboard (adjustResize), so
 * a portrait phone with the keyboard open is short too (about 320 px at
 * 360×740) but stays under 600 px wide, and its bars must not change while
 * the user types.
 */
export const LANDSCAPE_FRAME_MEDIA = '(max-height: 500px) and (min-width: 600px)';

/** The pane header's bar in a landscape frame (52 px or less per the pitfall; 48 here). */
export const COMPACT_BAR_HEIGHT = 48;

export function isEmbeddedFrame(win: Window = window): boolean {
  try {
    return win.parent !== win;
  } catch {
    // Cross-origin parents throw on access; that still means we are framed.
    return true;
  }
}

/** Pure form of the landscape test, for code that has a size but no media query. */
export function isLandscapeFrame(width: number, height: number): boolean {
  return height <= 500 && width >= 600;
}

/** True in a short, wide frame: compact bar, no floating button, one pane at a time. */
export function useLandscapeFrame(): boolean {
  return useMediaQuery(`@media ${LANDSCAPE_FRAME_MEDIA}`);
}

/** True in any frame under 500 px tall. */
export function useShortFrame(): boolean {
  return useMediaQuery(`@media ${SHORT_FRAME_MEDIA}`);
}
