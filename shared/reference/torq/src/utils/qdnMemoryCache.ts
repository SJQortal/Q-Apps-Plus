/**
 * Session memory cache for QDN reads. Hub and GO both pay a MessageChannel
 * hop per FETCH/SEARCH, so remembering posts, likes, and votes in RAM makes
 * scrolling a feed feel instant. Hub keeps more entries (more RAM); GO
 * keeps them a bit longer (slower hops).
 */
import { searchOmittingHiddenPublishers } from './hiddenFeed';

export const QDN_BODY_TTL_MS = 480_000;
export const QDN_BODY_TTL_MOBILE_MS = 600_000;
export const QDN_SNAPSHOT_TTL_MS = 180_000;
export const QDN_SNAPSHOT_TTL_MOBILE_MS = 240_000;
export const QDN_MEMORY_LIMIT = 1500;
export const QDN_MEMORY_LIMIT_MOBILE = 600;

export type QdnResourceRef = {
  name?: string;
  service?: string;
  identifier?: string;
};

export type LikeSnapshot = {
  identifier: string;
  resources: unknown[];
};

export type PollVoteSnapshot = {
  userName: string;
  optionId: string;
  timestamp: number;
};

type Timed<T> = { data: T; expires: number };

const fetchCache = new Map<string, Timed<unknown>>();
const fetchInflight = new Map<string, Promise<unknown>>();
const publishCache = new Map<string, Timed<unknown>>();
const publishInflight = new Map<string, Promise<unknown>>();
const likeSnapshots = new Map<string, Timed<LikeSnapshot>>();
const pollSnapshots = new Map<string, Timed<PollVoteSnapshot[]>>();

const WRAPPED = '__torqQdnFetchCache';
const HOST_REQUEST = '__torqQdnHostRequest';

export function isMobileGoClient(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}

export function qdnBodyTtlMs(): number {
  return isMobileGoClient() ? QDN_BODY_TTL_MOBILE_MS : QDN_BODY_TTL_MS;
}

export function qdnSnapshotTtlMs(): number {
  return isMobileGoClient() ? QDN_SNAPSHOT_TTL_MOBILE_MS : QDN_SNAPSHOT_TTL_MS;
}

export function qdnSearchTtlMs(): number {
  return qdnSnapshotTtlMs();
}

export function qdnMemoryLimit(): number {
  return isMobileGoClient() ? QDN_MEMORY_LIMIT_MOBILE : QDN_MEMORY_LIMIT;
}

export function qdnResourceKey(ref: QdnResourceRef): string {
  return `${ref.service || 'DOCUMENT'}:${ref.name || ''}:${ref.identifier || ''}`;
}

function evictOldest<T>(store: Map<string, T>) {
  while (store.size > qdnMemoryLimit()) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

function touch<T>(store: Map<string, T>, key: string, value: T) {
  store.delete(key);
  store.set(key, value);
  evictOldest(store);
}

function remember<T>(store: Map<string, Timed<T>>, key: string, entry: Timed<T>) {
  touch(store, key, entry);
}

function readTimed<T>(store: Map<string, Timed<T>>, key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    store.delete(key);
    return null;
  }
  touch(store, key, hit);
  return hit.data;
}

export function resetQdnMemoryCache() {
  fetchCache.clear();
  fetchInflight.clear();
  publishCache.clear();
  publishInflight.clear();
  likeSnapshots.clear();
  pollSnapshots.clear();
}

export function invalidateQdnResource(ref: QdnResourceRef) {
  const key = qdnResourceKey(ref);
  fetchCache.delete(key);
  fetchInflight.delete(key);
  publishCache.delete(key);
  publishInflight.delete(key);
}

export function invalidateLikeSnapshot(postId: string) {
  if (!postId) return;
  likeSnapshots.delete(postId);
}

export function invalidatePollVotes(postId: string) {
  if (!postId) return;
  pollSnapshots.delete(postId);
}

export function peekLikeSnapshot(postId: string): LikeSnapshot | null {
  if (!postId) return null;
  return readTimed(likeSnapshots, postId);
}

export function writeLikeSnapshot(postId: string, snapshot: LikeSnapshot) {
  if (!postId || !snapshot.identifier) return;
  remember(likeSnapshots, postId, {
    data: {
      identifier: snapshot.identifier,
      resources: Array.isArray(snapshot.resources) ? snapshot.resources : [],
    },
    expires: Date.now() + qdnSnapshotTtlMs(),
  });
}

export function peekPollVotes(postId: string): PollVoteSnapshot[] | null {
  if (!postId) return null;
  return readTimed(pollSnapshots, postId);
}

export function writePollVotes(postId: string, votes: PollVoteSnapshot[]) {
  if (!postId) return;
  remember(pollSnapshots, postId, {
    data: votes.map((vote) => ({ ...vote })),
    expires: Date.now() + qdnSnapshotTtlMs(),
  });
}

export function peekCachedPublish<T = unknown>(ref: QdnResourceRef): T | null {
  if (!ref.identifier) return null;
  return readTimed(publishCache, qdnResourceKey(ref)) as T | null;
}

type QortalRequest = (params: Record<string, unknown>) => Promise<unknown>;
type WrappedRequest = QortalRequest & {
  [WRAPPED]?: boolean;
  [HOST_REQUEST]?: QortalRequest;
};

