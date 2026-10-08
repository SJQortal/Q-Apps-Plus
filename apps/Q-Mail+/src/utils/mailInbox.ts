/**
 * Inbox / sent / alias / group probes and index fetches used by Mail.tsx. The
 * queries are byte-for-byte the original app's (docs/apps/Q-Mail+.md → Data
 * contract §3b, Qortal call inventory I4–I10); the only change is that every
 * search goes through `searchResources()` so identical searches in flight are
 * merged and results are cached for the session.
 */
import { MAIL_SERVICE_TYPE, THREAD_SERVICE_TYPE } from "../constants/mail";
import { isSentMailIdentifier } from "../pages/Mail/mailIdentifier";
import { searchResources, type SearchOptions } from "./qdnSearch";

export interface MailListRow {
  title?: string;
  category?: string;
  categoryName?: string;
  tags: string[];
  description?: string;
  createdAt: number | string;
  updated?: number | string;
  user: string;
  id: string;
}

export const mapMailResources = (resources: any[]): MailListRow[] => {
  return resources.map((post: any): MailListRow => {
    return {
      title: post?.metadata?.title,
      category: post?.metadata?.category,
      categoryName: post?.metadata?.categoryName,
      tags: post?.metadata?.tags || [],
      description: post?.metadata?.description,
      createdAt: post?.created,
      updated: post?.updated,
      user: post?.name,
      id: post?.identifier,
    };
  });
};

const normalizeId = (value: string | number | null | undefined): string => {
  return typeof value === "number"
    ? String(value)
    : typeof value === "string"
    ? value.trim()
    : "";
};

/** True when a search returns at least one row (that `matcher` accepts). Errors count as "no". */
export const fetchHasMailResources = async (
  params: URLSearchParams,
  matcher?: (item: any) => boolean,
  options?: SearchOptions
): Promise<boolean> => {
  try {
    const responseData = await searchResources(params, options);
    if (!responseData.length) return false;
    if (!matcher) return true;
    return responseData.some(matcher);
  } catch {
    return false;
  }
};

export const hasGroupThreadActivity = async (
  groupId: string | number
): Promise<boolean> => {
  const normalizedGroupId = normalizeId(groupId);
  if (!normalizedGroupId) return false;

  // Exactly the first header page the Threads views and the unread badges
  // fetch next (threadHeaderSearchParams), so this probe is that page: one
  // search shared in flight or from the cache, not an extra one.
  const params = new URLSearchParams({
    mode: "ALL",
    service: THREAD_SERVICE_TYPE,
    query: `qortal_qmail_thread_group${normalizedGroupId}`,
    limit: "20",
    includemetadata: "true",
    offset: "0",
    reverse: "true",
    excludeblocked: "true",
  });
  // The substring query also matches groups 10-19 and 100+.
  const prefix = `qortal_qmail_thread_group${normalizedGroupId}_`;
  return fetchHasMailResources(
    params,
    item => typeof item?.identifier === "string" && item.identifier.startsWith(prefix)
  );
};

export const fetchGroupAvatarPublisherName = async (
  groupId: string | number
): Promise<string | null> => {
  const normalizedGroupId = normalizeId(groupId);
  if (!normalizedGroupId) return null;

  try {
    const params = new URLSearchParams({
      mode: "ALL",
      service: "THUMBNAIL",
      identifier: `qortal_group_avatar_${normalizedGroupId}`,
      limit: "1",
      reverse: "true",
      excludeblocked: "true",
    });
    const responseData = await searchResources(params);
    if (!responseData.length) return null;
    const publisherName =
      typeof responseData[0]?.name === "string"
        ? responseData[0].name.trim()
        : "";
    return publisherName || null;
  } catch {
    return null;
  }
};

const groupAvatarUrls = new Map<string, Promise<string>>();

/** Tests only: forget the group avatar answers of this session. */
export const resetGroupAvatarCache = (): void => {
  groupAvatarUrls.clear();
};

/**
 * A group's avatar URL ("" when it has none), asked once per group per
 * session: calls for the same group while one is running share it. The
 * Threads loop re-ran while a request was out and asked twice (groups 694
 * and 659 on Simon's account).
 */
