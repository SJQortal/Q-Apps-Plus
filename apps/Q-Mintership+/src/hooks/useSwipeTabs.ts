/**
 * Swipe sideways through tabs on a touch screen (Simon, 2026-10-17: "for
 * mobile, I would like the ability to swipe (left - right) through the
 * different tabs of Explorer"): a swipe to the left opens the next tab, to
 * the right the previous one. The panel follows the finger a little (not
 * with reduced motion), and springs back when the swipe falls short.
 *
 * A touch is left alone when it starts within EDGE_PX of the screen's
 * sides (GO's and the system's Back gesture), on a field, a slider or
 * anything marked `data-no-swipe` (a chart that is dragged), or on a part
 * that scrolls sideways itself (a wide table, a row of chips); when it
 * moves more up or down than sideways (scrolling the page); when more than
 * one finger is down; and when it ends with text selected. Touch events
 * only, passive: a mouse or a pen never swipes, and scrolling never waits.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';

/** Touches starting this close to the screen's left or right edge are the system's. */
export const EDGE_PX = 24;
/** A swipe moves at least this far sideways. */
export const MIN_SWIPE_PX = 64;
/** …and this much more sideways than up or down. */
const SIDEWAYS_RATIO = 2;
/** A swipe this quick needs only MIN_SWIPE_PX; a slower one, LONG_SHARE of the panel's width. */
const QUICK_MS = 700;
const LONG_SHARE = 0.4;
/** How far the panel follows the finger, at most, and how much of the way. */
const FOLLOW_MAX_PX = 48;
const FOLLOW_SHARE = 0.3;

/** -1: the previous tab (a swipe to the right); 1: the next (to the left). */
export type SwipeStep = -1 | 1;

export interface SwipeTabsOptions {
  enabled: boolean;
  /** Whether there is a tab that way. */
  canGo: (step: SwipeStep) => boolean;
  go: (step: SwipeStep) => void;
}

const NOT_FOR_SWIPES =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [data-no-swipe]';

/**
 * Whether a touch starting at `target` belongs to something else inside
 * `panel`: a field, a slider, a part marked `data-no-swipe`, or one that
 * scrolls sideways itself.
 */
export function startsElsewhere(target: Element | null, panel: Element): boolean {
  for (let el = target; el && el !== panel; el = el.parentElement) {
    if (el.matches(NOT_FOR_SWIPES)) return true;
    const overflowX = getComputedStyle(el).overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1)
      return true;
  }
  return false;
}

/** Whether a touch that moved `dx`, `dy` in `ms` on a panel `width` wide is a swipe. */
export function isSwipe(dx: number, dy: number, ms: number, width: number): boolean {
  const across = Math.abs(dx);
  if (across < MIN_SWIPE_PX || across < Math.abs(dy) * SIDEWAYS_RATIO) return false;
  return ms <= QUICK_MS || across >= width * LONG_SHARE;
}

export function useSwipeTabs(node: HTMLElement | null, options: SwipeTabsOptions): void {
  // The latest tabs, without listening again on every render.
  const latest = useRef(options);
  useLayoutEffect(() => {
    latest.current = options;
  });
  const { enabled } = options;

  useEffect(() => {
    if (!node || !enabled) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let start: { x: number; y: number; t: number } | null = null;
    let sideways: boolean | null = null;

    const follow = (dx: number) => {
      if (reduced) return;
      const shift = Math.max(-FOLLOW_MAX_PX, Math.min(FOLLOW_MAX_PX, dx * FOLLOW_SHARE));
      node.style.transition = '';
      node.style.transform = `translateX(${shift}px)`;
    };
    const springBack = () => {
      if (!node.style.transform) return;
      node.style.transition = 'transform 160ms ease-out';
      node.style.transform = '';
    };

    const onStart = (event: TouchEvent) => {
      start = null;
      sideways = null;
      if (event.touches.length !== 1) return springBack();
      const touch = event.touches[0];
      if (touch.clientX < EDGE_PX || touch.clientX > window.innerWidth - EDGE_PX) return;
      if (startsElsewhere(event.target instanceof Element ? event.target : null, node)) return;
      start = { x: touch.clientX, y: touch.clientY, t: performance.now() };
    };
    const onMove = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1) {
        start = null;
        return springBack();
      }
      const touch = event.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      // The way it goes is settled once it has moved a little.
      if (sideways === null && Math.hypot(dx, dy) > 10) sideways = Math.abs(dx) > Math.abs(dy);
      if (!sideways) return;
      // Towards a tab that isn't there, it barely moves.
      follow(latest.current.canGo(dx < 0 ? 1 : -1) ? dx : dx * 0.25);
    };
    const onEnd = (event: TouchEvent) => {
      const began = start;
      start = null;
      springBack();
      if (!began || !sideways) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      if (String(window.getSelection?.() ?? '').length) return;
      const dx = touch.clientX - began.x;
      const dy = touch.clientY - began.y;
      if (!isSwipe(dx, dy, performance.now() - began.t, node.clientWidth)) return;
      const step: SwipeStep = dx < 0 ? 1 : -1;
      if (latest.current.canGo(step)) latest.current.go(step);
    };
    const onCancel = () => {
      start = null;
      springBack();
    };

    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: true });
    node.addEventListener('touchend', onEnd, { passive: true });
    node.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onCancel);
      node.style.transition = '';
      node.style.transform = '';
    };
  }, [node, enabled]);
}
