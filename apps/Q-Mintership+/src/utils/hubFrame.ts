/**
 * Hub's frame, not the device screen (docs/QORTAL.md → Hub & GO pitfalls 3).
 *
 * Hub and GO host the app in an iframe shorter than the screen: at 844×390
 * (a phone held sideways) Q-Mail+ got a frame of 703×201 CSS px in Hub.
 * `useAppViewport` sizes the app to that frame; this module says when the
 * frame is short, so the bars go compact, the floating button goes and the
 * reading pane takes the whole width. Adapted from Q-Mail+ (Q-Share+'s hubFrame.ts)
 * and usePhoneLayout.ts (PHONE_MEDIA).
 */
import { useEffect, useState } from 'react';
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

const NOT_TYPED = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** A field that brings up the on-screen keyboard has focus. */
export function isTypingIn(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return !NOT_TYPED.has(el.type);
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable === true || el.getAttribute('contenteditable') === 'true')
  );
}

/** The frame has shrunk this far below its tallest at this width: the keyboard. */
export const KEYBOARD_SHRINK = 0.75;

/**
 * The on-screen keyboard is open: a text field has focus and the frame is
 * well under the tallest it has been at this width. GO resizes the app for
 * the keyboard, by an amount that depends on whether GO's own top and
 * bottom bars are showing (they hide while scrolling), so a fixed height
 * alone (SHORT_FRAME_MEDIA) can miss it: on a real phone the frame was
 * 832 px tall with GO's bars hidden, 717 px with them, and 505 px with the
 * keyboard open.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let width = window.innerWidth;
    let tallest = window.innerHeight;
    const check = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = window.innerHeight;
      }
      tallest = Math.max(tallest, window.innerHeight);
      setOpen(window.innerHeight < tallest * KEYBOARD_SHRINK && isTypingIn(document.activeElement));
    };
    // Focus moves before the frame resizes, and leaves before the next field gets it.
    const later = () => window.setTimeout(check, 0);
    window.addEventListener('resize', check);
    document.addEventListener('focusin', check);
    document.addEventListener('focusout', later);
    return () => {
      window.removeEventListener('resize', check);
      document.removeEventListener('focusin', check);
      document.removeEventListener('focusout', later);
    };
  }, []);
  return open;
}
