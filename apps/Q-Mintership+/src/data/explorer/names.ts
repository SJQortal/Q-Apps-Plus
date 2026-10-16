/**
 * Names that contain some text, for the Explorer's "No one has the name “q”"
 * answer: `GET /names/search?query=<q>&prefix=false&limit=10` (Core matches
 * anywhere in the name, ignoring case). One small page, cached for the
 * session under its own key.
 */
import { isAddress } from '../accounts';
import { getJson, query } from '../core';
import type { NameHit } from '../nameSearch';
import { fetchQuery } from '../query';

export const NAME_CONTAINS_LIMIT = 10;
const QUERY_MAX = 80;

/** The cache key for `text` (Core's match ignores case, so one key per spelling). */
export function nameContainsKey(text: string): string {
  return `xnamecontains:${text.trim().toLowerCase()}`;
}

export function searchNamesContaining(text: string): Promise<NameHit[]> {
  const q = text.trim();
  if (!q || q.length > QUERY_MAX) return Promise.resolve([]);
  return fetchQuery(
    nameContainsKey(q),
    async () => {
      const body = await getJson<unknown>(
        `/names/search?${query({ query: q, prefix: false, limit: NAME_CONTAINS_LIMIT, offset: 0 })}`
      );
      const hits: NameHit[] = [];
      const seen = new Set<string>();
      for (const row of Array.isArray(body) ? body : []) {
        const name = (row as { name?: unknown })?.name;
        const owner = (row as { owner?: unknown })?.owner;
        if (typeof name !== 'string' || !name || !isAddress(owner) || seen.has(name)) continue;
        seen.add(name);
        hits.push({ name, owner });
      }
      return hits.slice(0, NAME_CONTAINS_LIMIT);
    },
    { ttlMs: 5 * 60_000 }
  );
}
