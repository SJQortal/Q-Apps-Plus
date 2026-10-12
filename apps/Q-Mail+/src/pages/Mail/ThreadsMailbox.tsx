import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Avatar, Badge, Box, Button, IconButton, ListItemButton, Typography } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { RootState } from "../../state/store";
import { EmptyState, ErrorState, ListSkeleton } from "../../layout/states";
import { usePolling } from "../../hooks/usePolling";
import { GroupMail } from "./GroupMail";
import { NewThreadButton } from "./NewThreadButton";
import { ThreadRow } from "./ThreadRow";
import {
  applyActivity,
  fetchGroupActivity,
  fetchThreadPage,
  lastActivityOf,
  normalizeGroupId,
  type GroupOption,
  type ThreadSummary,
} from "./threadData";
import { countUnread, isThreadUnread, useViewedThreads } from "./threadUnread";

export type { GroupOption, ThreadSummary } from "./threadData";

interface ThreadsMailboxProps {
  /** Groups that have threads. */
  groups: GroupOption[];
  /** Every joined group, for "New thread" when a group has no threads yet. */
  joinedGroups?: GroupOption[];
  groupAvatarUrlById?: Record<string, string>;
  isLoadingGroups?: boolean;
  selectedGroup?: GroupOption | null;
  onSelectGroup?: (group: GroupOption | null) => void;
  currentThreadId?: string | null;
  onOpenThread: (thread: ThreadSummary, group: GroupOption) => void;
  onRequestComposeThread?: (group: GroupOption) => void;
  filterMode?: string;
  setFilterMode?: (mode: string) => void;
}

interface GroupPageState {
  threads: ThreadSummary[];
  offset: number;
  hasMore: boolean;
  error: string | null;
}

export const normalizeGroups = (groups: GroupOption[]): GroupOption[] => {
  const deduped = new Map<string, GroupOption>();
  (groups || []).forEach((group) => {
    const groupId = normalizeGroupId(group?.id);
    const groupName = typeof group?.name === "string" ? group.name.trim() : "";
    if (!groupId || !groupName || deduped.has(groupId)) return;
    deduped.set(groupId, { id: groupId, name: groupName });
  });
  return Array.from(deduped.values());
};

const pageSignature = (pages: Record<string, GroupPageState>): string =>
  Object.entries(pages)
    .map(([groupId, page]) => `${groupId}:${page.threads.map((thread) => `${thread.identifier}@${thread.lastActivity}`).join(",")}`)
    .join("|");

/** Merge per-group pages into one list, newest activity first, one entry per identifier. */
export const mergeThreadLists = (lists: ThreadSummary[][]): ThreadSummary[] => {
  const byId = new Map<string, ThreadSummary>();
  for (const list of lists) {
    for (const thread of list) {
      if (!thread?.identifier) continue;
      const existing = byId.get(thread.identifier);
      if (!existing || lastActivityOf(thread) > lastActivityOf(existing)) byId.set(thread.identifier, thread);
    }
  }
  return Array.from(byId.values()).sort((a, b) => lastActivityOf(b) - lastActivityOf(a));
};

