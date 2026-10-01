/**
 * Which group threads are unread, from the viewed-timestamp store the original
 * app keeps (data contract §12, binding shape):
 *
 *   localStorage `qmail_threads_viewedtimestamp_<username>` =
 *     { ["qmail_threads_<groupId>_<threadId>"]: { timestamp } }, capped at 500
 *
 * A thread is unread when it was never opened, or when its newest known
 * activity is later than the last time it was opened.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePolling } from "../../hooks/usePolling";
import {
  applyActivity,
  fetchGroupActivity,
  fetchThreadPage,
  lastActivityOf,
  normalizeGroupId,
  type GroupOption,
  type ThreadSummary,
} from "./threadData";

export type ViewedThreads = Record<string, { timestamp: number }>;

export const THREAD_VIEWED_EVENT = "qmail:thread-viewed";
const VIEWED_CAP = 500;

export const viewedThreadsStorageKey = (username: string): string => `qmail_threads_viewedtimestamp_${username}`;

export const viewedThreadKey = (groupId: string | number, threadId: string): string =>
  `qmail_threads_${normalizeGroupId(groupId)}_${threadId}`;

export function readViewedThreads(username?: string | null): ViewedThreads {
  if (!username) return {};
  try {
    const raw = localStorage.getItem(viewedThreadsStorageKey(username));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Record that a thread was opened now (same key, shape and 500 cap as the original app). */
export function saveThreadViewed(username: string, groupId: string | number, threadId: string, now = Date.now()): void {
  if (!username || !normalizeGroupId(groupId) || !threadId) return;
  const key = viewedThreadKey(groupId, threadId);
  const existing = readViewedThreads(username);
  const entries = Object.entries(existing)
    .map(([identifier, value]) => ({ identifier, timestamp: Number((value as any)?.timestamp) || 0 }))
    .filter((entry) => entry.identifier !== key)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, VIEWED_CAP - 1);
  const next: ViewedThreads = {};
  for (const entry of entries) next[entry.identifier] = { timestamp: entry.timestamp };
  next[key] = { timestamp: now };
  try {
    localStorage.setItem(viewedThreadsStorageKey(username), JSON.stringify(next));
  } catch {
    /* storage full or unavailable: unread state is a convenience only */
  }
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent(THREAD_VIEWED_EVENT, { detail: { username, key } }));
  }
}

export function viewedTimestamp(viewed: ViewedThreads, groupId: string | number, threadId: string): number {
  return Number(viewed[viewedThreadKey(groupId, threadId)]?.timestamp) || 0;
}

export function isThreadUnread(viewed: ViewedThreads, thread: ThreadSummary): boolean {
  const seenAt = viewedTimestamp(viewed, thread.threadData?.groupId, thread.threadId);
  if (!seenAt) return true;
  return lastActivityOf(thread) > seenAt;
}

export function countUnread(viewed: ViewedThreads, threads: ThreadSummary[]): number {
  return threads.reduce((count, thread) => count + (isThreadUnread(viewed, thread) ? 1 : 0), 0);
}

/** The viewed store for a user, kept in sync with saves from this tab and others. */
export function useViewedThreads(username?: string | null): ViewedThreads {
  const [viewed, setViewed] = useState<ViewedThreads>(() => readViewedThreads(username));
  useEffect(() => {
    setViewed(readViewedThreads(username));
    if (!username) return;
    const refresh = () => setViewed(readViewedThreads(username));
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === viewedThreadsStorageKey(username)) refresh();
    };
    document.addEventListener(THREAD_VIEWED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener(THREAD_VIEWED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [username]);
  return viewed;
}

export interface ThreadUnreadCounts {
  /** Unread threads per group id. */
  byGroup: Record<string, number>;
  total: number;
  isLoading: boolean;
}

/**
 * Unread thread counts per group for the rail badges. Uses the same cached
 * searches as the Threads overview (first header page + activity per group),
 * so it costs nothing extra while that view is open, and refreshes politely.
 *
 * Wire-up hint for Mail.tsx: `const { byGroup } = useThreadUnreadCounts(groupOptionsWithThreads, user?.name)`
 * then `badgeText: byGroup[group.id] ? String(byGroup[group.id]) : undefined` on the
 * `threads-group:` items in `buildSidebarItems`.
 */
export function useThreadUnreadCounts(
  groups: GroupOption[],
  username?: string | null,
  { enabled = true, intervalMs = 120_000 }: { enabled?: boolean; intervalMs?: number } = {}
): ThreadUnreadCounts {
  const viewed = useViewedThreads(username);
  const [threadsByGroup, setThreadsByGroup] = useState<Record<string, ThreadSummary[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const groupKey = groups.map((group) => normalizeGroupId(group.id)).filter(Boolean).join(",");

  const load = useCallback(
    async (force: boolean) => {
      if (!enabled || !groupKey) {
        setThreadsByGroup({});
        return false;
      }
      setIsLoading(true);
      try {
        const results = await Promise.all(
          groups.map(async (group) => {
            const groupId = normalizeGroupId(group.id);
            try {
              const [page, activity] = await Promise.all([
                fetchThreadPage(group, {}, force ? { force: true } : undefined),
                fetchGroupActivity(groupId, force ? { force: true } : undefined),
              ]);
              return [groupId, applyActivity(page.threads, activity)] as const;
            } catch {
              return [groupId, []] as const;
            }
          })
        );
        setThreadsByGroup(Object.fromEntries(results));
        return true;
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, groupKey]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  usePolling(() => load(true), { intervalMs, enabled: enabled && Boolean(groupKey), maxIntervalMs: intervalMs * 6 });

  return useMemo(() => {
    const byGroup: Record<string, number> = {};
    let total = 0;
    for (const [groupId, threads] of Object.entries(threadsByGroup)) {
      const count = countUnread(viewed, threads);
      byGroup[groupId] = count;
      total += count;
    }
    return { byGroup, total, isLoading };
  }, [isLoading, threadsByGroup, viewed]);
}
