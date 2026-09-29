import { useCallback, useEffect, useState } from "react";

const THRESHOLD = 24;

export interface HideOnScroll {
  /** True while the header should be off screen. */
  hidden: boolean;
  /** Bring it back at once, e.g. when something inside it receives focus. */
  reveal: () => void;
}

/**
 * Hides the header once the page has scrolled down by more than 24 px since
 * the last change of direction, and shows it again after 24 px of scrolling
 * up or near the top. Does nothing when `enabled` is false (desktop).
 */
export function useHideOnScroll(enabled: boolean): HideOnScroll {
  const [hidden, setHidden] = useState(false);
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  const reveal = useCallback(() => setHidden(false), []);

  // Crossing the phone breakpoint resets the header (React's "adjust state while rendering" pattern).
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    setHidden(false);
  }

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let anchor = window.scrollY;
    let last = anchor;
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = Math.max(0, window.scrollY);
        if (y <= THRESHOLD) {
          setHidden(false);
          anchor = last = y;
          return;
        }
        const direction = y > last ? 1 : y < last ? -1 : 0;
        if (direction === 0) return;
        // Restart the measurement at each turn, so a small wobble does not toggle it.
        const lastDirection = last > anchor ? 1 : last < anchor ? -1 : 0;
        if (direction !== lastDirection) anchor = last;
        const travelled = y - anchor;
        if (travelled > THRESHOLD) setHidden(true);
        else if (travelled < -THRESHOLD) setHidden(false);
        last = y;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return { hidden: enabled && hidden, reveal };
}
