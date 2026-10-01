/**
 * Group-thread reads, shared by the Threads overview, the per-group list and
 * the thread screen. Every search goes through `searchResources()` (merged in
 * flight, cached for the session) with the same query strings the original
 * app sends, so the results stay what Q-Mail would show.
 *
 * Identifiers (data contract §2, binding):
 *   thread header   qortal_qmail_thread_group<groupId>_<token>        service MAIL
 *   thread message  qortal_qmail_thmsg_group<groupId>_<token>_<uid>   service MAIL_PRIVATE
 */
import { MAIL_SERVICE_TYPE, THREAD_SERVICE_TYPE } from "../../constants/mail";
import { searchResources, type SearchOptions } from "../../utils/qdnSearch";

export interface GroupOption {
  id: string | number;
  name: string;
}

export interface ThreadData {
  title: string;
  groupId: string;
  createdAt: number;
  name: string;
}

export interface ThreadSummary {
  identifier: string;
  threadId: string;
  /** Header creation time (ms epoch) from the search row. */
  created: number;
  threadOwner: string;
  threadData: ThreadData;
  groupName?: string;
  /** Newest known post time, or the header time when no post is known. */
  lastActivity?: number;
  /** Publisher of the newest known post. */
  lastPostBy?: string;
  postCount?: number;
}

export interface ThreadActivity {
  token: string;
  latestCreated: number;
  latestName: string;
  count: number;
}

export const THREAD_PAGE_SIZE = 20;
export const THREAD_MESSAGE_PAGE_SIZE = 20;
export const THREAD_ACTIVITY_LIMIT = 100;

export const toNumber = (value: unknown): number => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

export const normalizeGroupId = (value: unknown): string => String(value ?? "").trim();

/** The thread token is the last `_` segment of a thread header identifier (readers derive it positionally). */
export const threadTokenFromThreadId = (threadId: string): string => {
  const parts = String(threadId || "").split("_");
  return parts[parts.length - 1] || "";
};

/** For a thread message identifier `…_group<id>_<token>_<uid>`, the token is the second-from-last segment. */
export const threadTokenFromMessageId = (messageId: string): string => {
  const parts = String(messageId || "").split("_");
  return parts.length >= 2 ? parts[parts.length - 2] : "";
};

export const threadIdFor = (groupId: string, token: string): string =>
  `qortal_qmail_thread_group${groupId}_${token}`;

/** The search `query=` is a substring match, so group 1 also returns group 10; keep only exact group ids. */
export const belongsToGroup = (identifier: string, groupId: string, kind: "thread" | "thmsg"): boolean =>
  typeof identifier === "string" && identifier.startsWith(`qortal_qmail_${kind}_group${groupId}_`);

export const threadHeaderSearchParams = (
  groupId: string,
  { limit = THREAD_PAGE_SIZE, offset = 0, reverse = true }: { limit?: number; offset?: number; reverse?: boolean } = {}
): URLSearchParams =>
  new URLSearchParams({
    mode: "ALL",
    service: THREAD_SERVICE_TYPE,
    query: `qortal_qmail_thread_group${groupId}`,
    limit: String(limit),
    includemetadata: "true",
    offset: String(offset),
    reverse: String(reverse),
    excludeblocked: "true",
  });

export const threadActivitySearchParams = (groupId: string): URLSearchParams =>
  new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: `qortal_qmail_thmsg_group${groupId}`,
    limit: String(THREAD_ACTIVITY_LIMIT),
    includemetadata: "false",
    offset: "0",
    reverse: "true",
    excludeblocked: "true",
  });

export const threadHeaderByIdParams = (threadId: string): URLSearchParams =>
  new URLSearchParams({
    mode: "ALL",
    service: THREAD_SERVICE_TYPE,
    identifier: threadId,
    limit: "1",
    includemetadata: "true",
    offset: "0",
    reverse: "true",
    excludeblocked: "true",
  });

export const threadMessagesSearchParams = (groupId: string, token: string, offset = 0): URLSearchParams =>
  new URLSearchParams({
    mode: "ALL",
    service: MAIL_SERVICE_TYPE,
    query: `qortal_qmail_thmsg_group${groupId}_${token}`,
    limit: String(THREAD_MESSAGE_PAGE_SIZE),
    includemetadata: "false",
    offset: String(offset),
    reverse: "true",
    excludeblocked: "true",
  });

// ---- titles ---------------------------------------------------------------

const titleByIdentifier = new Map<string, string>();
const titleInFlight = new Map<string, Promise<string>>();

/**
 * A thread's title: resource `metadata.description` first (binding; readers
 * prefer it), else the header JSON's `title`, fetched once per identifier.
 */
export async function resolveThreadTitle(resource: any): Promise<string> {
  const identifier = typeof resource?.identifier === "string" ? resource.identifier : "";
  const metadataTitle =
    typeof resource?.metadata?.description === "string" ? resource.metadata.description.trim() : "";
  if (metadataTitle) {
    if (identifier) titleByIdentifier.set(identifier, metadataTitle);
    return metadataTitle;
  }
  if (!identifier) return "";
  const cached = titleByIdentifier.get(identifier);
  if (cached !== undefined) return cached;
  const running = titleInFlight.get(identifier);
  if (running) return running;

  const request = (async () => {
    try {
      const threadResource = await qortalRequest({
        action: "FETCH_QDN_RESOURCE",
        name: resource?.name,
        service: THREAD_SERVICE_TYPE,
        identifier,
      });
      const fallbackTitle = typeof threadResource?.title === "string" ? threadResource.title.trim() : "";
      titleByIdentifier.set(identifier, fallbackTitle);
      return fallbackTitle;
    } catch {
      return ""; // not cached: the data may simply not be downloaded yet
    }
  })();
  titleInFlight.set(identifier, request);
  try {
    return await request;
  } finally {
    titleInFlight.delete(identifier);
  }
}

