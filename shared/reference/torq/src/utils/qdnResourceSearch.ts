/**
 * Qortal SEARCH_QDN_RESOURCES is a Hub/GO MessageChannel hop plus a Core
 * HTTP search. Torq:
 * - never sends limit 0 (qapp-core treats that as "unlimited")
 * - coalesces identical in-flight searches
 * - reuses results for a session TTL (longer on mobile GO, larger on Hub)
 */
import {
  qdnMemoryLimit,
  qdnSearchTtlMs,
  resetQdnMemoryCache,
} from './qdnMemoryCache';

export const QDN_SEARCH_PAGE = 20;
export const QDN_SEARCH_TTL_MS = 180_000;

export type QdnSearchParams = {
  service: string;
  identifier: string;
  name?: string;
  names?: string[];
  limit?: number;
  offset?: number;
  prefix?: boolean;
  reverse?: boolean;
  exactMatchNames?: boolean;
  description?: string;
  includemetadata?: boolean;
  /** qapp-core and Hub read this camelCase flag and forward it as includemetadata. */
  includeMetadata?: boolean;
  /** Core defaults to LATEST. qapp-core sends ALL unless this overrides it. */
  mode?: 'ALL' | 'LATEST';
};

type Lists = {
  fetchResourcesResultsOnly: (
    params: Record<string, unknown>
  ) => Promise<unknown[]>;
};

const inflight = new Map<string, Promise<unknown[]>>();
const cache = new Map<string, { data: unknown[]; expires: number }>();
const hashCache = new Map<string, Promise<string | null | undefined>>();
const prefixCache = new Map<string, Promise<string | null | undefined>>();
const resetListeners = new Set<() => void>();
let activeSearches = 0;
const searchWaiters: Array<() => void> = [];

export function onQdnCacheReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

function rememberSearch(
  key: string,
  entry: { data: unknown[]; expires: number }
) {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > qdnMemoryLimit()) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Store rows a wider search already returned under the key this exact search
 * would use, so the caller gets them without a request. A fresher entry, or
 * the same search in flight, is left alone.
 */
export function primeQdnSearch(params: QdnSearchParams, rows: unknown[]) {
  const key = qdnSearchKey(normalizeQdnSearchParams(params));
  if (inflight.has(key)) return;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return;
  rememberSearch(key, { data: rows, expires: Date.now() + qdnSearchTtlMs() });
}

export function qdnSearchKey(params: QdnSearchParams): string {
  return JSON.stringify({
    s: params.service,
    i: params.identifier,
    n: params.name || '',
    ns: params.names?.slice().sort().join('\n') || '',
    l: params.limit ?? QDN_SEARCH_PAGE,
    o: params.offset || 0,
    p: Boolean(params.prefix),
    r: Boolean(params.reverse),
    e: Boolean(params.exactMatchNames),
    d: params.description || '',
    m: Boolean(params.includemetadata),
    im: Boolean(params.includeMetadata),
    md: params.mode || '',
  });
}

export function normalizeQdnSearchParams(
  params: QdnSearchParams
): QdnSearchParams {
  const limit =
    params.limit === 0
      ? 0
      : typeof params.limit === 'number' && params.limit > 0
        ? params.limit
        : QDN_SEARCH_PAGE;
  return { ...params, limit };
}

export function resetQdnResourceCaches() {
  inflight.clear();
  cache.clear();
  hashCache.clear();
  prefixCache.clear();
  activeSearches = 0;
  activePrioritySearches = 0;
  searchWaiters.length = 0;
  prioritySearchWaiters.length = 0;
  resetQdnMemoryCache();
  for (const listener of resetListeners) listener();
}

/** How many SEARCH hops may run at once. GO's WebView stalls when these pile up. */
export function qdnSearchConcurrency(): number {
  return replyFetchConcurrency();
}

const PRIORITY_SEARCH_CAP = 8;
let activePrioritySearches = 0;

const prioritySearchWaiters: Array<() => void> = [];

/**
 * Every search shares qapp-core's queue of 6. While the open thread is still
 * listing replies, count searches for the cards around it go one at a time,
 * or the nested reply lists wait behind a screen of like and repost counts.
 */
