import { useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const MAX_PULL = 120;

export interface PullToRefreshState {
  /** Current pull distance in px (0 when idle), for an indicator. */
  pull: number;
  refreshing: boolean;
}

/**
 * Pull-to-refresh for the page scroller on touch screens. Starts only when the
 * page is scrolled to the top, needs a 72 px pull, and calls `onRefresh` once.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, enabled = true): PullToRefreshState {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const latest = useRef(onRefresh);
  useEffect(() => {
    latest.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (!coarse) return;
    let active = false;

    const setDistance = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };
    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1) return;
      // A drag inside a dialog, sheet or menu scrolls that surface, not the page.
      const target = e.target as Element | null;
      if (target?.closest?.('[role="dialog"], [role="menu"], .MuiModal-root, .MuiPopover-root')) return;
      startY.current = e.touches[0].clientY;
      active = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!active || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        setDistance(0);
        return;
      }
      // Resistance: the indicator moves slower than the finger.
      setDistance(Math.min(MAX_PULL, dy * 0.55));
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      startY.current = null;
      if (pullRef.current < THRESHOLD) {
        setDistance(0);
        return;
      }
      setDistance(THRESHOLD * 0.8);
      setRefreshing(true);
      Promise.resolve(latest.current()).finally(() => {
        setRefreshing(false);
        setDistance(0);
      });
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, refreshing]);

  return { pull, refreshing };
}
