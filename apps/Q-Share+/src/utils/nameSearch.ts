/**
 * Name suggestions for the publisher filter, after Torq's user search
 * (utils/mentionSearch.ts): a prefix search and a "contains" search on Core's
 * `/names/search`, merged, de-duplicated and ranked here.
 *
 * Core is asked directly rather than through q-apps.js SEARCH_NAMES, which
 * puts the query into its URL unencoded: a name with `+`, `&` or `#` searched
 * for something else. URLSearchParams encodes it.
 *
 * Core matches names case-insensitively, so answers are cached per lower-cased
 * query for the session, and identical searches in flight share one request.
 */

import { avatarUrl } from "./qortalLinks";

export const NAME_SEARCH_DEBOUNCE_MS = 220;
export const NAME_SEARCH_PREFIX_LIMIT = 20;
export const NAME_SEARCH_CONTAINS_LIMIT = 40;
/** Suggestions shown at most. */
export const NAME_SUGGESTION_LIMIT = 10;
/** Queries remembered; the oldest go first. */
const CACHE_MAX = 200;

const cache = new Map<string, string[]>();
const inflight = new Map<string, Promise<string[]>>();

const cacheKey = (query: string) => query.trim().toLowerCase();

export function nameSearchUrl(query: string, prefix: boolean, limit: number): string {
  const params = new URLSearchParams();
  params.set("query", query);
  params.set("prefix", String(prefix));
  params.set("limit", String(limit));
  params.set("offset", "0");
  return `/names/search?${params.toString()}`;
}

/** Core answers `[{ name, owner, … }]`; plain strings are accepted too. */
export function parseNameSearchResults(response: unknown): string[] {
  if (!Array.isArray(response)) return [];
  const names: string[] = [];
  for (const entry of response) {
    const name = typeof entry === "string" ? entry : (entry as { name?: unknown } | null)?.name;
    if (typeof name === "string" && name.trim()) names.push(name);
  }
  return names;
}

/** Names in their first spelling, without case-insensitive repeats. */
function uniqueNames(names: string[]): string[] {
  const unique = new Map<string, string>();
  for (const name of names) {
    if (!name?.trim()) continue;
    const key = name.toLowerCase();
    if (!unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}

async function fetchNames(url: string): Promise<string[]> {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) throw new Error(`Name search failed (${response.status})`);
  return parseNameSearchResults(await response.json());
}

/** This session's answer for `query`, if it has one. */
export function cachedNameSearch(query: string): string[] | undefined {
  return cache.get(cacheKey(query));
}

/**
 * Registered names matching `query`: the prefix search's names first, then
 * the contains search's. Rejects only when both searches fail; an answer with
 * one of them missing is returned but not cached, so the next try asks again.
 */
export function searchNames(query: string): Promise<string[]> {
  const trimmed = query.trim();
  const key = cacheKey(trimmed);
  if (!key) return Promise.resolve([]);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const [prefix, contains] = await Promise.allSettled([
      fetchNames(nameSearchUrl(trimmed, true, NAME_SEARCH_PREFIX_LIMIT)),
      fetchNames(nameSearchUrl(trimmed, false, NAME_SEARCH_CONTAINS_LIMIT)),
    ]);
    if (prefix.status === "rejected" && contains.status === "rejected") throw prefix.reason;
    const names = uniqueNames([
      ...(prefix.status === "fulfilled" ? prefix.value : []),
      ...(contains.status === "fulfilled" ? contains.value : []),
    ]);
    if (prefix.status === "fulfilled" && contains.status === "fulfilled") {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
      cache.set(key, names);
    }
    return names;
  })();

  inflight.set(key, request);
  const forget = () => {
    if (inflight.get(key) === request) inflight.delete(key);
  };
  request.then(forget, forget);
  return request;
}

/** The names that contain `query`, ignoring case (all of them for an empty query). */
export function namesContaining(names: string[], query: string): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return names;
  return names.filter((name) => name.toLowerCase().includes(needle));
}

/**
 * Up to `limit` suggestions for `query`: the exact name, then names that start
 * with it, then names seen publishing in the list on screen (they certainly
 * have shares), then the other names that contain it, then whatever else Core
 * matched. Within a group seen names come first, then shorter names, then A–Z.
 * With no query, the seen names in the order given.
 */
export function rankNameSuggestions(
  names: string[],
  query: string,
  seenNames: string[] = [],
  limit = NAME_SUGGESTION_LIMIT
): string[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return uniqueNames(seenNames).slice(0, limit);
  const seen = new Set(seenNames.map((name) => name.toLowerCase()));
  const group = (lower: string) => {
    if (lower === needle) return 0;
    if (lower.startsWith(needle)) return 1;
    if (seen.has(lower)) return 2;
    return lower.includes(needle) ? 3 : 4;
  };
  return uniqueNames(names)
    .map((name) => {
      const lower = name.toLowerCase();
      return { name, group: group(lower), seen: seen.has(lower) };
    })
    .sort(
      (a, b) =>
        a.group - b.group ||
        Number(b.seen) - Number(a.seen) ||
        a.name.length - b.name.length ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit)
    .map((item) => item.name);
}

/** `name` cut into the parts that match `query` (ignoring case) and the rest, for highlighting. */
export function splitNameHighlight(name: string, query: string): Array<{ text: string; match: boolean }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text: name, match: false }];
  const lower = name.toLowerCase();
  // toLowerCase can change a string's length (e.g. "İ"): then show it plain.
  if (lower.length !== name.length) return [{ text: name, match: false }];
  const parts: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  while (cursor < name.length) {
    const found = lower.indexOf(needle, cursor);
    if (found === -1) {
      parts.push({ text: name.slice(cursor), match: false });
      break;
    }
    if (found > cursor) parts.push({ text: name.slice(cursor, found), match: false });
    parts.push({ text: name.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
  }
  return parts;
}

/**
 * A suggestion's avatar, asked for with `async=true` as Torq does: an avatar
 * that isn't on the node yet answers 404 at once (Core fetches it in the
 * background) instead of holding the connection while Core retries its peers,
 * which would stall the name and share searches behind it.
 */
export function suggestionAvatarUrl(name: string): string {
  return `${avatarUrl(name)}?async=true`;
}

/** How long a name whose avatar just failed shows its initial without asking again. */
export const MISSING_AVATAR_RETRY_MS = 2 * 60_000;
const MISSING_AVATARS_MAX = 500;
const missingAvatars = new Map<string, number>();

/** The avatar for `name` failed; the next rows for it show the initial straight away for a while. */
export function rememberMissingAvatar(name: string, now = Date.now()): void {
  missingAvatars.delete(name);
  if (missingAvatars.size >= MISSING_AVATARS_MAX) missingAvatars.delete(missingAvatars.keys().next().value!);
  missingAvatars.set(name, now);
}

/** True while `name`'s avatar is known to be missing (a later try may find it downloaded). */
export function avatarKnownMissing(name: string, now = Date.now()): boolean {
  const failedAt = missingAvatars.get(name);
  if (failedAt === undefined) return false;
  if (now - failedAt < MISSING_AVATAR_RETRY_MS) return true;
  missingAvatars.delete(name);
  return false;
}

/** For tests. */
export function resetNameSearchCache(): void {
  cache.clear();
  inflight.clear();
  missingAvatars.clear();
}
