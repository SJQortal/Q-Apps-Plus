/**
 * Code-splitting helpers (docs/apps/Q-Mail+.md → Bundle §5).
 *
 * `lazyNamed` is React.lazy for modules that use named exports, and
 * `preloadOnIdle` warms a chunk after first paint so the screen it belongs to
 * (the composer, the reader) still opens instantly. Chunks resolve relative to
 * the importing module, so they load under Hub's /render/APP/<name>/ base.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type ModuleLoader<M> = () => Promise<M>;

export function lazyNamed<M, K extends keyof M>(
  loader: ModuleLoader<M>,
  exportName: K,
  /** A failed chunk load is tried once more after this delay (React.lazy keeps a failure for good). */
  retryDelayMs = 800
): LazyExoticComponent<M[K] extends ComponentType<any> ? M[K] : never> {
  const load = (): Promise<M> =>
    loader().catch(
      () =>
        new Promise<M>((resolve, reject) => {
          setTimeout(() => loader().then(resolve, reject), retryDelayMs);
        })
    );
  return lazy(() =>
    load().then((module) => ({ default: module[exportName] as any }))
  ) as LazyExoticComponent<any>;
}

type IdleHandle = { cancel: () => void };

/**
 * Runs `loaders` one after another once the browser is idle (or after
 * `fallbackDelayMs` where requestIdleCallback does not exist, e.g. WebKit).
 * A failed preload is swallowed: the lazy component retries when rendered.
 */
export function preloadOnIdle(
  loaders: Array<ModuleLoader<unknown>>,
  fallbackDelayMs = 1500
): IdleHandle {
  if (typeof window === 'undefined') return { cancel: () => {} };
  let cancelled = false;
  const run = () => {
    if (cancelled) return;
    void loaders.reduce<Promise<unknown>>(
      (chain, load) => chain.then(() => (cancelled ? undefined : load().catch(() => undefined))),
      Promise.resolve()
    );
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(run, { timeout: 4000 });
    return {
      cancel: () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      },
    };
  }
  const id = window.setTimeout(run, fallbackDelayMs);
  return {
    cancel: () => {
      cancelled = true;
      window.clearTimeout(id);
    },
  };
}
