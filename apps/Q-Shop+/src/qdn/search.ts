/**
 * Every `/arbitrary/resources/search` and every resource JSON the app reads
 * goes through here (docs/QORTAL.md → Efficiency rules), after Q-Share+'s
 * `utils/qdnSearch.ts`:
 * - no search is ever unlimited: `limit` 0 or missing becomes a page of 20;
 * - identical requests already in flight share one promise;
 * - results are reused for a short session TTL, and dropped after a publish;
 * - names are encoded (URLSearchParams / encodeURIComponent), so names with a
 *   space, `+` or `/` work (docs/QORTAL.md → pitfall 9).
 *
 * `excludeblocked` is off unless a caller asks: the original Q-Shop never
 * sends it, and orders, statuses and reviews must show the same rows as there.
 */

export const QDN_PAGE = 20;
export const QDN_SEARCH_TTL_MS = 120_000;

export interface QdnSearchParams {
  service: string;
  identifier?: string;
  query?: string;
  name?: string;
  /** Several publishers: one `name=` each. */
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
  for (const name of new Set([params.name, ...(params.names ?? [])])) {
    if (name) p.append("name", name);
  }
  if (params.title) p.set("title", params.title);
  if (params.description) p.set("description", params.description);
  p.set("limit", String(normalizeLimit(params.limit)));
  p.set("offset", String(params.offset ?? 0));
  p.set("includemetadata", String(params.includemetadata ?? false));
  p.set("reverse", String(params.reverse ?? true));
  if (params.excludeblocked) p.set("excludeblocked", "true");
  if (params.name || params.names?.length) {
    if (params.exactmatchnames ?? true) p.set("exactmatchnames", "true");
  }
  if (params.prefix) p.set("prefix", "true");
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
    const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
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
 * "everything" (indexes, counts) still never send limit=0 and stay bounded.
 */
export async function searchQdnAll(
  params: Omit<QdnSearchParams, "limit" | "offset">,
  options: { pageSize?: number; maxPages?: number; fresh?: boolean } = {}
): Promise<{ rows: QdnResourceSummary[]; complete: boolean }> {
  const pageSize = options.pageSize ?? 100;
  const maxPages = options.maxPages ?? 5;
  const rows: QdnResourceSummary[] = [];
  for (let page = 0; page < maxPages; page++) {
    const chunk = await searchQdn({ ...params, limit: pageSize, offset: page * pageSize }, { fresh: options.fresh });
    rows.push(...chunk);
    if (chunk.length < pageSize) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/**
 * Does `name` hold a resource with exactly this identifier? Core matches
 * `identifier` anywhere in the id (case-insensitively) unless `prefix` is set,
 * and as a prefix otherwise, so "q-store-general-shop" also finds
 * "q-store-general-shop-2": ask for the prefix and compare exactly here.
 */
export async function resourceExists(
  service: string,
  name: string,
  identifier: string,
  options: { fresh?: boolean } = {}
): Promise<boolean> {
  const { rows } = await searchQdnAll(
    { service, name, identifier, prefix: true, exactmatchnames: true, includemetadata: false },
    { pageSize: 50, maxPages: 4, fresh: options.fresh }
  );
  return rows.some((row) => row.identifier === identifier && row.name === name);
}

/** `/arbitrary/<service>/<name>/<identifier>` with the parts encoded. */
export function resourcePath(service: string, name: string, identifier: string): string {
  return `/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

export class QdnFetchError extends Error {
  /** HTTP status, or 0 when the node answered 200 with a Core `{ error }` body. */
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "QdnFetchError";
    this.status = status;
  }
}

const jsonCache = new Map<string, { value: unknown; expires: number }>();
const jsonInflight = new Map<string, Promise<unknown>>();

/**
 * A resource's JSON, cached for the session by service, name and identifier
 * (docs/QORTAL.md → pitfall 15: another name can publish the same
 * identifier). A Core `{ error }` body or an HTTP error rejects with a
 * QdnFetchError and isn't cached.
 */
export async function fetchQdnJson<T = any>(
  service: string,
  name: string,
  identifier: string,
  options: { fresh?: boolean } = {}
): Promise<T> {
  const url = resourcePath(service, name, identifier);
  if (!options.fresh) {
    const hit = jsonCache.get(url);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const pending = jsonInflight.get(url);
    if (pending) return pending as Promise<T>;
  } else {
    jsonCache.delete(url);
  }
  const request = (async () => {
    const response = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new QdnFetchError(`Not JSON: ${url}`, response.status || 0);
    }
    if (!response.ok) throw new QdnFetchError(`The node answered ${response.status} for ${url}`, response.status);
    if (body && typeof body === "object" && !Array.isArray(body) && "error" in body) {
      throw new QdnFetchError(String((body as { message?: unknown }).message ?? "Core error"), 0);
    }
    jsonCache.set(url, { value: body, expires: Date.now() + QDN_SEARCH_TTL_MS });
    return body;
  })();
  jsonInflight.set(url, request);
  const forget = () => {
    if (jsonInflight.get(url) === request) jsonInflight.delete(url);
  };
  request.then(forget, forget);
  return request as Promise<T>;
}

export function invalidateQdnJson(service: string, name: string, identifier: string): void {
  jsonCache.delete(resourcePath(service, name, identifier));
}

/** Run `task` over `items` with at most `concurrency` in flight, keeping result order. */
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
export function resetQdnCaches(): void {
  inflight.clear();
  cache.clear();
  jsonCache.clear();
  jsonInflight.clear();
}