function backgroundSearchLimit(): number {
  const priorityPending =
    activePrioritySearches > 0 || prioritySearchWaiters.length > 0;
  return priorityPending ? 1 : qdnSearchConcurrency();
}

function takeSearchSlot(priority = false): boolean {
  if (priority) {
    if (activePrioritySearches >= PRIORITY_SEARCH_CAP) return false;
    activePrioritySearches += 1;
    return true;
  }
  if (activeSearches >= backgroundSearchLimit()) return false;
  activeSearches += 1;
  return true;
}

function wakeBackgroundSearches() {
  while (searchWaiters.length > 0 && activeSearches < backgroundSearchLimit()) {
    searchWaiters.shift()?.();
  }
}

function waitForSearchSlot(priority = false): Promise<void> {
  return new Promise((resolve) => {
    const wake = () => {
      if (priority) activePrioritySearches += 1;
      else activeSearches += 1;
      resolve();
    };
    if (priority) prioritySearchWaiters.push(wake);
    else searchWaiters.push(wake);
  });
}

function releaseSearchSlot(priority = false) {
  if (priority) {
    activePrioritySearches = Math.max(0, activePrioritySearches - 1);
    const next = prioritySearchWaiters.shift();
    if (next) next();
    else wakeBackgroundSearches();
    return;
  }
  activeSearches = Math.max(0, activeSearches - 1);
  wakeBackgroundSearches();
}

export function invalidateQdnSearchesForIdentifier(identifier: string) {
  if (!identifier) return;
  const drop = (store: Map<string, unknown>) => {
    for (const key of [...store.keys()]) {
      try {
        const parsed = JSON.parse(key) as { i?: string };
        if (parsed.i === identifier) store.delete(key);
      } catch {
        store.delete(key);
      }
    }
  };
  drop(cache);
  drop(inflight);
}

export function cachedHashString(
  identifierOperations: {
    hashString: (
      value: string,
      strength: unknown
    ) => Promise<string | null | undefined>;
  },
  value: string,
  strength: unknown
): Promise<string | null | undefined> {
  const key = `${String(strength)}:${value}`;
  const existing = hashCache.get(key);
  if (existing) return existing;
  const next = identifierOperations.hashString(value, strength);
  hashCache.set(key, next);
  return next;
}

export function cachedSearchPrefix(
  identifierOperations: {
    buildSearchPrefix: (
      entityType: string,
      parentId: string
    ) => Promise<string | null | undefined>;
  },
  entityType: string,
  parentId: string
): Promise<string | null | undefined> {
  const key = `${entityType}:${parentId}`;
  const existing = prefixCache.get(key);
  if (existing) return existing;
  const next = identifierOperations.buildSearchPrefix(entityType, parentId);
  prefixCache.set(key, next);
  return next;
}

export async function searchQdnResources(
  lists: Lists,
  params: QdnSearchParams,
  options?: { fresh?: boolean; priority?: boolean }
): Promise<unknown[]> {
  const normalized = normalizeQdnSearchParams(params);
  const key = qdnSearchKey(normalized);
  if (!options?.fresh) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      rememberSearch(key, hit);
      return hit.data;
    }
    const pending = inflight.get(key);
    if (pending) return pending;
  } else {
    cache.delete(key);
  }

  const request = (async () => {
    const priority = Boolean(options?.priority);
    if (!takeSearchSlot(priority)) await waitForSearchSlot(priority);
    try {
      const data = await lists.fetchResourcesResultsOnly(normalized);
      const list = Array.isArray(data) ? data : [];
      rememberSearch(key, {
        data: list,
        expires: Date.now() + qdnSearchTtlMs(),
      });
      return list;
    } finally {
      releaseSearchSlot(priority);
    }
  })();

  inflight.set(key, request);
  // The caller handles a failure. This cleanup must not leave a second,
  // unhandled rejection behind.
  const forget = () => {
    if (inflight.get(key) === request) inflight.delete(key);
  };
  request.then(forget, forget);
  return request;
}

export function replyFetchConcurrency(): number {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 2;
  }
  // Phone GO stays at 2. Desktop matches qapp-core's results-only queue of 6
  // so a screen of like, comment, and repost counts is not stuck behind itself.
  return window.matchMedia('(pointer: coarse)').matches ? 2 : 6;
}