export const fetchGroupAvatarUrl = (groupId: string | number): Promise<string> => {
  const normalizedGroupId = normalizeId(groupId);
  if (!normalizedGroupId) return Promise.resolve("");
  const known = groupAvatarUrls.get(normalizedGroupId);
  if (known) return known;
  const request = askGroupAvatarUrl(normalizedGroupId);
  groupAvatarUrls.set(normalizedGroupId, request);
  return request;
};

const askGroupAvatarUrl = async (normalizedGroupId: string): Promise<string> => {
  const publisherName = await fetchGroupAvatarPublisherName(normalizedGroupId);
  if (!publisherName) return "";

  try {
    const avatarUrl = await qortalRequest({
      action: "GET_QDN_RESOURCE_URL",
      name: publisherName,
      service: "THUMBNAIL",
      identifier: `qortal_group_avatar_${normalizedGroupId}`,
    });
    if (typeof avatarUrl !== "string") return "";
    const normalizedUrl = avatarUrl.trim();
    if (!normalizedUrl || normalizedUrl === "Resource does not exist") {
      return "";
    }
    return normalizedUrl;
  } catch {
    return "";
  }
};

export const isDeletedSentResourceInSearch = (item: any): boolean => {
  const title =
    typeof item?.metadata?.title === "string"
      ? item.metadata.title.trim().toLowerCase()
      : "";
  const tags = Array.isArray(item?.metadata?.tags)
    ? item.metadata.tags.map((tag: any) => {
        return typeof tag === "string" ? tag.trim().toLowerCase() : "";
      })
    : [];
  return title === "__qmail_deleted__" || tags.includes("qmail-deleted");
};

export const hasSentMailActivityForOwnedName = async (
  name: string
): Promise<boolean> => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!normalizedName) return false;
  const normalizedNameLower = normalizedName.toLowerCase();

  const sentQueryConfigs: Array<{ query: string; identifier?: string }> = [
    {
      query: "_mail_qortal_qmail_",
      identifier: "_mail_",
    },
    {
      query: "qortal_qmail_",
    },
  ];

  for (const queryConfig of sentQueryConfigs) {
    const sentParams = new URLSearchParams({
      mode: "ALL",
      service: MAIL_SERVICE_TYPE,
      query: queryConfig.query,
      name: normalizedName,
      exactmatchnames: "true",
      limit: "20",
      includemetadata: "true",
      reverse: "true",
      excludeblocked: "true",
    });

    if (queryConfig.identifier) {
      sentParams.set("identifier", queryConfig.identifier);
    }

    const hasSent = await fetchHasMailResources(sentParams, item => {
      const itemName =
        typeof item?.name === "string" ? item.name.trim().toLowerCase() : "";
      const identifier =
        typeof item?.identifier === "string" ? item.identifier : "";
      return (
        itemName === normalizedNameLower &&
        isSentMailIdentifier(identifier) &&
        !isDeletedSentResourceInSearch(item)
      );
    });

    if (hasSent) {
      return true;
    }
  }

  return false;
};

/** The two inbox queries for an owned name and the identifier filters that go with them. */
export const getOwnedNameInboxQueries = (
  name: string,
  ownerAddress: string
): Array<{ query: string; matches: (identifier: string) => boolean }> => {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedAddress =
    typeof ownerAddress === "string" ? ownerAddress.trim() : "";
  if (!normalizedName || !normalizedAddress) return [];
  const addressSuffix = normalizedAddress.slice(-6);
  if (!addressSuffix) return [];
  const normalizedAddressSuffix = `_${addressSuffix}_mail_`.toLowerCase();
  const byAddressQuery = `qortal_qmail_${normalizedName.slice(
    0,
    20
  )}_${addressSuffix}_mail_`;
  const byAliasQuery = `qortal_qmail_${normalizedName}_mail_`;
  return [
    {
      query: byAddressQuery,
      matches: (identifier: string) => {
        const normalizedIdentifier = identifier.toLowerCase();
        return (
          normalizedIdentifier.startsWith(
            `_mail_${byAddressQuery}`.toLowerCase()
          ) && normalizedIdentifier.includes(normalizedAddressSuffix)
        );
      },
    },
    {
      query: byAliasQuery,
      matches: (identifier: string) => {
        return identifier
          .toLowerCase()
          .startsWith(`_mail_${byAliasQuery}`.toLowerCase());
      },
    },
  ];
};

