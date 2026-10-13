/**
 * Registered names by their first letters, for picking a nominee:
 * `GET /names/search?query=<q>&prefix=true&limit=10` (Core 6.1.9's
 * parameters, checked on a node's /openapi.json on 2026-10-12; the match
 * ignores case). One small page per query, never more, cached for the
 * session and shared while in flight. Screens debounce the typing. Ready to
 * mint's search resolves a typed name to its owners with findNameOwners.
 */
import { getNameOwner, isAddress } from './accounts';
import { getJson, query } from './core';
import { fetchQuery } from './query';

export interface NameHit {
  name: string;
  /** The address that owns the name (the nominee). */
  owner: string;
}

/** Shorter queries match too much to be useful. */
export const NAME_SEARCH_MIN = 2;
export const NAME_SEARCH_LIMIT = 10;
/** Core keeps names short; anything longer can't be one. */
const QUERY_MAX = 80;

/** The cache key of findNameOwners for `text`, or null when the text is too short or long to search. */
export function nameMatchKey(text: string): string | null {
  const q = text.trim();
  if (q.length < NAME_SEARCH_MIN || q.length > QUERY_MAX) return null;
  return `namematch:${q.toLowerCase()}`;
}

/**
 * The addresses that own a name matching `text`: the names that start with
 * it (searchNames' one small page), plus the exact name looked up on its own
 * (`GET /names/{name}`) only when that page is full and doesn't have it.
 * Kept per query for the session, like the searches it is made of.
 */
export function findNameOwners(text: string): Promise<string[]> {
  const key = nameMatchKey(text);
  if (!key) return Promise.resolve([]);
  const q = text.trim();
  return fetchQuery(
    key,
    async () => {
      const hits = await searchNames(q);
      const owners = new Set(hits.map((hit) => hit.owner));
      const listed = hits.some((hit) => hit.name.toLowerCase() === q.toLowerCase());
      if (!listed && hits.length >= NAME_SEARCH_LIMIT) {
        const owner = await getNameOwner(q);
        if (owner) owners.add(owner);
      }
      return [...owners];
    },
    { ttlMs: 5 * 60_000 }
  );
}

/** Names starting with `text` (any case), at most `limit`. Empty for short or blank input. */
export function searchNames(text: string, limit = NAME_SEARCH_LIMIT): Promise<NameHit[]> {
  const q = text.trim();
  if (q.length < NAME_SEARCH_MIN || q.length > QUERY_MAX) return Promise.resolve([]);
  const size = Math.max(1, Math.min(limit, 20));
  return fetchQuery(
    `namesearch:${size}:${q.toLowerCase()}`,
    async () => {
      const body = await getJson<unknown>(
        `/names/search?${query({ query: q, prefix: true, limit: size, offset: 0 })}`
      );
      const rows = Array.isArray(body) ? body : [];
      const hits: NameHit[] = [];
      const seen = new Set<string>();
      for (const row of rows) {
        const name = (row as { name?: unknown })?.name;
        const owner = (row as { owner?: unknown })?.owner;
        if (typeof name !== 'string' || !name || !isAddress(owner) || seen.has(name)) continue;
        seen.add(name);
        hits.push({ name, owner });
      }
      return hits.slice(0, size);
    },
    { ttlMs: 5 * 60_000 }
  );
}
