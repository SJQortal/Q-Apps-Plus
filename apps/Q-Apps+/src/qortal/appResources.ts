/**
 * Live QDN metadata for the APP resources the launcher presents.
 *
 * One SEARCH_QDN_RESOURCES for every name (names + exactMatchNames), never
 * one search per app. Identical in-flight searches share a promise, and
 * results are reused for a session TTL. Ported from Torq's qdnResourceSearch.
 */
import { qortalCall } from './request';

export const APP_SEARCH_TTL_MS = 180_000;
/** Core rejects very long name lists; the launcher has ~20 names. */
export const APP_SEARCH_MAX_NAMES = 50;

export interface AppResourceMetadata {
  title?: string;
  description?: string;
  category?: string;
  categoryName?: string;
  tags?: string[];
}

export interface AppResource {
  name: string;
  service: string;
  identifier?: string;
  size?: number;
  created?: number;
  updated?: number;
  metadata?: AppResourceMetadata;
}

export type AppResourceMap = Record<string, AppResource>;

export interface AppResourceStatus {
  status: string;
  localChunkCount?: number;
  totalChunkCount?: number;
  percentLoaded?: number;
}

type Timed<T> = { data: T; expires: number; fetchedAt: number };

const searchCache = new Map<string, Timed<AppResourceMap>>();
const searchInflight = new Map<string, Promise<AppResourceMap>>();
const statusCache = new Map<string, Timed<AppResourceStatus>>();
const statusInflight = new Map<string, Promise<AppResourceStatus>>();

export function resetAppResourceCaches() {
  searchCache.clear();
  searchInflight.clear();
  statusCache.clear();
  statusInflight.clear();
}

function searchKey(names: string[]): string {
  return [...new Set(names)].sort().join('\n');
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toResource(row: unknown): AppResource | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name) return null;
  const meta = r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : undefined;
  return {
    name: r.name,
    service: typeof r.service === 'string' ? r.service : 'APP',
    identifier: typeof r.identifier === 'string' ? r.identifier : undefined,
    size: toNumber(r.size),
    created: toNumber(r.created),
    updated: toNumber(r.updated) ?? toNumber(r.created),
    metadata: meta
      ? {
          title: typeof meta.title === 'string' ? meta.title : undefined,
          description: typeof meta.description === 'string' ? meta.description : undefined,
          category: typeof meta.category === 'string' ? meta.category : undefined,
          categoryName: typeof meta.categoryName === 'string' ? meta.categoryName : undefined,
          tags: Array.isArray(meta.tags) ? meta.tags.filter((t): t is string => typeof t === 'string') : undefined,
        }
      : undefined,
  };
}

/** The exact parameters of the batched search, exported so tests can pin them. */
export function appSearchParams(names: string[]) {
  const unique = [...new Set(names)].slice(0, APP_SEARCH_MAX_NAMES);
  return {
    action: 'SEARCH_QDN_RESOURCES',
    service: 'APP',
    names: unique,
    exactMatchNames: true,
    includeMetadata: true,
    mode: 'LATEST',
    limit: unique.length,
    offset: 0,
  } as const;
}

/** When the cached result for these names was fetched, or null. */
export function peekAppResources(names: string[]): { data: AppResourceMap; fetchedAt: number } | null {
  const hit = searchCache.get(searchKey(names));
  if (!hit) return null;
  return { data: hit.data, fetchedAt: hit.fetchedAt };
}

export function isAppResourcesStale(names: string[], now = Date.now()): boolean {
  const hit = searchCache.get(searchKey(names));
  return !hit || hit.expires <= now;
}

export async function searchAppResources(
  names: string[],
  options?: { fresh?: boolean }
): Promise<AppResourceMap> {
  if (names.length === 0) return {};
  const key = searchKey(names);
  if (!options?.fresh) {
    const hit = searchCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.data;
    const pending = searchInflight.get(key);
    if (pending) return pending;
  }

  const request = (async () => {
    const rows = await qortalCall<unknown>(appSearchParams(names));
    const list = Array.isArray(rows) ? rows : [];
    const byName: AppResourceMap = {};
    for (const row of list) {
      const resource = toResource(row);
      if (!resource) continue;
      // LATEST mode gives one row per name; keep the newest if Core sends more.
      const existing = byName[resource.name];
      if (!existing || (resource.updated ?? 0) > (existing.updated ?? 0)) byName[resource.name] = resource;
    }
    const now = Date.now();
    searchCache.set(key, { data: byName, expires: now + APP_SEARCH_TTL_MS, fetchedAt: now });
    return byName;
  })();

  searchInflight.set(key, request);
  const forget = () => {
    if (searchInflight.get(key) === request) searchInflight.delete(key);
  };
  request.then(forget, forget);
  return request;
}

/** Download status of one app's zip on this node, via GET_QDN_RESOURCE_STATUS. */
export async function getAppResourceStatus(
  name: string,
  options?: { fresh?: boolean }
): Promise<AppResourceStatus> {
  if (!options?.fresh) {
    const hit = statusCache.get(name);
    if (hit && hit.expires > Date.now()) return hit.data;
    const pending = statusInflight.get(name);
    if (pending) return pending;
  }
  const request = (async () => {
    const raw = await qortalCall<Record<string, unknown>>({
      action: 'GET_QDN_RESOURCE_STATUS',
      service: 'APP',
      name,
    });
    const status: AppResourceStatus = {
      status: typeof raw?.status === 'string' ? raw.status : 'UNKNOWN',
      localChunkCount: toNumber(raw?.localChunkCount),
      totalChunkCount: toNumber(raw?.totalChunkCount),
      percentLoaded: toNumber(raw?.percentLoaded),
    };
    const now = Date.now();
    // A download in progress changes quickly, so remember it only briefly.
    const ttl = status.status === 'READY' || status.status === 'NOT_PUBLISHED' ? APP_SEARCH_TTL_MS : 5_000;
    statusCache.set(name, { data: status, expires: now + ttl, fetchedAt: now });
    return status;
  })();
  statusInflight.set(name, request);
  const forget = () => {
    if (statusInflight.get(name) === request) statusInflight.delete(name);
  };
  request.then(forget, forget);
  return request;
}

/** Plain words for a Core resource status. */
export function describeStatus(status: string): string {
  switch (status) {
    case 'READY':
      return 'Downloaded on this node';
    case 'PUBLISHED':
      return 'Published, not downloaded yet';
    case 'DOWNLOADING':
      return 'Fetching from peers';
    case 'DOWNLOADED':
      return 'Downloaded, unpacking';
    case 'BUILDING':
    case 'BUILT':
      return 'Preparing';
    case 'MISSING_DATA':
      return 'Waiting for peers';
    case 'NOT_PUBLISHED':
      return 'Not published yet';
    case 'BUILD_FAILED':
    case 'UNSUPPORTED':
      return 'Cannot be opened';
    default:
      return status ? status.toLowerCase().replace(/_/g, ' ') : 'Unknown';
  }
}