/**
 * True when an owned name has received mail. Each probe is exactly page 1 of
 * the index fetch that follows (fetchInboxMessagesForOwnedName, or for the
 * primary name's by-address query useFetchMail's getAllMailMessages), so the
 * probe and the fetch share one search instead of costing two.
 */
export const hasInboxMailActivityForOwnedName = async (
  name: string,
  ownerAddress: string,
  { isPrimary = false }: { isPrimary?: boolean } = {}
): Promise<boolean> => {
  const queries = getOwnedNameInboxQueries(name, ownerAddress);
  if (!queries.length) return false;

  for (const [index, queryConfig] of queries.entries()) {
    const primaryIndexPage = isPrimary && index === 0;
    const params = new URLSearchParams({
      mode: "ALL",
      service: MAIL_SERVICE_TYPE,
      query: queryConfig.query,
      limit: "200",
      includemetadata: primaryIndexPage ? "false" : "true",
      offset: "0",
      reverse: "true",
      excludeblocked: "true",
    });
    const hasMail = await fetchHasMailResources(params, item => {
      const identifier =
        typeof item?.identifier === "string" ? item.identifier : "";
      return Boolean(identifier) && queryConfig.matches(identifier);
    });
    if (hasMail) return true;
  }
  return false;
};

/** `fn` over `items`, at most `limit` at a time; results in input order. */
export const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
};

/** Names per merged search: Core takes repeated `name` params; 50 keeps the URL far below its limit. */
export const NAMES_PER_SEARCH = 50;
/** Pages a merged probe reads; names it has not settled by then are probed one by one. */
export const MERGED_PROBE_MAX_PAGES = 10;
const MERGED_PAGE_SIZE = 200;

const lower = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

const chunked = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

/**
 * Pages one search until it runs out, `done()` says enough, or the page cap.
 * Resolves true when the search was read to the end (or `done`), false when
 * it stopped at the cap; throws when a page fails.
 */
const readPages = async (
  build: (offset: number) => URLSearchParams,
  onRows: (rows: any[]) => void,
  done: () => boolean
): Promise<boolean> => {
  let offset = 0;
  for (let page = 0; page < MERGED_PROBE_MAX_PAGES; page += 1) {
    const rows = await searchResources(build(offset));
    onRows(rows);
    if (rows.length < MERGED_PAGE_SIZE || done()) return true;
    offset += rows.length;
  }
  return false;
};

/**
 * Which owned names have sent mail, with one paged search per kind for up to
 * NAMES_PER_SEARCH names instead of two searches per name (88 names: about 2
 * searches instead of 176). Same queries and row test as
 * hasSentMailActivityForOwnedName; a name a merged search could not settle
 * (a failed page, or the page cap) gets that per-name probe. Lowercased names.
 */
export const ownedNamesWithSentMail = async (names: string[]): Promise<Set<string>> => {
  const owned = Array.from(new Set(names.map(name => (typeof name === "string" ? name.trim() : "")).filter(Boolean)));
  const found = new Set<string>();
  const unsettled = new Set<string>();
  const configs: Array<{ query: string; identifier?: string }> = [
    { query: "_mail_qortal_qmail_", identifier: "_mail_" },
    { query: "qortal_qmail_" },
  ];
  for (const config of configs) {
    for (const chunk of chunked(owned.filter(name => !found.has(lower(name))), NAMES_PER_SEARCH)) {
      const wanted = new Set(chunk.map(lower));
      const build = (offset: number) => {
        const params = new URLSearchParams({
          mode: "ALL",
          service: MAIL_SERVICE_TYPE,
          query: config.query,
          exactmatchnames: "true",
          limit: String(MERGED_PAGE_SIZE),
          offset: String(offset),
          includemetadata: "true",
          reverse: "true",
          excludeblocked: "true",
        });
        if (config.identifier) params.set("identifier", config.identifier);
        chunk.forEach(name => params.append("name", name));
        return params;
      };
      try {
        const complete = await readPages(
          build,
          rows =>
            rows.forEach(item => {
              const itemName = lower(item?.name);
              const identifier = typeof item?.identifier === "string" ? item.identifier : "";
              if (wanted.has(itemName) && isSentMailIdentifier(identifier) && !isDeletedSentResourceInSearch(item)) {
                found.add(itemName);
              }
            }),
          () => chunk.every(name => found.has(lower(name)))
        );
        if (!complete) chunk.forEach(name => unsettled.add(name));
      } catch {
        chunk.forEach(name => unsettled.add(name));
      }
    }
  }
  for (const name of unsettled) {
    if (found.has(lower(name))) continue;
    if (await hasSentMailActivityForOwnedName(name)) found.add(lower(name));
  }
  return found;
};

