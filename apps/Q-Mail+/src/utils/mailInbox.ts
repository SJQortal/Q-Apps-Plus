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

  const params = new URLSearchParams({
    mode: "ALL",
    service: THREAD_SERVICE_TYPE,
    query: `qortal_qmail_thread_group${normalizedGroupId}`,
    limit: "1",
    includemetadata: "false",
    reverse: "true",
    excludeblocked: "true",
  });

  return fetchHasMailResources(params);
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

export const fetchGroupAvatarUrl = async (
  groupId: string | number
): Promise<string> => {
  const normalizedGroupId = normalizeId(groupId);
  if (!normalizedGroupId) return "";

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

export const hasInboxMailActivityForOwnedName = async (
  name: string,
  ownerAddress: string
): Promise<boolean> => {
  const queries = getOwnedNameInboxQueries(name, ownerAddress);
  if (!queries.length) return false;

  for (const queryConfig of queries) {
    const params = new URLSearchParams({
      mode: "ALL",
      service: MAIL_SERVICE_TYPE,
      query: queryConfig.query,
      limit: "20",
      includemetadata: "false",
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
 * The newest (up to 20 per query) inbox messages for an owned name, for the
 * poll. Always hits the node (TTL 0) but still merges with an identical search
 * in flight.
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
      const responseData = await searchResources(params, { ttlMs: 0 });
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
