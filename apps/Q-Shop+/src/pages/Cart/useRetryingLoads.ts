import { useCallback, useEffect, useRef, useState } from "react";
import { mapWithConcurrency } from "../../qdn/search";

/** Where one load stands: on its way, asking again, or given up until Retry. */
export type LoadPhase = "loading" | "retrying" | "failed";

/** A resource that isn't on the node yet is asked for again after these waits (docs/DESIGN.md → states). */
export const RETRY_DELAYS_MS = [2000, 4000, 8000];

/** At most this many loads at once (docs/QORTAL.md → Efficiency). */
export const LOAD_CONCURRENCY = 5;

export interface LoadJob<T> {
  key: string;
  item: T;
}

/**
 * Loads each job once, five at a time. A load that fails (resolves false or
 * throws) is tried again after 2, 4 and 8 s, then marked failed until
 * `retry(key)`. The caller keeps what was loaded and drops the job from
 * `jobs` once it has it, so a listed job without a phase is loading. A key
 * is loaded once per mount (plus each `retry`), even if it is listed again.
 * No polling: nothing runs once every job has loaded or failed, and pending
 * retries stop when the component unmounts.
 */
export function useRetryingLoads<T>(
  jobs: LoadJob<T>[],
  load: (item: T) => Promise<boolean>
): { phaseOf: (key: string) => LoadPhase; retry: (key: string) => void } {
  const [phases, setPhases] = useState<Record<string, Exclude<LoadPhase, "loading">>>({});
  const started = useRef(new Set<string>());
  const timers = useRef(new Map<string, number>());
  const alive = useRef(true);
  const latest = useRef({ jobs, load });

  useEffect(() => {
    latest.current = { jobs, load };
  });

  useEffect(() => {
    const pending = timers.current;
    alive.current = true;
    return () => {
      alive.current = false;
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);

  /** Loads a job, then (until it works) again after each retry delay. Resolves after the first try. */
  const attempt = useCallback((job: LoadJob<T>): Promise<void> => {
    const run = async (round: number): Promise<void> => {
      let ok = false;
      try {
        ok = await latest.current.load(job.item);
      } catch {
        ok = false;
      }
      if (!alive.current) return;
      if (ok) {
        // Loaded: it stays started, so a job the caller lists again (say,
        // because what it loaded was replaced elsewhere) is not loaded again
        // on its own, which could repeat for as long as the page is open.
        // Only retry(key) loads a key a second time.
        setPhases((current) => {
          if (!(job.key in current)) return current;
          const next = { ...current };
          delete next[job.key];
          return next;
        });
        return;
      }
      if (round < RETRY_DELAYS_MS.length) {
        setPhases((current) => ({ ...current, [job.key]: "retrying" }));
        const timer = window.setTimeout(() => {
          timers.current.delete(job.key);
          void run(round + 1);
        }, RETRY_DELAYS_MS[round]);
        timers.current.set(job.key, timer);
      } else {
        setPhases((current) => ({ ...current, [job.key]: "failed" }));
      }
    };
    return run(0);
  }, []);

  const signature = jobs.map((job) => job.key).join("\n");
  useEffect(() => {
    const fresh = latest.current.jobs.filter((job) => !started.current.has(job.key));
    if (fresh.length === 0) return;
    for (const job of fresh) started.current.add(job.key);
    void mapWithConcurrency(fresh, LOAD_CONCURRENCY, (job) => attempt(job));
  }, [signature, attempt]);

  const retry = useCallback(
    (key: string) => {
      const job = latest.current.jobs.find((j) => j.key === key);
      if (!job) return;
      const timer = timers.current.get(key);
      if (timer !== undefined) window.clearTimeout(timer);
      timers.current.delete(key);
      setPhases((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      void attempt(job);
    },
    [attempt]
  );

  const phaseOf = useCallback((key: string): LoadPhase => phases[key] ?? "loading", [phases]);
  return { phaseOf, retry };
}