/**
 * Which owned names have mail addressed to them in the by-address form
 * (`_mail_qortal_qmail_<name.slice(0,20)>_<address.slice(-6)>_mail_…`), from
 * one paged search for the address suffix instead of one per name. Same
 * identifier test as the first query of getOwnedNameInboxQueries. `settled`
 * is false when a page failed or the cap was reached: the caller then probes
 * each name as before. Lowercased names.
 */
export const ownedNamesWithAddressMail = async (
  names: string[],
  ownerAddress: string
): Promise<{ found: Set<string>; settled: boolean }> => {
  const found = new Set<string>();
  const address = typeof ownerAddress === "string" ? ownerAddress.trim() : "";
  const suffix = address.slice(-6);
  if (!suffix) return { found, settled: false };
  const matchers = names
    .map(name => ({ name: lower(name), query: getOwnedNameInboxQueries(name, address)[0] }))
    .filter(entry => entry.name && entry.query);
  try {
    const settled = await readPages(
      offset =>
        new URLSearchParams({
          mode: "ALL",
          service: MAIL_SERVICE_TYPE,
          query: `_${suffix}_mail_`,
          limit: String(MERGED_PAGE_SIZE),
          offset: String(offset),
          includemetadata: "false",
          reverse: "true",
          excludeblocked: "true",
        }),
      rows =>
        rows.forEach(item => {
          const identifier = typeof item?.identifier === "string" ? item.identifier : "";
          if (!identifier) return;
          matchers.forEach(entry => {
            if (!found.has(entry.name) && entry.query.matches(identifier)) found.add(entry.name);
          });
        }),
      () => matchers.every(entry => found.has(entry.name))
    );
    return { found, settled };
  } catch {
    return { found, settled: false };
  }
};

/**
 * The alias-form inbox probe alone (`qortal_qmail_<name>_mail_`), exactly
 * page 1 of fetchInboxMessagesForOwnedName's second query, so the two share
 * one search.
 */
export const hasAliasFormInboxMail = async (name: string, ownerAddress: string): Promise<boolean> => {
  const aliasQuery = getOwnedNameInboxQueries(name, ownerAddress)[1];
  if (!aliasQuery) return false;
  const params = new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: aliasQuery.query,
    limit: "200",
    includemetadata: "true",
    offset: "0",
    reverse: "true",
    excludeblocked: "true",
  });
  return fetchHasMailResources(params, item => {
    const identifier = typeof item?.identifier === "string" ? item.identifier : "";
    return Boolean(identifier) && aliasQuery.matches(identifier);
  });
};

/** The latest (up to 20) messages sent to a watched alias; also the "has mail?" probe. */
export const fetchRecentInboxMessagesForSavedAlias = async (
  aliasName: string,
  options?: SearchOptions
): Promise<MailListRow[]> => {
  const normalizedAlias = typeof aliasName === "string" ? aliasName.trim() : "";
  if (!normalizedAlias) return [];

  const aliasQuery = `qortal_qmail_${normalizedAlias}_mail_`;
  const expectedAliasIdentifierPrefix = `_mail_${aliasQuery}`.toLowerCase();
  const aliasParams = new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: aliasQuery,
    limit: "20",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });

  try {
    const responseData = await searchResources(aliasParams, options);
    return mapMailResources(
      responseData.filter((item: any) => {
        const identifier =
          typeof item?.identifier === "string"
            ? item.identifier.toLowerCase()
            : "";
        return identifier.startsWith(expectedAliasIdentifierPrefix);
      })
    );
  } catch {
    return [];
  }
};

const dedupeAndSortRows = (resources: any[]): MailListRow[] => {
  const mapped = mapMailResources(resources);
  const deduped = new Map<string, MailListRow>();
  mapped.forEach(item => {
    if (!item?.id) return;
    if (!deduped.has(item.id)) {
      deduped.set(item.id, item);
    }
  });
  return Array.from(deduped.values()).sort((a, b) => {
    return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
  });
};