declare const qortalRequest: QortalRequest | undefined;

/**
 * The host's own qortalRequest. Hub declares it with `const` in a classic
 * script, so it is a global name but not a property of window. Where Torq's
 * wrapper is installed, this is the function underneath it: the wrapper hands
 * a FETCH back to fetchQdnResource, which would then wait on itself.
 */
export function hostQortalRequest(): QortalRequest | null {
  const request =
    typeof qortalRequest === 'function'
      ? qortalRequest
      : (globalThis as unknown as { qortalRequest?: QortalRequest })
          .qortalRequest;
  if (typeof request !== 'function') return null;
  return (request as WrappedRequest)[HOST_REQUEST] ?? request;
}

export async function fetchQdnResource(
  params: Record<string, unknown>,
  fetchImpl?: QortalRequest
): Promise<unknown> {
  const ref = {
    name: typeof params.name === 'string' ? params.name : '',
    service: typeof params.service === 'string' ? params.service : 'DOCUMENT',
    identifier: typeof params.identifier === 'string' ? params.identifier : '',
  };
  const key = qdnResourceKey(ref);
  const cached = readTimed(fetchCache, key);
  if (cached !== null) return cached;

  const pending = fetchInflight.get(key);
  if (pending) return pending;

  const requestFn = fetchImpl || hostQortalRequest();
  if (!requestFn) {
    throw new Error('qortalRequest is not available');
  }

  const request = Promise.resolve()
    .then(() => requestFn({ ...params, action: 'FETCH_QDN_RESOURCE' }))
    .then((data) => {
      remember(fetchCache, key, { data, expires: Date.now() + qdnBodyTtlMs() });
      fetchInflight.delete(key);
      return data;
    })
    .catch((error) => {
      fetchInflight.delete(key);
      throw error;
    });

  fetchInflight.set(key, request);
  return request;
}

export async function cachedFetchPublish<T>(
  fetchPublish: (ref: {
    name: string;
    service: string;
    identifier: string;
  }) => Promise<T>,
  ref: { name: string; service: string; identifier: string }
): Promise<T> {
  const key = qdnResourceKey(ref);
  const cached = readTimed(publishCache, key);
  if (cached !== null) return cached as T;

  const pending = publishInflight.get(key);
  if (pending) return pending as Promise<T>;

  const request = Promise.resolve()
    .then(() => fetchPublish(ref))
    .then((data) => {
      const missed =
        data &&
        typeof data === 'object' &&
        'hasResource' in data &&
        (data as { hasResource?: unknown }).hasResource === false;
      remember(publishCache, key, {
        data,
        expires: Date.now() + (missed ? 8_000 : qdnBodyTtlMs()),
      });
      publishInflight.delete(key);
      return data;
    })
    .catch((error) => {
      publishInflight.delete(key);
      throw error;
    });

  publishInflight.set(key, request);
  return request as Promise<T>;
}

function wrapQortalRequest(original: QortalRequest): QortalRequest {
  if ((original as WrappedRequest)[WRAPPED]) {
    return original;
  }

  const wrapped: QortalRequest = async (params) => {
    const action = typeof params?.action === 'string' ? params.action : '';
    if (action === 'FETCH_QDN_RESOURCE') {
      return fetchQdnResource(params, original);
    }
    if (action === 'SEARCH_QDN_RESOURCES') {
      return searchOmittingHiddenPublishers(original, params);
    }
    const result = await original(params);
    if (action === 'PUBLISH_QDN_RESOURCE' || action === 'DELETE_QDN_RESOURCE') {
      invalidateQdnResource({
        name: typeof params.name === 'string' ? params.name : '',
        service: typeof params.service === 'string' ? params.service : 'DOCUMENT',
        identifier:
          typeof params.identifier === 'string' ? params.identifier : '',
      });
    }
    return result;
  };
  (wrapped as WrappedRequest)[WRAPPED] = true;
  (wrapped as WrappedRequest)[HOST_REQUEST] = original;
  return wrapped;
}

/** Hub can replace qortalRequest after boot. Wrap whatever is there now. */
export function ensureQortalRequestWrapped(): void {
  if (typeof window === 'undefined') return;
  const target = window as Window & { qortalRequest?: QortalRequest };
  const current = target.qortalRequest;
  if (typeof current !== 'function') return;
  if ((current as QortalRequest & { [WRAPPED]?: boolean })[WRAPPED]) return;
  try {
    target.qortalRequest = wrapQortalRequest(current);
  } catch {
    // A frozen bridge cannot be replaced. The list filter still drops rows.
  }
}

export function installQdnFetchCache(): void {
  if (typeof window === 'undefined') return;

  const target = window as Window & { qortalRequest?: QortalRequest };
  ensureQortalRequestWrapped();

  try {
    let value = target.qortalRequest;
    Object.defineProperty(target, 'qortalRequest', {
      configurable: true,
      enumerable: true,
      get() {
        return value;
      },
      set(next: QortalRequest) {
        value = typeof next === 'function' ? wrapQortalRequest(next) : next;
      },
    });
  } catch {
    // Some hosts freeze qortalRequest after injection; FETCH still caches
    // through fetchQdnResource() callers.
  }
}
