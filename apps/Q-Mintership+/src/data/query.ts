/**
 * One small store for every read (docs/QORTAL.md → Efficiency rules):
 *
 * - identical reads already in flight share one promise;
 * - results are kept for the session and reused until their TTL passes,
 *   then refreshed in the background while the old value stays on screen;
 * - a failure never replaces good data and is never cached, so the next
 *   read retries;
 * - writes invalidate the keys they change (`invalidate('pending:')`);
 * - React subscribes per key (see hooks/useQuery.ts).
 *
 * Keys are plain strings: "<area>:<detail>", e.g. "group:694" or
 * "account:Q…". Invalidate by prefix.
 */

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  status: QueryStatus;
  /** When `data` was last loaded (ms), 0 when never. */
  updatedAt: number;
  /** A load is running (the first one, or a background refresh). */
  fetching: boolean;
}

interface Entry {
  state: QueryState<unknown>;
  inflight: Promise<unknown> | null;
  /** Set by invalidate(): the next read loads again even inside the TTL. */
  stale: boolean;
  listeners: Set<() => void>;
}

const entries = new Map<string, Entry>();
const MAX_ENTRIES = 2000;

/** Calls made per key prefix, for tests and the brief's call counts. */
const loadCounts = new Map<string, number>();

const IDLE: QueryState<unknown> = Object.freeze({
  data: undefined,
  error: undefined,
  status: 'idle',
  updatedAt: 0,
  fetching: false,
}) as QueryState<unknown>;

function entryFor(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { state: IDLE, inflight: null, stale: false, listeners: new Set() };
    entries.set(key, entry);
    if (entries.size > MAX_ENTRIES) evictOne();
  }
  return entry;
}

function evictOne(): void {
  for (const [key, entry] of entries) {
    if (entry.listeners.size === 0 && !entry.inflight) {
      entries.delete(key);
      return;
    }
  }
}

function setState(entry: Entry, next: Partial<QueryState<unknown>>): void {
  entry.state = { ...entry.state, ...next };
  for (const listener of [...entry.listeners]) listener();
}

export interface FetchOptions {
  /** How long a loaded value is fresh. Default 60 s. */
  ttlMs?: number;
  /** Load again even if the value is fresh (a refresh button, a poll tick). */
  force?: boolean;
}

function isFresh(entry: Entry, ttlMs: number): boolean {
  return (
    entry.state.status === 'success' && !entry.stale && Date.now() - entry.state.updatedAt < ttlMs
  );
}

/**
 * Read `key`, loading it with `load` when it is missing, stale or forced.
 * Concurrent callers share one load. Rejects when the load fails (the
 * previous value, if any, stays in the store).
 */
export function fetchQuery<T>(
  key: string,
  load: () => Promise<T>,
  options: FetchOptions = {}
): Promise<T> {
  const ttlMs = options.ttlMs ?? 60_000;
  const entry = entryFor(key);
  if (!options.force && isFresh(entry, ttlMs)) return Promise.resolve(entry.state.data as T);
  if (entry.inflight) return entry.inflight as Promise<T>;

  const prefix = key.split(':')[0];
  loadCounts.set(prefix, (loadCounts.get(prefix) ?? 0) + 1);
  const self: { promise?: Promise<T> } = {};
  const run = (async () => {
    // Yield first, so `self.promise` is set before `finally` can run.
    await null;
    try {
      const data = await load();
      entry.stale = false;
      setState(entry, {
        data,
        error: undefined,
        status: 'success',
        updatedAt: Date.now(),
        fetching: false,
      });
      return data;
    } catch (error) {
      setState(entry, {
        error,
        status: entry.state.data === undefined ? 'error' : 'success',
        fetching: false,
      });
      throw error;
    } finally {
      if (entry.inflight === self.promise) entry.inflight = null;
    }
  })();
  self.promise = run;
  entry.inflight = run;
  setState(entry, {
    fetching: true,
    status: entry.state.data === undefined ? 'loading' : entry.state.status,
  });
  return run;
}

/** The value in the store right now, if any (no load). */
export function peekQuery<T>(key: string): T | undefined {
  return entries.get(key)?.state.data as T | undefined;
}

export function getQueryState<T>(key: string): QueryState<T> {
  return (entries.get(key)?.state ?? IDLE) as QueryState<T>;
}

export function subscribeQuery(key: string, listener: () => void): () => void {
  const entry = entryFor(key);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

/** Replace a value without loading (optimistic updates, or priming from a wider read). */
export function setQueryData<T>(key: string, update: T | ((previous: T | undefined) => T)): void {
  const entry = entryFor(key);
  const previous = entry.state.data as T | undefined;
  const data =
    typeof update === 'function' ? (update as (p: T | undefined) => T)(previous) : update;
  setState(entry, {
    data,
    status: 'success',
    updatedAt: entry.state.updatedAt || Date.now(),
    error: undefined,
  });
}

/**
 * Mark every key starting with `prefix` stale. Mounted views reload them on
 * their next read; values stay on screen meanwhile.
 */
export function invalidate(prefix: string): void {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix)) {
      entry.stale = true;
      for (const listener of [...entry.listeners]) listener();
    }
  }
}

/** Forget everything (tests, or switching accounts). */
export function resetQueries(): void {
  entries.clear();
  loadCounts.clear();
}

/** How many loads ran per key prefix since the last reset. */
export function queryLoadCounts(): Record<string, number> {
  return Object.fromEntries(loadCounts);
}

export function isStale(key: string): boolean {
  return entries.get(key)?.stale ?? false;
}