export const ThreadsMailbox = ({
  groups,
  joinedGroups,
  groupAvatarUrlById,
  isLoadingGroups = false,
  selectedGroup = null,
  onSelectGroup,
  currentThreadId,
  onOpenThread,
  onRequestComposeThread,
  filterMode = "Recently active",
  setFilterMode,
}: ThreadsMailboxProps) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const viewed = useViewedThreads(user?.name);
  const normalizedGroups = useMemo(() => normalizeGroups(groups), [groups]);
  const composeGroups = useMemo(
    () => (joinedGroups?.length ? normalizeGroups(joinedGroups) : normalizedGroups),
    [joinedGroups, normalizedGroups]
  );
  const [pages, setPages] = useState<Record<string, GroupPageState>>({});
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const groupKey = normalizedGroups.map((group) => group.id).join(",");
  const generation = useRef(0);
  const lastSignature = useRef("");
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  /**
   * Fetch one page for a group. `offset` 0 with a `previous` state is a
   * refresh: the new first page is merged over what is shown, and the paging
   * position is kept so "Load more" still continues where it was.
   */
  const loadGroupPage = useCallback(
    async (
      group: GroupOption,
      previous: GroupPageState | undefined,
      offset: number,
      force: boolean
    ): Promise<GroupPageState> => {
      const groupId = normalizeGroupId(group.id);
      const options = force ? { force: true } : undefined;
      try {
        const [page, activity] = await Promise.all([
          fetchThreadPage(group, { offset }, options),
          fetchGroupActivity(groupId, options),
        ]);
        const threads = applyActivity(mergeThreadLists([previous?.threads ?? [], page.threads]), activity);
        const isRefresh = offset === 0 && Boolean(previous);
        return {
          threads,
          // By raw rows, so a page of other groups' rows still moves on.
          offset: isRefresh ? Math.max(previous?.offset ?? 0, page.rawCount) : offset + page.rawCount,
          hasMore: isRefresh ? Boolean(previous?.hasMore) || page.hasMore : page.hasMore,
          error: null,
        };
      } catch (error: any) {
        return {
          threads: previous?.threads ?? [],
          offset: previous?.offset ?? offset,
          hasMore: previous?.hasMore ?? false,
          error: typeof error?.message === "string" ? error.message : "Could not load threads",
        };
      }
    },
    []
  );

  const loadAll = useCallback(
    async (force: boolean) => {
      const run = ++generation.current;
      if (!normalizedGroups.length) {
        setPages({});
        setHasLoaded(true);
        return false;
      }
      setIsLoading(true);
      try {
        const results = await Promise.all(
          normalizedGroups.map(
            async (group) =>
              [String(group.id), await loadGroupPage(group, force ? pagesRef.current[String(group.id)] : undefined, 0, force)] as const
          )
        );
        if (run !== generation.current) return;
        const next = Object.fromEntries(results);
        const signature = pageSignature(next);
        const changed = signature !== lastSignature.current;
        lastSignature.current = signature;
        setPages(next);
        return changed;
      } finally {
        if (run === generation.current) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [groupKey, loadGroupPage]
  );

  useEffect(() => {
    setHasLoaded(false);
    void loadAll(false);
  }, [loadAll]);

  usePolling(() => loadAll(true), {
    intervalMs: 60_000,
    maxIntervalMs: 8 * 60_000,
    enabled: Boolean(user?.name) && normalizedGroups.length > 0 && !selectedGroup,
  });

  const loadMore = useCallback(async () => {
    const run = generation.current;
    setIsLoadingMore(true);
    try {
      const results = await Promise.all(
        normalizedGroups
          .filter((group) => pages[String(group.id)]?.hasMore)
          .map(async (group) => {
            const previous = pages[String(group.id)];
            return [String(group.id), await loadGroupPage(group, previous, previous?.offset ?? 0, false)] as const;
          })
      );
      if (run !== generation.current) return;
      setPages((current) => ({ ...current, ...Object.fromEntries(results) }));
    } finally {
      setIsLoadingMore(false);
    }
  }, [loadGroupPage, normalizedGroups, pages]);

  const threads = useMemo(() => mergeThreadLists(Object.values(pages).map((page) => page.threads)), [pages]);
  const unreadByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [groupId, page] of Object.entries(pages)) counts[groupId] = countUnread(viewed, page.threads);
    return counts;
  }, [pages, viewed]);
  const hasMore = Object.values(pages).some((page) => page.hasMore);
  const errors = Object.values(pages).filter((page) => page.error);
  const allFailed = normalizedGroups.length > 0 && errors.length === normalizedGroups.length && threads.length === 0;

  if (selectedGroup) {
    return (
      <GroupMail
        groupInfo={selectedGroup}
        currentThreadId={currentThreadId}
        onOpenThread={(thread) => onOpenThread(thread, selectedGroup)}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        onRequestComposeThread={onRequestComposeThread}
      />
    );
  }

  const actionBar = (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 2,
        py: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <NewThreadButton groups={composeGroups} onRequestComposeThread={onRequestComposeThread} />
      <Box sx={{ flex: 1 }} />
      <IconButton
        aria-label="Refresh threads"
        onClick={() => void loadAll(true)}
        disabled={isLoading}
        sx={{ minWidth: 44, minHeight: 44 }}
      >
        <RefreshIcon />
      </IconButton>
    </Box>
  );

  if (isLoadingGroups || (!hasLoaded && normalizedGroups.length > 0)) {
    return (
      <Box sx={{ width: "100%" }}>
        {actionBar}
        <ListSkeleton rows={6} />
      </Box>
    );
  }

  if (!normalizedGroups.length) {
    return (
      <Box sx={{ width: "100%" }}>
        <EmptyState
          icon={<ForumOutlinedIcon />}
          title="No threads yet"
          hint={
            composeGroups.length
              ? "Start the first thread in one of your groups."
              : "Join a Qortal group to see its threads here."
          }
          action={<NewThreadButton groups={composeGroups} onRequestComposeThread={onRequestComposeThread} />}
        />
      </Box>
    );
  }

  if (allFailed) {
    return (
      <Box sx={{ width: "100%" }}>
        {actionBar}
        <ErrorState title="Could not load threads" message={errors[0]?.error || undefined} onRetry={() => void loadAll(true)} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      {actionBar}
      <Typography
        variant="overline"
        component="h2"
        sx={{ px: 2, pt: 1.5, pb: 0.5, color: "text.secondary", fontWeight: 600, letterSpacing: 1, fontSize: "0.875rem" }}
      >
        Groups
      </Typography>
      {normalizedGroups.map((group) => {
        const groupId = String(group.id);
        const unread = unreadByGroup[groupId] || 0;
        const page = pages[groupId];
        return (
          <ListItemButton
            key={groupId}
            onClick={() => onSelectGroup?.(group)}
            sx={(theme) => ({ minHeight: 56, gap: 1.5, px: 2, borderBottom: `1px solid ${theme.palette.divider}` })}
          >
            <Badge
              color="primary"
              badgeContent={unread}
              max={99}
              overlap="circular"
              aria-hidden
              sx={{ "& .MuiBadge-badge": { fontSize: "0.875rem", fontWeight: 700, minWidth: 20, height: 20 } }}
            >
              <Avatar
                src={groupAvatarUrlById?.[groupId] || undefined}
                alt={group.name}
                sx={(theme) => ({
                  width: 36,
                  height: 36,
                  bgcolor: theme.qplus.primarySoft,
                  color: theme.palette.primary.main,
                  fontWeight: 700,
                })}
              >
                {group.name.charAt(0).toUpperCase()}
              </Avatar>
            </Badge>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: unread ? 700 : 500 }}>
                {group.name}
              </Typography>
              <Typography noWrap variant="body2" color="text.secondary">
                {page?.error
                  ? "Could not load"
                  : `${page?.threads.length ?? 0}${page?.hasMore ? "+" : ""} threads${unread ? ` · ${unread} unread` : ""}`}
              </Typography>
            </Box>
            <ChevronRightIcon sx={{ color: "text.secondary" }} />
          </ListItemButton>
        );
      })}
      <Typography
        variant="overline"
        component="h2"
        sx={{ px: 2, pt: 2, pb: 0.5, color: "text.secondary", fontWeight: 600, letterSpacing: 1, fontSize: "0.875rem" }}
      >
        Recent threads
      </Typography>
      {threads.length === 0 ? (
        <EmptyState
          icon={<ForumOutlinedIcon />}
          title="No threads yet"
          hint="Start the first thread in one of your groups."
          action={<NewThreadButton groups={composeGroups} onRequestComposeThread={onRequestComposeThread} />}
        />
      ) : (
        threads.map((thread) => {
          const groupId = normalizeGroupId(thread.threadData?.groupId);
          const group = normalizedGroups.find((item) => String(item.id) === groupId);
          if (!group) return null;
          return (
            <ThreadRow
              key={thread.identifier}
              thread={thread}
              context={thread.groupName || group.name}
              unread={isThreadUnread(viewed, thread)}
              selected={currentThreadId === thread.identifier}
              onOpen={() => onOpenThread(thread, group)}
            />
          );
        })
      )}
      {hasMore && (
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => void loadMore()}
            disabled={isLoadingMore}
            sx={{ minHeight: 44, textTransform: "none" }}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </Box>
      )}
    </Box>
  );
};
