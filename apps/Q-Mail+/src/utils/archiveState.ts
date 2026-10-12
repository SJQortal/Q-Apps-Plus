/**
 * Local archive for received mail, keyed by message identifier and kept per
 * account address in localStorage (`qmail_archived_<address>`). Archiving is a
 * view filter only: nothing is published or deleted on QDN, and the original
 * Q-Mail still shows the message. The set is synced through the published
 * `qmail_state_v1` document as a NEW top-level map (`archived`), which the
 * original app ignores (it only reads `messages`).
 */

export const ARCHIVED_STORAGE_PREFIX = "qmail_archived_";
export const ARCHIVED_MAX_ENTRIES = 3000;

export interface ArchivedEntry {
  /** When the message was archived (ms). */
  at: number;
}

/** identifier → entry. */
export type ArchivedMap = Record<string, ArchivedEntry>;

const normalizeAddress = (address?: string | null): string => {
  return typeof address === "string" ? address.trim() : "";
};

export const getArchivedStorageKey = (address?: string | null): string => {
  const normalized = normalizeAddress(address);
  return normalized ? `${ARCHIVED_STORAGE_PREFIX}${normalized}` : "";
};

/** Accepts any object and keeps only `{ id: { at: number } }` entries. */
export const normalizeArchivedMap = (value: unknown): ArchivedMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const map: ArchivedMap = {};
  Object.entries(value as Record<string, unknown>).forEach(([id, entry]) => {
    if (!id) return;
    const at = Number((entry as any)?.at);
    if (!Number.isFinite(at) || at <= 0) return;
    map[id] = { at };
  });
  return map;
};

export const pruneArchived = (
  map: ArchivedMap,
  max: number = ARCHIVED_MAX_ENTRIES
): ArchivedMap => {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort((a, b) => b[1].at - a[1].at);
  const pruned: ArchivedMap = {};
  entries.slice(0, max).forEach(([id, entry]) => {
    pruned[id] = entry;
  });
  return pruned;
};

export const readArchivedFromStorage = (
  address?: string | null
): ArchivedMap => {
  const key = getArchivedStorageKey(address);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return normalizeArchivedMap(JSON.parse(raw));
  } catch {
    return {};
  }
};

export const writeArchivedToStorage = (
  address: string | null | undefined,
  map: ArchivedMap
): void => {
  const key = getArchivedStorageKey(address);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(pruneArchived(map)));
  } catch {
    // Ignore storage failures.
  }
};

export const isArchivedId = (map: ArchivedMap, id: string): boolean => {
  return Boolean(id) && Object.prototype.hasOwnProperty.call(map, id);
};

/** Pure: archive `ids` at `at`; returns `map` itself when nothing changes. */
export const withArchived = (
  map: ArchivedMap,
  ids: string[],
  at: number = Date.now()
): ArchivedMap => {
  let next: ArchivedMap | null = null;
  ids.forEach(id => {
    if (!id || isArchivedId(map, id)) return;
    if (!next) next = { ...map };
    next[id] = { at };
  });
  return next || map;
};

/** Pure: unarchive `ids`; returns `map` itself when nothing changes. */
export const withUnarchived = (map: ArchivedMap, ids: string[]): ArchivedMap => {
  let next: ArchivedMap | null = null;
  ids.forEach(id => {
    if (!id || !isArchivedId(map, id)) return;
    if (!next) next = { ...map };
    delete next[id];
  });
  return next || map;
};

/**
 * Pure: merge a loaded document's `archived` map into the local one. Local
 * entries win; ids only the document knows are added with the document's time.
 */
export const withPublishedArchived = (
  map: ArchivedMap,
  published: ArchivedMap
): ArchivedMap => {
  let next: ArchivedMap | null = null;
  Object.entries(published).forEach(([id, entry]) => {
    if (!id || isArchivedId(map, id)) return;
    if (!next) next = { ...map };
    next[id] = { at: entry.at };
  });
  return next || map;
};

/** True when the two maps archive the same ids (times are ignored). */
export const haveSameArchivedIds = (a: ArchivedMap, b: ArchivedMap): boolean => {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every(id => isArchivedId(b, id));
};
