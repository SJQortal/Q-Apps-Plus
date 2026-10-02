/**
 * Avatar URLs, one GET_QDN_RESOURCE_URL per name per session (docs/QORTAL.md
 * → Efficiency rules 5 and 6; Bugs #7).
 *
 * - names are keyed case-insensitively, so "Alice" and "alice" share a request;
 * - identical requests in flight share one promise;
 * - a miss (Hub answers "Resource does not exist", or nothing) is remembered
 *   as `null`, so the row never asks again this session;
 * - `useLazyAvatarUrl` resolves only when the element is on screen
 *   (IntersectionObserver; immediately where it does not exist), and never
 *   per message resource on load. It also hands out no URL at all, known or
 *   not, until the element has been in view: MUI's Avatar starts loading its
 *   `src` on mount whatever `loading="lazy"` says, so a long list would
 *   otherwise fetch every known avatar at once (docs/QORTAL.md pitfall 5).
 *
 * The Redux `userAvatarHash` is kept as a read-through: anything other code
 * stores there is primed here, and what resolves here is handed back to it.
 */
import { useEffect, useState } from 'react';

export const AVATAR_MISS_SENTINEL = 'Resource does not exist';

const urls = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Set<(name: string, url: string | null) => void>();
let stats = { requests: 0, hits: 0, merged: 0, misses: 0 };

function keyFor(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase();
}

/** True for a usable avatar URL; false for the miss sentinel, empty strings and non-strings. */
export function isAvatarUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === AVATAR_MISS_SENTINEL) return false;
  if (/resource does not exist/i.test(trimmed)) return false;
  return true;
}

/** `string` = known URL, `null` = known miss, `undefined` = not asked yet. */
export function peekAvatarUrl(name: string | undefined | null): string | null | undefined {
  const key = keyFor(name || '');
  if (!key) return null;
  return urls.get(key);
}

/** Record a URL learnt elsewhere (e.g. the Redux hash) so no request is made for it. */
export function primeAvatarUrl(name: string, url: unknown): void {
  const key = keyFor(name);
  if (!key) return;
  if (isAvatarUrl(url)) {
    if (urls.get(key) !== url) {
      urls.set(key, url);
      listeners.forEach((l) => l(name, url));
    }
  }
}

function emit(name: string, url: string | null) {
  listeners.forEach((l) => l(name, url));
}

export function getAvatarUrl(name: string | undefined | null): Promise<string | null> {
  const key = keyFor(name || '');
  if (!key) return Promise.resolve(null);
  stats.requests += 1;
  const known = urls.get(key);
  if (known !== undefined) {
    stats.hits += 1;
    return Promise.resolve(known);
  }
  const running = inFlight.get(key);
  if (running) {
    stats.merged += 1;
    return running;
  }
  const task = (async () => {
    let url: string | null = null;
    try {
      const res = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: String(name).trim(),
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar',
      });
      url = isAvatarUrl(res) ? res : null;
    } catch {
      url = null;
    }
    if (url === null) stats.misses += 1;
    urls.set(key, url);
    emit(String(name), url);
    return url;
  })();
  inFlight.set(key, task);
  task.finally(() => inFlight.delete(key)).catch(() => undefined);
  return task;
}

export function subscribeAvatars(listener: (name: string, url: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function avatarCacheStats() {
  return { ...stats, known: urls.size, inFlight: inFlight.size };
}

export function resetAvatarCache(): void {
  urls.clear();
  inFlight.clear();
  listeners.clear();
  stats = { requests: 0, hits: 0, merged: 0, misses: 0 };
}

/**
 * The avatar URL for `name`, resolved once `node` is visible. Returns '' while
 * unknown or for a miss. `known` short-circuits with a URL learnt elsewhere.
 */
export function useLazyAvatarUrl(name: string | undefined | null, node: Element | null, known?: unknown): string {
  const key = keyFor(name || '');
  const knownUrl = isAvatarUrl(known) ? known : '';
  const [visible, setVisible] = useState<boolean>(() => typeof IntersectionObserver === 'undefined');
  // A known URL is handed out only once the element has been in view (see above).
  const [url, setUrl] = useState<string>(() => (visible ? knownUrl || peekAvatarUrl(name) || '' : ''));

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    // The ref callback sets `node` after the first render: wait for it rather
    // than calling an element visible that has not been observed yet.
    if (!node) return;
    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setVisible(true);
            observer?.disconnect();
          }
        },
        { rootMargin: '200px' }
      );
      observer.observe(node);
    } catch {
      setVisible(true);
    }
    return () => observer?.disconnect();
  }, [node]);

  useEffect(() => {
    if (!key) {
      setUrl('');
      return;
    }
    if (knownUrl) primeAvatarUrl(key, knownUrl);
    if (!visible) {
      setUrl('');
      return;
    }
    if (knownUrl) {
      setUrl(knownUrl);
      return;
    }
    const peeked = peekAvatarUrl(key);
    if (peeked !== undefined) {
      setUrl(peeked || '');
      return;
    }
    setUrl('');
    let cancelled = false;
    void getAvatarUrl(name).then((resolved) => {
      if (!cancelled) setUrl(resolved || '');
    });
    return () => {
      cancelled = true;
    };
  }, [key, knownUrl, visible, name]);

  return url;
}
