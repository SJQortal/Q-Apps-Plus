/**
 * Small session caches. Every board and list reuses name, address, poll and
 * group lookups, so a lookup made once should not hit Core again this session.
 */

export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  has(key: string): boolean;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

/** A Map with a per-entry expiry and an LRU cap. */
export function createTtlCache<V>(ttlMs: number, maxEntries = 1000): TtlCache<V> {
  const store = new Map<string, { value: V; expires: number }>();
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expires <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      store.delete(key);
      store.set(key, hit);
      return hit.value;
    },
    set(key, value) {
      store.delete(key);
      store.set(key, { value, expires: Date.now() + ttlMs });
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
  };
}

/**
 * Merge identical in-flight requests: while `key` is pending, callers share
 * one promise. The entry is dropped when it settles, so a failure is retried
 * on the next call.
 */
export function dedupeInflight<T>(
  inflight: Map<string, Promise<T>>,
  key: string,
  run: () => Promise<T>
): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = run();
  inflight.set(key, request);
  const forget = () => {
    if (inflight.get(key) === request) inflight.delete(key);
  };
  request.then(forget, forget);
  return request;
}

/** Cache a value forever for this session, deduping concurrent misses. */
export function memoizeAsync<T>(
  store: Map<string, T>,
  inflight: Map<string, Promise<T>>,
  key: string,
  run: () => Promise<T>
): Promise<T> {
  if (store.has(key)) return Promise.resolve(store.get(key) as T);
  return dedupeInflight(inflight, key, async () => {
    const value = await run();
    store.set(key, value);
    return value;
  });
}
