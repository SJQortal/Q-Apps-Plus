/**
 * Every `/arbitrary/resources/search` the app makes goes through here so that
 * (docs/QORTAL.md, efficiency rules):
 * - no search is ever unlimited: `limit` 0 or missing becomes a page of 20;
 * - identical searches already in flight share one request;
 * - results are reused for a short session TTL, and dropped after a publish.
 *
 * The URL parameters are exactly the ones the original Q-Share sends, so the
 * node returns the same rows.
 */

export const QDN_PAGE = 20;
export const QDN_SEARCH_TTL_MS = 120_000;

export interface QdnSearchParams {
  service: string;
  identifier?: string;
  query?: string;
  name?: string;
  /** Several publishers: one `name=` each, and Core returns resources by any of them. */
  names?: string[];
  title?: string;
  description?: string;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  includemetadata?: boolean;
  mode?: "ALL" | "LATEST";
  excludeblocked?: boolean;
  exactmatchnames?: boolean;
  prefix?: boolean;
  /** Core: only resources published by names on the followedNames list. */
  followedonly?: boolean;
}

export interface QdnResourceSummary {
  name: string;
  service: string;
  identifier: string;
  created?: number;
  updated?: number;
  size?: number;
  metadata?: {
    title?: string;
    description?: string;
    category?: string;
    categoryName?: string;
    tags?: string[];
  };
}

const inflight = new Map<string, Promise<QdnResourceSummary[]>>();
const cache = new Map<string, { rows: QdnResourceSummary[]; expires: number }>();

export function normalizeLimit(limit: number | undefined): number {
  return typeof limit === "number" && limit > 0 ? Math.floor(limit) : QDN_PAGE;
}

export function buildSearchUrl(params: QdnSearchParams): string {
  const p = new URLSearchParams();
  p.set("mode", params.mode ?? "ALL");
  p.set("service", params.service);
  if (params.identifier) p.set("identifier", params.identifier);
  if (params.query) p.set("query", params.query);
  // Repeats dropped, so the same names always make the same URL (and cache entry).
  for (const name of new Set([params.name, ...(params.names ?? [])])) {
    if (name) p.append("name", name);
  }
  if (params.title) p.set("title", params.title);
  if (params.description) p.set("description", params.description);
  p.set("limit", String(normalizeLimit(params.limit)));
  p.set("offset", String(params.offset ?? 0));
  p.set("includemetadata", String(params.includemetadata ?? false));
  p.set("reverse", String(params.reverse ?? true));
  p.set("excludeblocked", String(params.excludeblocked ?? true));
  if (params.exactmatchnames ?? true) p.set("exactmatchnames", "true");
  if (params.prefix) p.set("prefix", "true");
  if (params.followedonly) p.set("followedonly", "true");
  return `/arbitrary/resources/search?${p.toString()}`;
}

export async function searchQdn(
  params: QdnSearchParams,
  options: { fresh?: boolean } = {}
): Promise<QdnResourceSummary[]> {
  const url = buildSearchUrl(params);
  if (!options.fresh) {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.rows;
    const pending = inflight.get(url);
    if (pending) return pending;
  } else {
    cache.delete(url);
  }

  const request = (async () => {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Search failed (${response.status})`);
    const data = await response.json();
    const rows: QdnResourceSummary[] = Array.isArray(data) ? data : [];
    cache.set(url, { rows, expires: Date.now() + QDN_SEARCH_TTL_MS });
    return rows;
  })();

  inflight.set(url, request);
  const forget = () => {
    if (inflight.get(url) === request) inflight.delete(url);
  };
  request.then(forget, forget);
  return request;
}

/** Drop cached searches, e.g. after the user publishes. Without a filter, all of them. */
export function invalidateQdnSearches(matcher?: (url: string) => boolean): void {
  for (const key of [...cache.keys()]) {
    if (!matcher || matcher(key)) cache.delete(key);
  }
}

/**
 * Page through a search until a short page comes back, so callers that need
 * "everything" (stats, reply lists) still never send limit=0 and stay bounded.
 */
export async function searchQdnAll(
  params: Omit<QdnSearchParams, "limit" | "offset">,
  options: { pageSize?: number; maxPages?: number; fresh?: boolean } = {}
): Promise<{ rows: QdnResourceSummary[]; complete: boolean }> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 5;
  const rows: QdnResourceSummary[] = [];
  for (let page = 0; page < maxPages; page++) {
    const chunk = await searchQdn(
      { ...params, limit: pageSize, offset: page * pageSize },
      { fresh: options.fresh }
    );
    rows.push(...chunk);
    if (chunk.length < pageSize) return { rows, complete: true };
  }
  return { rows, complete: false };
}

const textCache = new Map<string, { text: string; expires: number }>();
const textInflight = new Map<string, Promise<string>>();

/**
 * Read a small resource body (comments, text previews) as text, cached for
 * the session. Rejects when the node answers with an error (e.g. 404 with
 * `{"error":1401,…}` for data it doesn't have), so an error body is never
 * shown as the content; failures aren't cached.
 */
export async function fetchQdnText(service: string, name: string, identifier: string): Promise<string> {
  const url = `/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
  const hit = textCache.get(url);
  if (hit && hit.expires > Date.now()) return hit.text;
  const pending = textInflight.get(url);
  if (pending) return pending;
  const request = (async () => {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`The node answered ${response.status} for ${url}`);
    const text = await response.text();
    textCache.set(url, { text, expires: Date.now() + QDN_SEARCH_TTL_MS });
    return text;
  })();
  textInflight.set(url, request);
  const forget = () => {
    if (textInflight.get(url) === request) textInflight.delete(url);
  };
  request.then(forget, forget);
  return request;
}

export function invalidateQdnText(service: string, name: string, identifier: string): void {
  textCache.delete(`/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`);
}

/** Run `tasks` with at most `concurrency` in flight, keeping result order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** For tests. */
export function resetQdnSearchCache(): void {
  inflight.clear();
  cache.clear();
  textCache.clear();
  textInflight.clear();
}
