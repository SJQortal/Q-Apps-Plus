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
  /** `version` when the running load started. */
  inflightVersion: number;
  /** Set by invalidate(): the next read loads again even inside the TTL. */
  stale: boolean;
  /** Bumped by every invalidate(), so a load that started before it can't clear it. */
  version: number;
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
    entry = {
      state: IDLE,
      inflight: null,
      inflightVersion: 0,
      stale: false,
      version: 0,
      listeners: new Set(),
    };
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
  // Share a running load, unless the key was invalidated after it started:
  // its answer may predate the write, so a new load replaces it.
  if (entry.inflight && entry.inflightVersion === entry.version) {
    return entry.inflight as Promise<T>;
  }

  const prefix = key.split(':')[0];
  loadCounts.set(prefix, (loadCounts.get(prefix) ?? 0) + 1);
  const startedAt = entry.version;
  const self: { promise?: Promise<T> } = {};
  const current = () => entry.inflight === self.promise;
  const run = (async () => {
    // Yield first, so `self.promise` is set before `finally` can run.
    await null;
    try {
      const data = await load();
      // A newer load replaced this one: its answer is the one that counts.
      if (!current()) return data;
      if (entry.version === startedAt) entry.stale = false;
      setState(entry, {
        data,
        error: undefined,
        status: 'success',
        updatedAt: Date.now(),
        fetching: false,
      });
      return data;
    } catch (error) {
      if (current()) {
        setState(entry, {
          error,
          status: entry.state.data === undefined ? 'error' : 'success',
          fetching: false,
        });
      }
      throw error;
    } finally {
      if (current()) entry.inflight = null;
    }
  })();
  self.promise = run;
  entry.inflight = run;
  entry.inflightVersion = startedAt;
  setState(entry, {
    fetching: true,
    status: entry.state.data === undefined ? 'loading' : entry.state.status,
  });
  return run;
}

/**
 * True when fetchQuery(key, …) with these options would answer without
 * starting a load: the value is fresh (and not forced), or a load that
 * started after the key's last invalidate() is running and would be shared.
 */
export function canServeWithoutLoad(key: string, options: FetchOptions = {}): boolean {
  const entry = entries.get(key);
  if (!entry) return false;
  if (!options.force && isFresh(entry, options.ttlMs ?? 60_000)) return true;
  return entry.inflight !== null && entry.inflightVersion === entry.version;
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
 * Mark every key starting with `prefix` stale. Mounted views reload them at
 * once (useQuery watches staleVersion()); values stay on screen meanwhile.
 * Each key gets a new state object, so useSyncExternalStore re-renders.
 */
export function invalidate(prefix: string): void {
  for (const [key, entry] of entries) {
    if (key.startsWith(prefix)) {
      entry.stale = true;
      entry.version += 1;
      setState(entry, {});
    }
  }
}

/**
 * Forget one key, unless a view is watching it or a load is running. True
 * when it is gone.
 */
export function removeQuery(key: string): boolean {
  const entry = entries.get(key);
  if (!entry) return true;
  if (entry.listeners.size > 0 || entry.inflight) return false;
  entries.delete(key);
  return true;
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

/**
 * 0 while `key` is fresh; otherwise a number that changes with every
 * invalidate(), so a view reloads once per invalidation (and a failed reload
 * doesn't loop: it waits for the next refresh or invalidation).
 */
export function staleVersion(key: string): number {
  const entry = entries.get(key);
  return entry?.stale ? entry.version : 0;
}
