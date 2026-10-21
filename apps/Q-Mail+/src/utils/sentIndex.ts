/**
 * The sent-mail index of one or more owned names: the two paged searches the
 * original app runs per name (`_mail_qortal_qmail_` with identifier `_mail_`,
 * and the legacy `qortal_qmail_`), byte-for-byte the same params, through
 * `searchResources()` so identical searches merge and cache for the session.
 *
 * `fetchSentDelta` is the polite poll: one limit-20 page per name and query,
 * newest first, always to the node (TTL 0); it stops at the first known id.
 *
 * Tombstones (`__qmail_deleted__` / tag `qmail-deleted`) and locally deleted
 * ids are filtered out here exactly as SentMail did.
 */
import { MAIL_SERVICE_TYPE } from "../constants/mail";
import { isSentMailIdentifier } from "../pages/Mail/mailIdentifier";
import { isDeletedSentResourceInSearch, mapMailResources, type MailListRow } from "./mailInbox";
import { searchResources, type SearchOptions } from "./qdnSearch";

export const SENT_DELETED_TITLE = "__qmail_deleted__";
export const SENT_DELETED_TAG = "qmail-deleted";
const LEGACY_SENT_QUERY = "qortal_qmail_";
const SENT_PAGE_SIZE = 200;
const SENT_DELTA_LIMIT = 20;

type SentQueryConfig = {
  query: string;
  identifier?: string;
  matchesIdentifier: (identifier: string) => boolean;
};

export const SENT_QUERY_CONFIGS: SentQueryConfig[] = [
  {
    query: "_mail_qortal_qmail_",
    identifier: "_mail_",
    matchesIdentifier: identifier => {
      return identifier.toLowerCase().startsWith("_mail_qortal_qmail_");
    },
  },
  {
    query: LEGACY_SENT_QUERY,
    matchesIdentifier: identifier => {
      return identifier.toLowerCase().startsWith(LEGACY_SENT_QUERY);
    },
  },
];

const toStringOrEmpty = (value: any): string => {
  return typeof value === "string" ? value.trim() : "";
};

export const getDeletedSentStorageKey = (username: string): string => {
  return `qmail_deleted_sent_${username}`;
};

export const readDeletedSentIds = (username: string): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(getDeletedSentStorageKey(username));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    return parsed.reduce<Record<string, boolean>>((accumulator, identifier) => {
      const value = toStringOrEmpty(identifier);
      if (value) accumulator[value] = true;
      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

export const writeDeletedSentIds = (
  username: string,
  deletedIds: Record<string, boolean>
): void => {
  try {
    localStorage.setItem(
      getDeletedSentStorageKey(username),
      JSON.stringify(Object.keys(deletedIds))
    );
  } catch {
    // Ignore storage failures in private browsing or restricted environments.
  }
};

/** Deleted ids remembered for every name, merged. */
export const readDeletedSentIdsForNames = (names: string[]): Record<string, boolean> => {
  const merged: Record<string, boolean> = {};
  names.forEach(name => {
    Object.keys(readDeletedSentIds(name)).forEach(identifier => {
      merged[identifier] = true;
    });
  });
  return merged;
};

export const shouldHideSentResource = (
  resource: any,
  locallyDeletedIds: Record<string, boolean>
): boolean => {
  const identifier = toStringOrEmpty(resource?.identifier);
  if (identifier && locallyDeletedIds[identifier]) return true;
  return isDeletedSentResourceInSearch(resource);
};

const buildParams = (
  name: string,
  queryConfig: SentQueryConfig,
  limit: number,
  offset: number
): URLSearchParams => {
  const params = new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: queryConfig.query,
    name,
    exactmatchnames: "true",
    limit: String(limit),
    includemetadata: "true",
    offset: String(offset),
    reverse: "true",
    excludeblocked: "true",
  });
  if (queryConfig.identifier) {
    params.set("identifier", queryConfig.identifier);
  }
  return params;
};

const visibleSentResources = (
  responseData: any[],
  queryConfig: SentQueryConfig,
  deletedIds: Record<string, boolean>
): any[] => {
  return responseData.filter(resource => {
    const identifier = toStringOrEmpty(resource?.identifier);
    if (!identifier) return false;
    if (!queryConfig.matchesIdentifier(identifier)) return false;
    if (!isSentMailIdentifier(identifier)) return false;
    return !shouldHideSentResource(resource, deletedIds);
  });
};

const sortByCreatedDescending = (a: any, b: any) => {
  return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
};

const dedupe = (rows: MailListRow[], deletedIds: Record<string, boolean>): MailListRow[] => {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row?.id || seen.has(row.id) || deletedIds[row.id]) return false;
    seen.add(row.id);
    return true;
  });
};

/** The whole sent index of `names` (both queries, 200 per page, to exhaustion), newest first. */
export const fetchSentIndex = async (
  names: string[],
  deletedIds: Record<string, boolean> = {},
  options?: SearchOptions
): Promise<MailListRow[]> => {
  const allResources: any[] = [];
  for (const name of names) {
    if (!name) continue;
    for (const queryConfig of SENT_QUERY_CONFIGS) {
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const responseData = await searchResources(
          buildParams(name, queryConfig, SENT_PAGE_SIZE, offset),
          options
        );
        if (!responseData.length) break;
        allResources.push(...visibleSentResources(responseData, queryConfig, deletedIds));
        if (responseData.length < SENT_PAGE_SIZE) {
          hasMore = false;
        } else {
          offset += responseData.length;
        }
      }
    }
  }
  const rows = dedupe(mapMailResources(allResources), deletedIds);
  rows.sort(sortByCreatedDescending);
  return rows;
};

/**
 * Newest sent mail the index does not know yet: one limit-20 page per name
 * and query (TTL 0), cut at the first known id. Returns the fresh rows, newest
 * first; the caller prepends them.
 */
export const fetchSentDelta = async (
  names: string[],
  knownIds: Set<string>,
  deletedIds: Record<string, boolean> = {}
): Promise<MailListRow[]> => {
  const fresh: any[] = [];
  for (const name of names) {
    if (!name) continue;
    for (const queryConfig of SENT_QUERY_CONFIGS) {
      const responseData = await searchResources(
        buildParams(name, queryConfig, SENT_DELTA_LIMIT, 0),
        { ttlMs: 0 }
      );
      for (const resource of visibleSentResources(responseData, queryConfig, deletedIds)) {
        const identifier = toStringOrEmpty(resource?.identifier);
        if (knownIds.has(identifier)) break;
        fresh.push(resource);
      }
    }
  }
  const rows = dedupe(mapMailResources(fresh), deletedIds).filter(row => !knownIds.has(row.id));
  rows.sort(sortByCreatedDescending);
  return rows;
};
