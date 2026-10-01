import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button, Chip, Collapse, Menu, MenuItem, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import SortIcon from "@mui/icons-material/Sort";
import { RootState } from "../../state/store";
import { EmptyState, ErrorState, ListSkeleton } from "../../layout/states";
import { usePolling } from "../../hooks/usePolling";
import { useGroupMembers } from "../../hooks/useGroupMembers";
import { NewThreadButton } from "./NewThreadButton";
import { ThreadRow } from "./ThreadRow";
import {
  applyActivity,
  fetchGroupActivity,
  fetchThreadHeader,
  fetchThreadPage,
  lastActivityOf,
  normalizeGroupId,
  threadIdFor,
  type GroupOption,
  type ThreadSummary,
} from "./threadData";
import { isThreadUnread, useViewedThreads } from "./threadUnread";

export const threadFilterOptions = ["Recently active", "Newest", "Oldest"] as const;
export type ThreadFilterMode = (typeof threadFilterOptions)[number];
const RECENT_LIMIT = 20;

const listSignature = (threads: ThreadSummary[]): string =>
  threads.map((thread) => `${thread.identifier}@${lastActivityOf(thread)}`).join("|");

interface GroupMailProps {
  groupInfo: GroupOption;
  currentThreadId?: string | null;
  onOpenThread: (thread: ThreadSummary) => void;
  filterMode?: string;
  setFilterMode?: (mode: string) => void;
  onRequestComposeThread?: (group: GroupOption) => void;
}

/**
 * The threads of one group in the list pane: sort menu (Recently active /
 * Newest / Oldest), paged 20 with "Load more", unread marks from the viewed
 * store, and the member list from the shared members cache.
 */
