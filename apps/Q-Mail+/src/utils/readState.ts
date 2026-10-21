/**
 * Local read/unread state for mail, keyed by message identifier and kept per
 * account address in localStorage (`qmail_read_state_<address>`).
 *
 * This replaces the synthetic `generalData.threadV2` marker as the source of
 * truth for "is this message read?". The marker is still injected into list
 * copies so the existing row components keep rendering read state, and the
 * published `qmail_state_v1` document still merges `read: true` entries from
 * this store (and loading the document applies into it).
 *
 * Entry values: a positive number is the time (ms) the message was read; `0`
 * means the user marked it unread on purpose, which overrides the compatibility
 * rule below. With no entry, a message counts as read when it carries a
 * non-empty `generalData.threadV2`, which is how the original Q-Mail marks
 * read (a reply arrives with its history and shows as read there too).
 */

export const READ_STATE_STORAGE_PREFIX = "qmail_read_state_";
/** Oldest entries are dropped past this many; mail older than that just shows unread. */
export const READ_STATE_MAX_ENTRIES = 3000;

/** identifier → readAt (ms, > 0) or 0 for "explicitly unread". */
export type ReadStateMap = Record<string, number>;

const normalizeAddress = (address?: string | null): string => {
  return typeof address === "string" ? address.trim() : "";
};

export const getReadStateStorageKey = (address?: string | null): string => {
  const normalized = normalizeAddress(address);
  return normalized ? `${READ_STATE_STORAGE_PREFIX}${normalized}` : "";
};

export const getMailMessageId = (message: any): string => {
  const value = message?.id ?? message?.identifier;
  if (value === undefined || value === null) return "";
  return String(value);
};

/** True when the message carries a non-empty `generalData.threadV2` (real reply history or the local marker). */
export const hasThreadHistory = (message: any): boolean => {
  const thread = message?.generalData?.threadV2;
  return Array.isArray(thread) && thread.length > 0;
};

/** Keep the newest `max` entries (explicit-unread zeros are kept last). */
export const pruneReadState = (
  map: ReadStateMap,
  max: number = READ_STATE_MAX_ENTRIES
): ReadStateMap => {
  const entries = Object.entries(map);
  if (entries.length <= max) return map;
  entries.sort((a, b) => b[1] - a[1]);
  const pruned: ReadStateMap = {};
  entries.slice(0, max).forEach(([id, at]) => {
    pruned[id] = at;
  });
  return pruned;
};

export const readReadStateFromStorage = (
  address?: string | null
): ReadStateMap => {
  const key = getReadStateStorageKey(address);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const map: ReadStateMap = {};
    Object.entries(parsed).forEach(([id, value]) => {
      if (!id) return;
      const at = Number(value);
      if (!Number.isFinite(at) || at < 0) return;
      map[id] = at;
    });
    return map;
  } catch {
    return {};
  }
};

export const writeReadStateToStorage = (
  address: string | null | undefined,
  map: ReadStateMap
): void => {
  const key = getReadStateStorageKey(address);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(pruneReadState(map)));
  } catch {
    // Ignore storage failures (private mode, quota).
  }
};

/** Pure: a new map with `ids` marked read at `at`. Returns `map` itself when nothing changes. */
export const withMessagesRead = (
  map: ReadStateMap,
  ids: string[],
  at: number = Date.now()
): ReadStateMap => {
  let next: ReadStateMap | null = null;
  ids.forEach(id => {
    if (!id) return;
    const current = map[id];
    if (typeof current === "number" && current > 0) return;
    if (!next) next = { ...map };
    next[id] = at;
  });
  return next || map;
};

/** Pure: a new map with `ids` explicitly unread (value 0). Returns `map` itself when nothing changes. */
export const withMessagesUnread = (
  map: ReadStateMap,
  ids: string[]
): ReadStateMap => {
  let next: ReadStateMap | null = null;
  ids.forEach(id => {
    if (!id) return;
    if (map[id] === 0) return;
    if (!next) next = { ...map };
    next[id] = 0;
  });
  return next || map;
};

/**
 * Pure: apply `read: true` entries loaded from the published document. Only
 * fills ids the user has made no local decision about, so an explicit local
 * "unread" survives a load.
 */
export const withPublishedReadState = (
  map: ReadStateMap,
  ids: string[],
  at: number = Date.now()
): ReadStateMap => {
  let next: ReadStateMap | null = null;
  ids.forEach(id => {
    if (!id) return;
    if (typeof map[id] === "number") return;
    if (!next) next = { ...map };
    next[id] = at;
  });
  return next || map;
};

/** The read decision for one message id (see the module comment). */
export const isMessageIdRead = (
  id: string,
  readState: ReadStateMap,
  fallbackMessage?: any
): boolean => {
  const entry = readState[id];
  if (typeof entry === "number") return entry > 0;
  return hasThreadHistory(fallbackMessage);
};

export const isMessageRead = (message: any, readState: ReadStateMap): boolean => {
  const id = getMailMessageId(message);
  if (!id) return hasThreadHistory(message);
  return isMessageIdRead(id, readState, message);
};

/** Ids that are read because of a store entry (> 0), as a Set for list helpers. */
export const readIdsFromState = (readState: ReadStateMap): Set<string> => {
  const ids = new Set<string>();
  Object.entries(readState).forEach(([id, at]) => {
    if (at > 0) ids.add(id);
  });
  return ids;
};

export const countUnreadMessages = (
  messages: any[] | null | undefined,
  readState: ReadStateMap,
  excludeIds?: Set<string> | Record<string, unknown>
): number => {
  if (!Array.isArray(messages) || !messages.length) return 0;
  const isExcluded = (id: string): boolean => {
    if (!excludeIds) return false;
    if (excludeIds instanceof Set) return excludeIds.has(id);
    return Object.prototype.hasOwnProperty.call(excludeIds, id);
  };
  const seen = new Set<string>();
  let unread = 0;
  messages.forEach(message => {
    const id = getMailMessageId(message);
    if (!id || seen.has(id)) return;
    seen.add(id);
    if (isExcluded(id)) return;
    if (!isMessageIdRead(id, readState, message)) unread += 1;
  });
  return unread;
};
