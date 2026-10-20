/**
 * A number that rises to its value instead of appearing at it (Activity's
 * participation), and glides from the old value to a new one. Reduced motion
 * (Settings, or the system's) shows the value at once. The setting is read
 * when the count starts, so a long list adds no screen or motion listeners.
 */
import { useEffect, useRef, useState } from 'react';

/** Motion is turned down: Settings → Motion, or the system's setting when Settings follows it. */
export function motionReduced(): boolean {
  if (typeof document === 'undefined') return true;
  const setting = document.documentElement.getAttribute('data-motion');
  if (setting === 'reduce') return true;
  if (setting === 'full') return false;
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** How long a count takes; ProgressBar fills in the same time, so the two move together. */
export const COUNT_UP_MS = 900;

/** Ease out: quick at first, settling at the end. */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function useCountUp(target: number, ms = COUNT_UP_MS): number {
  const [shown, setShown] = useState(() => (motionReduced() ? target : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (motionReduced() || typeof requestAnimationFrame !== 'function') {
      from.current = target;
      setShown(target);
      return;
    }
    const start = performance.now();
    const begin = from.current;
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / ms);
      const value = begin + (target - begin) * easeOut(t);
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}