export const GroupMail = ({
  groupInfo,
  currentThreadId,
  onOpenThread,
  filterMode = "Recently active",
  setFilterMode,
  onRequestComposeThread,
}: GroupMailProps) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const groupId = normalizeGroupId(groupInfo?.id);
  const group = useMemo<GroupOption>(() => ({ id: groupId, name: groupInfo?.name || "" }), [groupId, groupInfo?.name]);
  const viewed = useViewedThreads(user?.name);
  const { members, isLoading: isLoadingMembers } = useGroupMembers(groupId);
  const [showMembers, setShowMembers] = useState(false);

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const generation = useRef(0);
  const lastSignature = useRef("");
  const mode: ThreadFilterMode = (threadFilterOptions as readonly string[]).includes(filterMode)
    ? (filterMode as ThreadFilterMode)
    : "Recently active";

  const loadRecent = useCallback(
    async (force: boolean): Promise<ThreadSummary[]> => {
      const options = force ? { force: true } : undefined;
      // One activity search for the group, then headers (from memory when a
      // list already loaded them, else one limit=1 search per thread).
      const [activity, firstPage] = await Promise.all([
        fetchGroupActivity(groupId, options),
        fetchThreadPage(group, {}, options),
      ]);
      const recent = activity.slice(0, RECENT_LIMIT);
      const headers = await Promise.all(
        recent.map(async (item) => {
          const threadId = threadIdFor(groupId, item.token);
          const known = firstPage.threads.find((thread) => thread.identifier === threadId);
          if (known) return known;
          try {
            return await fetchThreadHeader(group, threadId, options);
          } catch {
            return null;
          }
        })
      );
      const found = headers.filter(Boolean) as ThreadSummary[];
      // Threads with no posts yet still belong in the list (newest first).
      const recentIds = new Set(found.map((thread) => thread.identifier));
      const quiet = firstPage.threads.filter((thread) => !recentIds.has(thread.identifier));
      return applyActivity([...found, ...quiet], activity).sort((a, b) => lastActivityOf(b) - lastActivityOf(a));
    },
    [group, groupId]
  );

  const load = useCallback(
    async (force: boolean) => {
      if (!groupId) return;
      const run = ++generation.current;
      setIsLoading(true);
      setError(null);
      try {
        if (mode === "Recently active") {
          const list = await loadRecent(force);
          if (run !== generation.current) return;
          lastSignature.current = listSignature(list);
          setThreads(list);
          setHasMore(false);
        } else {
          const options = force ? { force: true } : undefined;
          const [page, activity] = await Promise.all([
            fetchThreadPage(group, { offset: 0, reverse: mode === "Newest" }, options),
            fetchGroupActivity(groupId, options),
          ]);
          if (run !== generation.current) return;
          const list = applyActivity(page.threads, activity);
          lastSignature.current = listSignature(list);
          setThreads(list);
          setHasMore(page.hasMore);
        }
      } catch (loadError: any) {
        if (run !== generation.current) return;
        setError(typeof loadError?.message === "string" ? loadError.message : "Could not load threads");
      } finally {
        if (run === generation.current) setIsLoading(false);
      }
    },
    [group, groupId, loadRecent, mode]
  );

  useEffect(() => {
    setThreads([]);
    setHasMore(false);
    void load(false);
  }, [load]);

  usePolling(
    async () => {
      const before = lastSignature.current;
      await load(true);
      return before !== lastSignature.current;
    },
    { intervalMs: 60_000, maxIntervalMs: 8 * 60_000, enabled: Boolean(user?.name && groupId) }
  );

  const loadMore = useCallback(async () => {
    if (mode === "Recently active" || !hasMore) return;
    const run = generation.current;
    setIsLoadingMore(true);
    try {
      const [page, activity] = await Promise.all([
        fetchThreadPage(group, { offset: threads.length, reverse: mode === "Newest" }),
        fetchGroupActivity(groupId),
      ]);
      if (run !== generation.current) return;
      setThreads((current) => {
        const known = new Set(current.map((thread) => thread.identifier));
        return [...current, ...applyActivity(page.threads.filter((thread) => !known.has(thread.identifier)), activity)];
      });
      setHasMore(page.hasMore);
    } catch {
      /* keep what we have; the button stays for another try */
    } finally {
      setIsLoadingMore(false);
    }
  }, [group, groupId, hasMore, mode, threads.length]);

  const namedMembers = useMemo(() => members.filter((member) => member.name).map((member) => member.name), [members]);
  const unnamedCount = members.length - namedMembers.length;

  const header = (
    <Box sx={(theme) => ({ borderBottom: `1px solid ${theme.palette.divider}` })}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, flexWrap: "wrap" }}>
        <NewThreadButton groups={[group]} onRequestComposeThread={onRequestComposeThread} />
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<SortIcon />}
          onClick={(event) => setSortAnchorEl(event.currentTarget)}
          aria-haspopup="menu"
          aria-label={`Sort by: ${mode}`}
          sx={{ minHeight: 44, textTransform: "none", borderRadius: 2 }}
        >
          {mode}
        </Button>
        <Menu anchorEl={sortAnchorEl} open={Boolean(sortAnchorEl)} onClose={() => setSortAnchorEl(null)}>
          {threadFilterOptions.map((option) => (
            <MenuItem
              key={option}
              selected={option === mode}
              onClick={() => {
                setSortAnchorEl(null);
                setFilterMode?.(option);
              }}
              sx={{ minHeight: 44 }}
            >
              {option}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <Button
        onClick={() => setShowMembers((value) => !value)}
        startIcon={<GroupOutlinedIcon />}
        endIcon={
          <ExpandMoreIcon
            sx={{
              transition: "transform 180ms ease",
              transform: showMembers ? "rotate(180deg)" : "none",
              "@media (prefers-reduced-motion: reduce)": { transition: "none" },
            }}
          />
        }
        aria-expanded={showMembers}
        sx={{ minHeight: 44, px: 2, textTransform: "none", color: "text.secondary", justifyContent: "flex-start", width: "100%" }}
      >
        {isLoadingMembers && !members.length
          ? "Loading members…"
          : `${members.length} ${members.length === 1 ? "member" : "members"}`}
      </Button>
      <Collapse in={showMembers} unmountOnExit>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, px: 2, pb: 1.5 }}>
          {namedMembers.map((name) => (
            <Chip key={name} label={name} size="small" variant="outlined" />
          ))}
          {unnamedCount > 0 && (
            <Chip label={`${unnamedCount} without a name`} size="small" variant="outlined" sx={{ color: "text.secondary" }} />
          )}
          {!members.length && !isLoadingMembers && (
            <Typography variant="body2" color="text.secondary">
              No members found.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );

  let body: React.ReactNode;
  if (isLoading && !threads.length) {
    body = <ListSkeleton rows={6} />;
  } else if (error && !threads.length) {
    body = <ErrorState title="Could not load threads" message={error} onRetry={() => void load(true)} />;
  } else if (!threads.length) {
    body = (
      <EmptyState
        icon={<ForumOutlinedIcon />}
        title="No threads yet"
        hint={`Start the first thread in ${group.name || "this group"}.`}
        action={<NewThreadButton groups={[group]} onRequestComposeThread={onRequestComposeThread} />}
      />
    );
  } else {
    body = (
      <>
        {threads.map((thread) => (
          <ThreadRow
            key={thread.identifier}
            thread={thread}
            unread={isThreadUnread(viewed, thread)}
            selected={currentThreadId === thread.identifier}
            onOpen={onOpenThread}
          />
        ))}
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
      </>
    );
  }

  return (
    <Box sx={{ width: "100%" }}>
      {header}
      {body}
    </Box>
  );
};
