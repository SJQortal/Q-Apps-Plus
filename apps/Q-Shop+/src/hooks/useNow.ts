import { useEffect, useState } from "react";

const clock = () => Date.now();

/**
 * The time, for countdowns: kept current every `everyMs` while the tab is
 * shown, paused while it is hidden, and caught up when it is shown again.
 */
export function useNow(everyMs: number): number {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const run = () => {
      stop();
      timer = setInterval(() => setNow(clock()), everyMs);
    };
    const onVisibility = () => {
      if (document.hidden) return stop();
      setNow(clock());
      run();
    };
    if (!document.hidden) run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [everyMs]);
  return now;
}