/** The whole inbox index of a (non-primary) owned name: both queries, 200 per page, to exhaustion. */
export const fetchInboxMessagesForOwnedName = async (
  name: string,
  ownerAddress: string,
  options?: SearchOptions
): Promise<MailListRow[]> => {
  const queries = getOwnedNameInboxQueries(name, ownerAddress);
  if (!queries.length) return [];

  const allResources: any[] = [];
  const pageSize = 200;

  for (const queryConfig of queries) {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        mode: "ALL",
        service: MAIL_SERVICE_TYPE,
        query: queryConfig.query,
        limit: String(pageSize),
        includemetadata: "true",
        offset: String(offset),
        reverse: "true",
        excludeblocked: "true",
      });

      const responseData = await searchResources(params, options);
      if (!responseData.length) {
        break;
      }

      const filteredResponse = responseData.filter((item: any) => {
        const identifier =
          typeof item?.identifier === "string" ? item.identifier : "";
        if (!identifier) return false;
        return queryConfig.matches(identifier);
      });
      allResources.push(...filteredResponse);

      if (responseData.length < pageSize) {
        hasMore = false;
      } else {
        offset += responseData.length;
      }
    }
  }

  return dedupeAndSortRows(allResources);
};

/**
 * A delta poll's search is fresh for this long: two paths asking for the
 * newest 20 of the same name within a few seconds (the poll's tick and a
 * probe, or two panes) share one answer instead of sending the same query
 * twice, while a later tick still goes to the node.
 */
export const RECENT_SEARCH_TTL_MS = 5000;

/**
 * The newest (up to 20 per query) inbox messages for an owned name, for the
 * poll. Goes to the node after RECENT_SEARCH_TTL_MS and merges with an
 * identical search in flight.
 */
export const fetchRecentInboxMessagesForOwnedName = async (
  name: string,
  ownerAddress: string
): Promise<MailListRow[]> => {
  const queries = getOwnedNameInboxQueries(name, ownerAddress);
  if (!queries.length) return [];

  const allResources: any[] = [];
  for (const queryConfig of queries) {
    const params = new URLSearchParams({
      mode: "ALL",
      service: MAIL_SERVICE_TYPE,
      query: queryConfig.query,
      limit: "20",
      includemetadata: "true",
      reverse: "true",
      excludeblocked: "true",
    });
    try {
      const responseData = await searchResources(params, { ttlMs: RECENT_SEARCH_TTL_MS });
      allResources.push(
        ...responseData.filter((item: any) => {
          const identifier =
            typeof item?.identifier === "string" ? item.identifier : "";
          return Boolean(identifier) && queryConfig.matches(identifier);
        })
      );
    } catch {
      // A failed poll just means "nothing new this tick".
    }
  }
  return dedupeAndSortRows(allResources);
};

/**
 * Merge freshly polled rows into a known list: new ids go first (newest first),
 * known ids are left untouched (they may carry local read markers). Returns the
 * same array when nothing is new.
 */
export const mergeNewRows = <T extends { id?: string }>(
  known: T[],
  polled: T[]
): T[] => {
  const knownIds = new Set(known.map(row => row?.id).filter(Boolean));
  const fresh = polled.filter(row => row?.id && !knownIds.has(row.id));
  if (!fresh.length) return known;
  return [...fresh, ...known];
};

/**
 * Drops rows whose decrypted hash entry carries `deleted: true`: the body was
 * the "D" delete marker (fetchMail.ts marks it when the message is opened).
 * The primary inbox drops such rows through `removeMessages`; secondary-name
 * and alias lists are filtered with this. Returns the same array when nothing
 * is deleted, so memos keep their references.
 */
export const withoutDeletedRows = <T extends { id?: string; identifier?: string }>(
  rows: T[],
  hashMap: Record<string, unknown>
): T[] => {
  const isDeleted = (row: T): boolean => {
    const id = row?.id || row?.identifier;
    if (!id) return false;
    const entry = hashMap[id] as { deleted?: unknown } | undefined;
    return entry?.deleted === true;
  };
  return rows.some(isDeleted) ? rows.filter(row => !isDeleted(row)) : rows;
};
