/**
 * The phone's bottom bar: shown in a portrait phone frame, but not while the
 * on-screen keyboard is open. GO resizes the app for the keyboard: a
 * portrait frame under 500 px tall, or one well under its tallest while a
 * field has focus (useKeyboardOpen), means it is open; the bar then steps
 * aside, so the field being typed in and the page's own action bar keep
 * the room (docs/DESIGN.md → Mobile → Keyboard).
 */
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useKeyboardOpen, useLandscapeFrame, useShortFrame } from '../../utils/hubFrame';

export interface FrameFacts {
  /** Below 600 px wide. */
  phone: boolean;
  /** Short and wide: a phone held sideways (the compact rail instead). */
  landscape: boolean;
  /** Under 500 px tall. */
  short: boolean;
  /** The on-screen keyboard is open (useKeyboardOpen). */
  keyboard?: boolean;
}

/** Phone layout with the bottom bar (not the rail), whether or not the bar is on screen. */
export function isBottomBarLayout(f: FrameFacts): boolean {
  return f.phone && !f.landscape;
}

/** The bottom bar is on screen: the bottom-bar layout, keyboard closed. */
export function isBottomNavShown(f: FrameFacts): boolean {
  return isBottomBarLayout(f) && !f.short && !f.keyboard;
}

export function useFrameFacts(): FrameFacts {
  return {
    phone: usePhoneLayout(),
    landscape: useLandscapeFrame(),
    short: useShortFrame(),
    keyboard: useKeyboardOpen(),
  };
}

/** True while the bottom bar is on screen (sticky bars sit above it). */
export function useBottomNavShown(): boolean {
  return isBottomNavShown(useFrameFacts());
}
