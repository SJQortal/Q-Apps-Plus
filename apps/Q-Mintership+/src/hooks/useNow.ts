import { useEffect, useState } from 'react';

/**
 * The current time, re-read every `ms` while the page is visible, for live
 * countdowns. One shared timer per interval, so a list of cards costs one.
 */
const subscribers = new Map<number, Set<(now: number) => void>>();
const timers = new Map<number, ReturnType<typeof setInterval>>();

function subscribe(ms: number, fn: (now: number) => void): () => void {
  let set = subscribers.get(ms);
  if (!set) {
    set = new Set();
    subscribers.set(ms, set);
    timers.set(
      ms,
      setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        const now = Date.now();
        for (const sub of subscribers.get(ms) ?? []) sub(now);
      }, ms)
    );
  }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) {
      clearInterval(timers.get(ms));
      timers.delete(ms);
      subscribers.delete(ms);
    }
  };
}

export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribe(ms, setNow), [ms]);
  return now;
}
