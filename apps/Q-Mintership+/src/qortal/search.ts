/**
 * The cached, merged search layer every board list goes through (ported from
 * Torq's utils/qdnResourceSearch.ts, docs/QORTAL.md):
 * - never unlimited: pages of QDN_SEARCH_PAGE unless the caller says otherwise;
 * - identical searches already in flight share one request;
 * - results are reused for QDN_SEARCH_TTL_MS, then refreshed;
 * - a publish invalidates the searches that would list it.
 */
import { DEFAULT_PAGE_SIZE } from './constants';
import { buildSearchSimpleQuery, searchSimple, type QdnResource, type SearchSimpleParams } from './qdn';

export const QDN_SEARCH_PAGE = DEFAULT_PAGE_SIZE;
export const QDN_SEARCH_TTL_MS = 180_000;
const MEMORY_LIMIT = 800;

interface Entry {
  data: QdnResource[];
  expires: number;
}

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<QdnResource[]>>();
const resetListeners = new Set<() => void>();

/** Search counter for tests and the brief's "searches on first load" number. */
let searchCount = 0;

export function qdnSearchCount(): number {
  return searchCount;
}

export function resetQdnSearchCache(): void {
  cache.clear();
  inflight.clear();
  searchCount = 0;
  for (const listener of resetListeners) listener();
}

export function onQdnSearchReset(listener: () => void): () => void {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

export function qdnSearchKey(params: SearchSimpleParams): string {
  return `simple:${buildSearchSimpleQuery(params) ?? ''}`;
}

function remember(key: string, entry: Entry): void {
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > MEMORY_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Cached `searchSimple`. `fresh: true` skips the cache (a refresh button or a
 * poll tick); the result still replaces the cache entry.
 */
export async function cachedSearchSimple(
  params: SearchSimpleParams,
  options: { fresh?: boolean; ttlMs?: number } = {}
): Promise<QdnResource[]> {
  const normalized: SearchSimpleParams = {
    ...params,
    limit: typeof params.limit === 'number' && params.limit > 0 ? params.limit : QDN_SEARCH_PAGE,
  };
  const key = qdnSearchKey(normalized);
  if (!options.fresh) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      remember(key, hit);
      return hit.data;
    }
    const pending = inflight.get(key);
    if (pending) return pending;
  } else {
    cache.delete(key);
  }

  const request = (async () => {
    searchCount += 1;
    const rows = await searchSimple(normalized);
    remember(key, { data: rows, expires: Date.now() + (options.ttlMs ?? QDN_SEARCH_TTL_MS) });
    return rows;
  })();
  inflight.set(key, request);
  const forget = () => {
    if (inflight.get(key) === request) inflight.delete(key);
  };
  request.then(forget, forget);
  return request;
}

/**
 * Store rows a wider search already returned under the key this exact search
 * would use, so a detail view opens without a request.
 */
export function primeQdnSearch(params: SearchSimpleParams, rows: QdnResource[]): void {
  const key = qdnSearchKey({ ...params, limit: params.limit || QDN_SEARCH_PAGE });
  if (inflight.has(key)) return;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return;
  remember(key, { data: rows, expires: Date.now() + QDN_SEARCH_TTL_MS });
}

/** Drop every cached search whose identifier prefix matches, e.g. after publishing a card. */
export function invalidateQdnSearches(identifierPrefix: string): void {
  if (!identifierPrefix) return;
  const needle = `identifier=${identifierPrefix}`;
  for (const key of [...cache.keys()]) {
    if (key.includes(needle)) cache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.includes(needle)) inflight.delete(key);
  }
}

/**
 * Load pages until `wanted` rows or an empty page, never more than `maxPages`.
 * For the few places that need "every card" (e.g. finding one card by id),
 * with a hard ceiling instead of `limit: 0`.
 */
export async function searchSimplePages(
  params: Omit<SearchSimpleParams, 'limit' | 'offset'>,
  options: { pageSize?: number; maxPages?: number; wanted?: number; fresh?: boolean } = {}
): Promise<QdnResource[]> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 10;
  const wanted = options.wanted ?? pageSize * maxPages;
  const rows: QdnResource[] = [];
  for (let page = 0; page < maxPages && rows.length < wanted; page++) {
    const chunk = await cachedSearchSimple(
      { ...params, limit: pageSize, offset: page * pageSize },
      { fresh: options.fresh }
    );
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}
