/**
 * Whether a QDN resource is on the node, ready to read, and getting it
 * there when it isn't (Open File, Save File). One status read first, as it
 * stands; then, unless it is big and the user hasn't said yes yet, status
 * reads with `build=true`, which make Core fetch the parts it lacks from
 * its peers and put them together, until READY:
 *
 * - politely: 1.5 s, 2 s, 3 s, then every 5 s, paused while the tab is
 *   hidden, never two at a time, stopped when the viewer closes;
 * - no new parts for 90 s is "stalled" (said, and read every 15 s);
 *   10 minutes without READY, or 4 failed reads in a row, ends it with
 *   Try again;
 * - NOT_PUBLISHED, BLOCKED, UNSUPPORTED and BUILD_FAILED are final.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FINAL_STATUSES,
  getQdnStatus,
  resourceKey,
  type QdnResourceRef,
  type QdnStatus,
} from '../../../data/explorer/qdnFile';

/** Asked before the node fetches a file this big (the publish's own size, in bytes). */
export const BIG_FILE_BYTES = 50 * 1024 * 1024;

export type ReadyState =
  | { phase: 'checking' }
  | { phase: 'confirm'; status: QdnStatus }
  | { phase: 'fetching'; status: QdnStatus; stalled: boolean }
  | { phase: 'ready' }
  | { phase: 'final'; status: QdnStatus }
  | { phase: 'failed'; error: unknown; gaveUp: boolean };

let delays = { steps: [1_500, 2_000, 3_000, 5_000], stalled: 15_000 };
let limits = { stallMs: 90_000, giveUpMs: 10 * 60_000, errors: 4 };

/** Tests make the waits short. */
export function setReadyTimings(next: {
  steps?: number[];
  stalled?: number;
  stallMs?: number;
  giveUpMs?: number;
  errors?: number;
}): void {
  delays = { steps: next.steps ?? delays.steps, stalled: next.stalled ?? delays.stalled };
  limits = {
    stallMs: next.stallMs ?? limits.stallMs,
    giveUpMs: next.giveUpMs ?? limits.giveUpMs,
    errors: next.errors ?? limits.errors,
  };
}

function visible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden';
}

/**
 * Resolves after `ms`, counting only while the tab is visible; false when
 * stopped. Time is the page's own clock (performance.now), not the date.
 */
function politeWait(ms: number, stopped: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    let left = ms;
    let last = performance.now();
    const tick = () => {
      if (stopped()) return resolve(false);
      const now = performance.now();
      if (visible()) left -= now - last;
      last = now;
      if (left <= 0) return resolve(true);
      setTimeout(tick, Math.min(250, Math.max(0, left)));
    };
    setTimeout(tick, Math.min(250, ms));
  });
}

export function useQdnReady(
  ref: QdnResourceRef | null,
  options: { size?: number | null; enabled?: boolean } = {}
): ReadyState & { confirm: () => void; retry: () => void } {
  const enabled = options.enabled !== false && ref !== null;
  const key = ref ? resourceKey(ref) : '';
  const [state, setState] = useState<ReadyState>({ phase: 'checking' });
  const [run, setRun] = useState(0);
  const confirmed = useRef(false);
  const refRef = useRef(ref);
  refRef.current = ref;
  const big = (options.size ?? 0) >= BIG_FILE_BYTES;

  useEffect(() => {
    const target = refRef.current;
    if (!enabled || !target) return;
    let stopped = false;
    const isStopped = () => stopped;
    const set = (next: ReadyState) => {
      if (!stopped) setState(next);
    };
    set({ phase: 'checking' });
    void (async () => {
      let errors = 0;
      let building = confirmed.current || !big;
      let first = true;
      const started = performance.now();
      let lastProgress = performance.now();
      let lastLocal = -1;
      let step = 0;
      for (;;) {
        if (stopped) return;
        let status: QdnStatus;
        try {
          // The first read only looks: a big file isn't fetched before a yes.
          status = await getQdnStatus(target, { build: building && !first });
          errors = 0;
        } catch (error) {
          errors += 1;
          if (errors >= limits.errors) return set({ phase: 'failed', error, gaveUp: false });
          if (
            !(await politeWait(delays.steps[Math.min(step++, delays.steps.length - 1)], isStopped))
          )
            return;
          continue;
        }
        if (stopped) return;
        if (status.status === 'READY') return set({ phase: 'ready' });
        if (FINAL_STATUSES.has(status.status)) return set({ phase: 'final', status });
        if (first) {
          first = false;
          if (!building) return set({ phase: 'confirm', status });
          // Not ready: the next reads build it (and fetch what is missing).
          building = true;
          set({ phase: 'fetching', status, stalled: false });
          continue;
        }
        const local = status.chunks?.local ?? Math.round(status.percent ?? 0);
        if (local !== lastLocal) {
          lastLocal = local;
          lastProgress = performance.now();
        }
        const stalled = performance.now() - lastProgress >= limits.stallMs;
        if (performance.now() - started >= limits.giveUpMs)
          return set({ phase: 'failed', error: null, gaveUp: true });
        set({ phase: 'fetching', status, stalled });
        const wait = stalled
          ? delays.stalled
          : delays.steps[Math.min(step++, delays.steps.length - 1)];
        if (!(await politeWait(wait, isStopped))) return;
      }
    })();
    return () => {
      stopped = true;
    };
  }, [enabled, key, run, big]);

  const confirm = useCallback(() => {
    confirmed.current = true;
    setRun((value) => value + 1);
  }, []);
  const retry = useCallback(() => setRun((value) => value + 1), []);
  return { ...state, confirm, retry };
}
