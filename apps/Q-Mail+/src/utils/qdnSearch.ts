/**
 * One door for every `/arbitrary/resources/search` call (docs/QORTAL.md →
 * Efficiency rules 2 and 3):
 *
 * - identical searches already in flight share one promise;
 * - results are cached for the session with a TTL (default 90 s);
 * - `invalidateSearches()` drops matching entries after the user publishes.
 *
 * Pass the same params the app already builds; this never adds or removes
 * query keys, so the searches stay byte-for-byte what the original app sends.
 */

export interface SearchOptions {
  /** Cache lifetime in ms. 0 = always fetch (but still merge in-flight calls). */
  ttlMs?: number;
  /** Skip the cache and refetch (the fresh result still goes into the cache). */
  force?: boolean;
  signal?: AbortSignal;
}

export const DEFAULT_SEARCH_TTL_MS = 90_000;

interface CacheEntry {
  at: number;
  data: unknown[];
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown[]>>();
let stats = { requests: 0, cacheHits: 0, merged: 0 };

function keyFor(params: URLSearchParams | Record<string, string | number | boolean | undefined>): string {
  const sp = params instanceof URLSearchParams ? params : toParams(params);
  // Sort so that the same query built in a different key order shares a cache entry.
  const pairs = Array.from(sp.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return new URLSearchParams(pairs).toString();
}

function toParams(obj: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  return sp;
}

/**
 * Search QDN resources through Core's REST search. Resolves to the JSON array
 * (empty on a non-array body). Throws on network errors and non-2xx responses.
 */
export async function searchResources<T = any>(
  params: URLSearchParams | Record<string, string | number | boolean | undefined>,
  options: SearchOptions = {}
): Promise<T[]> {
  const key = keyFor(params);
  const ttl = options.ttlMs ?? DEFAULT_SEARCH_TTL_MS;
  const now = Date.now();
  stats.requests += 1;

  if (!options.force && ttl > 0) {
    const hit = cache.get(key);
    if (hit && now - hit.at < ttl) {
      stats.cacheHits += 1;
      return hit.data as T[];
    }
  }

  const running = inFlight.get(key);
  if (running) {
    stats.merged += 1;
    return running as Promise<T[]>;
  }

  const request = (async () => {
    const response = await fetch(`/arbitrary/resources/search?${key}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
    });
    if (!response.ok) {
      throw new Error(`QDN search failed (${response.status})`);
    }
    const body = await response.json();
    const data = Array.isArray(body) ? body : [];
    cache.set(key, { at: Date.now(), data });
    return data;
  })();

  inFlight.set(key, request);
  try {
    return (await request) as T[];
  } finally {
    inFlight.delete(key);
  }
}

/**
 * Drop cached searches. With no argument everything goes; with a predicate or
 * substring only matching keys (e.g. `invalidateSearches('service=MAIL_PRIVATE')`
 * after sending mail).
 */
export function invalidateSearches(match?: string | ((key: string) => boolean)): number {
  let removed = 0;
  for (const key of Array.from(cache.keys())) {
    const hit = !match || (typeof match === 'string' ? key.includes(match) : match(key));
    if (hit) {
      cache.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/** Counters for tests and the efficiency notes in the brief. */
export function searchStats() {
  return { ...stats, cached: cache.size, inFlight: inFlight.size };
}

export function resetSearchCache(): void {
  cache.clear();
  inFlight.clear();
  stats = { requests: 0, cacheHits: 0, merged: 0 };
}
