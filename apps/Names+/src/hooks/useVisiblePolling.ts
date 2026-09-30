import { useEffect, useRef } from 'react';

interface Options {
  /** Run once as soon as the hook mounts (default true). */
  immediate?: boolean;
}

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/**
 * Runs `task` every `intervalMs` while the tab is visible. A hidden tab
 * stops the timer; coming back runs the task at once if it is overdue. Each
 * failure doubles the wait, up to 8×. Changing `task` never resets the timer.
 */
export function useVisiblePolling(
  task: () => Promise<unknown> | unknown,
  intervalMs: number,
  enabled = true,
  { immediate = true }: Options = {}
): void {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let failures = 0;
    let lastRun = immediate ? 0 : Date.now();

    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, delay);
    };
    const tick = async () => {
      if (disposed || !isVisible()) return;
      lastRun = Date.now();
      try {
        await taskRef.current();
        failures = 0;
      } catch (error) {
        failures = Math.min(failures + 1, 3);
        console.error(error);
      }
      if (!disposed) schedule(intervalMs * 2 ** failures);
    };
    const onVisibility = () => {
      if (!isVisible()) {
        clearTimeout(timer);
        return;
      }
      schedule(Math.max(0, intervalMs * 2 ** failures - (Date.now() - lastRun)));
    };

    document.addEventListener('visibilitychange', onVisibility);
    if (immediate) void tick();
    else schedule(intervalMs);
    return () => {
      disposed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled, immediate]);
}
