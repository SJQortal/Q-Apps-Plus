/**
 * Paged fetches for a watched alias inbox (Bugs #8). The two queries are the
 * ones the original AliasMail runs (`getOwnedNameInboxQueries(alias, address)`:
 * by name prefix + address suffix, and by alias), the same params per page,
 * through `searchResources()`. Both queries page in lockstep from one offset;
 * the caller dedupes across pages by id.
 */
import { MAIL_SERVICE_TYPE } from "../constants/mail";
import { getOwnedNameInboxQueries, mapMailResources, type MailListRow } from "./mailInbox";
import { searchResources, type SearchOptions } from "./qdnSearch";

export const ALIAS_PAGE_SIZE = 50;

export interface AliasInboxPage {
  rows: MailListRow[];
  /** True when at least one query returned a full page, so a later offset may hold more. */
  hasMore: boolean;
}

export const fetchAliasInboxPage = async (
  alias: string,
  ownerAddress: string,
  offset: number,
  limit: number = ALIAS_PAGE_SIZE,
  options?: SearchOptions
): Promise<AliasInboxPage> => {
  const queries = getOwnedNameInboxQueries(alias, ownerAddress);
  if (!queries.length) return { rows: [], hasMore: false };

  const resources: any[] = [];
  let hasMore = false;
  for (const queryConfig of queries) {
    const params = new URLSearchParams({
      mode: "ALL",
      service: MAIL_SERVICE_TYPE,
      query: queryConfig.query,
      limit: String(limit),
      includemetadata: "true",
      offset: String(offset),
      reverse: "true",
      excludeblocked: "true",
    });
    const responseData = await searchResources(params, options);
    if (responseData.length >= limit) hasMore = true;
    resources.push(
      ...responseData.filter((item: any) => {
        const identifier = typeof item?.identifier === "string" ? item.identifier : "";
        return identifier ? queryConfig.matches(identifier) : false;
      })
    );
  }

  const seen = new Set<string>();
  const rows = mapMailResources(resources).filter(row => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  rows.sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
  return { rows, hasMore };
};
