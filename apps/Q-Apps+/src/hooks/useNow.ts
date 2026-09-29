import { useSyncExternalStore } from 'react';

/**
 * A clock that ticks once a minute while the tab is visible, for "3 min ago"
 * labels. Reading Date.now() during render is impure, so the value comes
 * from a tiny external store instead.
 */
const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  now = Date.now();
  listeners.forEach((listener) => listener());
}

function start() {
  if (timer !== null || typeof document === 'undefined') return;
  if (document.visibilityState === 'visible') timer = setInterval(tick, TICK_MS);
}

function stop() {
  if (timer !== null) clearInterval(timer);
  timer = null;
}

function onVisibility() {
  if (document.visibilityState === 'visible') {
    tick();
    start();
  } else {
    stop();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    tick();
    start();
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

function getSnapshot() {
  return now;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
