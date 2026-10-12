import { useEffect, useRef } from 'react';

/**
 * Polite polling (docs/QORTAL.md → Efficiency rule 7):
 * - runs `task` every `intervalMs` only while the tab is visible;
 * - when the tab becomes visible again it runs at once if a tick was missed;
 * - backs off (×2 per consecutive failure, up to `maxIntervalMs`) when `task`
 *   throws or returns false, and resets after a success;
 * - never overlaps runs; stops on unmount or when `enabled` is false.
 *
 * `task` may return `false` to mean "nothing new, back off a little".
 */
export interface PollingOptions {
  intervalMs: number;
  enabled?: boolean;
  /** Upper bound for backoff; default 8 × intervalMs. */
  maxIntervalMs?: number;
  /** Run once right away (default false: first run after one interval). */
  immediate?: boolean;
  /** Random jitter added to each wait, as a fraction of the interval (default 0.1). */
  jitter?: number;
}

export type PollingTask = () => Promise<boolean | void> | boolean | void;

export function nextDelay(base: number, failures: number, max: number, jitter: number, random = Math.random()): number {
  const backedOff = Math.min(max, base * 2 ** Math.min(failures, 10));
  return Math.round(backedOff * (1 + jitter * random));
}

export function isDocumentVisible(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): boolean {
  if (!doc) return true;
  return doc.visibilityState !== 'hidden';
}

export function usePolling(task: PollingTask, options: PollingOptions): void {
  const { intervalMs, enabled = true, maxIntervalMs = intervalMs * 8, immediate = false, jitter = 0.1 } = options;
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let running = false;
    let failures = 0;
    let missedWhileHidden = false;

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };

    const run = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const result = await taskRef.current();
        failures = result === false ? failures + 1 : 0;
      } catch {
        failures += 1;
      } finally {
        running = false;
      }
    };

    const tick = async () => {
      if (stopped) return;
      if (!isDocumentVisible()) {
        missedWhileHidden = true;
        return; // resumes from the visibilitychange handler
      }
      await run();
      schedule(nextDelay(intervalMs, failures, maxIntervalMs, jitter));
    };

    const onVisibility = () => {
      if (!isDocumentVisible()) return;
      if (missedWhileHidden) {
        missedWhileHidden = false;
        void tick();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    if (immediate) void tick();
    else schedule(nextDelay(intervalMs, 0, maxIntervalMs, jitter));

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, maxIntervalMs, immediate, jitter]);
}