// ---- headers --------------------------------------------------------------

const headerByIdentifier = new Map<string, ThreadSummary>();

export function peekThreadHeader(threadId: string): ThreadSummary | undefined {
  return headerByIdentifier.get(threadId);
}

export function rememberThreadHeader(summary: ThreadSummary): void {
  headerByIdentifier.set(summary.identifier, summary);
}

export async function summarizeThreadResource(
  resource: any,
  groupId: string,
  groupName?: string
): Promise<ThreadSummary | null> {
  const identifier = typeof resource?.identifier === "string" ? resource.identifier.trim() : "";
  if (!identifier || !belongsToGroup(identifier, groupId, "thread")) return null;
  const ownerName = typeof resource?.name === "string" ? resource.name.trim() : "";
  const createdAt = toNumber(resource?.created);
  const title = (await resolveThreadTitle(resource)) || "Untitled thread";
  const summary: ThreadSummary = {
    identifier,
    threadId: identifier,
    created: createdAt,
    threadOwner: ownerName,
    threadData: { title, groupId, createdAt, name: ownerName },
    groupName,
    lastActivity: createdAt,
  };
  headerByIdentifier.set(identifier, summary);
  return summary;
}

export interface ThreadPage {
  threads: ThreadSummary[];
  /** True when the page was full, so another page may exist. */
  hasMore: boolean;
}

/** One page of a group's thread headers (20 per page, newest first unless `reverse` is false). */
export async function fetchThreadPage(
  group: GroupOption,
  { offset = 0, reverse = true, limit = THREAD_PAGE_SIZE }: { offset?: number; reverse?: boolean; limit?: number } = {},
  options?: SearchOptions
): Promise<ThreadPage> {
  const groupId = normalizeGroupId(group?.id);
  const groupName = typeof group?.name === "string" ? group.name.trim() : "";
  if (!groupId) return { threads: [], hasMore: false };
  const rows = await searchResources<any>(threadHeaderSearchParams(groupId, { limit, offset, reverse }), options);
  const summaries = await Promise.all(rows.map((row) => summarizeThreadResource(row, groupId, groupName)));
  return {
    threads: summaries.filter(Boolean) as ThreadSummary[],
    hasMore: rows.length >= limit,
  };
}

/** The header of one thread by identifier (limit 1), from memory when a list already loaded it. */
export async function fetchThreadHeader(
  group: GroupOption,
  threadId: string,
  options?: SearchOptions
): Promise<ThreadSummary | null> {
  const cached = headerByIdentifier.get(threadId);
  if (cached && !options?.force) return cached;
  const groupId = normalizeGroupId(group?.id);
  const rows = await searchResources<any>(threadHeaderByIdParams(threadId), options);
  const match = rows.find((row) => row?.identifier === threadId) || rows[0];
  if (!match) return null;
  return summarizeThreadResource(match, groupId, group?.name);
}

// ---- activity -------------------------------------------------------------

/** Newest posts in a group (one search, limit 100) grouped by thread token, newest first. */
export async function fetchGroupActivity(groupIdInput: string | number, options?: SearchOptions): Promise<ThreadActivity[]> {
  const groupId = normalizeGroupId(groupIdInput);
  if (!groupId) return [];
  const rows = await searchResources<any>(threadActivitySearchParams(groupId), options);
  return activityFromRows(rows, groupId);
}

export function activityFromRows(rows: any[], groupId: string): ThreadActivity[] {
  const byToken = new Map<string, ThreadActivity>();
  for (const row of rows) {
    const identifier = typeof row?.identifier === "string" ? row.identifier : "";
    if (!belongsToGroup(identifier, groupId, "thmsg")) continue;
    const token = threadTokenFromMessageId(identifier);
    if (!token) continue;
    const created = toNumber(row?.created);
    const name = typeof row?.name === "string" ? row.name : "";
    const existing = byToken.get(token);
    if (!existing) {
      byToken.set(token, { token, latestCreated: created, latestName: name, count: 1 });
    } else {
      existing.count += 1;
      if (created > existing.latestCreated) {
        existing.latestCreated = created;
        existing.latestName = name;
      }
    }
  }
  return Array.from(byToken.values()).sort((a, b) => b.latestCreated - a.latestCreated);
}

/** Merge activity into thread summaries: `lastActivity`, `lastPostBy`, `postCount`. */
export function applyActivity(threads: ThreadSummary[], activity: ThreadActivity[]): ThreadSummary[] {
  if (!activity.length) return threads;
  const byToken = new Map(activity.map((item) => [item.token, item]));
  return threads.map((thread) => {
    const item = byToken.get(threadTokenFromThreadId(thread.threadId));
    if (!item) return thread;
    const lastActivity = Math.max(thread.created, item.latestCreated);
    return { ...thread, lastActivity, lastPostBy: item.latestName || undefined, postCount: item.count };
  });
}

export const lastActivityOf = (thread: ThreadSummary): number =>
  toNumber(thread.lastActivity) || toNumber(thread.created) || toNumber(thread.threadData?.createdAt);

export function resetThreadDataCache(): void {
  titleByIdentifier.clear();
  titleInFlight.clear();
  headerByIdentifier.clear();
}
