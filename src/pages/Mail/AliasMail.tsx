/**
 * A watched alias inbox (I5): the same grouped list, search, mark read /
 * unread and archive as the main inbox, with real offset paging (Bugs #8)
 * and a polite 30 s delta poll (visibility-aware, newest 20 per query).
 *
 * The rows it loads are handed back to Mail.tsx (`onMessagesLoaded`) so the
 * alias unread badges count the whole loaded inbox, not just the probe's
 * latest 20, and published to the shared index store for the cross-mailbox
 * search.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Box, Button } from "@mui/material";
import AlternateEmailOutlinedIcon from "@mui/icons-material/AlternateEmailOutlined";
import { RootState } from "../../state/store";
import { selectArchived } from "../../state/features/mailSlice";
import { isArchivedId } from "../../utils/archiveState";
import { usePolling } from "../../hooks/usePolling";
import { LoadMoreSentinel } from "../../layout/states";
import { ALIAS_PAGE_SIZE, fetchAliasInboxPage } from "../../utils/aliasInbox";
import { fetchRecentInboxMessagesForOwnedName, mergeNewRows, withoutDeletedRows } from "../../utils/mailInbox";
import { GroupedMailboxList, type ListStatus } from "./GroupedMailboxList";
import { useMailboxSearch, type MailboxSearchStatus } from "./useMailboxSearch";
import { aliasIndexKey, publishMailIndex } from "./mailIndexStore";
import { NameText } from "../../components/common/NameText";

export const ALIAS_POLL_INTERVAL_MS = 30_000;

interface AliasMailProps {
  /** The watched alias. */
  value: string;
  onOpen: (user: string, identifier: string, content: any) => Promise<void> | void;
  messageOpenedId?: string | number | null;
  /** Every row loaded so far for this alias (for exact unread counts). */
  onMessagesLoaded?: (alias: string, rows: any[]) => void;
  onMarkAsRead?: (messages: any[]) => void | Promise<void>;
  onMarkAsUnread?: (messages: any[]) => void | Promise<void>;
  onArchive?: (messages: any[]) => void | Promise<void>;
  /** The list pane's search box (Mail.tsx owns the query and the body limit). */
  searchQuery?: string;
  bodySearchLimit?: number;
  onSearchStatus?: (status: MailboxSearchStatus) => void;
}

const toErrorMessage = (error: any): string => {
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Couldn't reach the node.";
};

const getRowId = (row: any): string => String(row?.id || row?.identifier || "");

export const AliasMail = ({
  value,
  onOpen,
  messageOpenedId,
  onMessagesLoaded,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  searchQuery = "",
  bodySearchLimit = 0,
  onSearchStatus,
}: AliasMailProps) => {
  const { user } = useSelector((state: RootState) => state.auth);
  const hashMapMailMessages = useSelector((state: RootState) => state.mail.hashMapMailMessages);
  const archived = useSelector(selectArchived);
  const address = user?.address || "";
  const alias = (value || "").trim();
  const enabled = Boolean(alias && address);

  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<ListStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const offsetRef = useRef(0);
  const rowsRef = useRef<any[]>([]);
  const loadIdRef = useRef(0);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const loadFirstPage = useCallback(async () => {
    if (!enabled) return;
    const loadId = ++loadIdRef.current;
    setStatus("loading");
    setLoadError(null);
    try {
      const page = await fetchAliasInboxPage(alias, address, 0, ALIAS_PAGE_SIZE);
      if (loadIdRef.current !== loadId) return;
      offsetRef.current = ALIAS_PAGE_SIZE;
      setRows(page.rows);
      setHasMore(page.hasMore);
      setStatus("ready");
    } catch (error) {
      if (loadIdRef.current !== loadId) return;
      setLoadError(toErrorMessage(error));
      setStatus("error");
    }
  }, [address, alias, enabled]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || isLoadingMore) return;
    const loadId = loadIdRef.current;
    setIsLoadingMore(true);
    try {
      const offset = offsetRef.current;
      const page = await fetchAliasInboxPage(alias, address, offset, ALIAS_PAGE_SIZE);
      if (loadIdRef.current !== loadId) return;
      offsetRef.current = offset + ALIAS_PAGE_SIZE;
      setRows(previous => {
        const known = new Set(previous.map(getRowId));
        const fresh = page.rows.filter(row => !known.has(getRowId(row)));
        return fresh.length ? [...previous, ...fresh] : previous;
      });
      setHasMore(page.hasMore);
    } catch {
      // Keep what we have; the button stays for another try.
    } finally {
      if (loadIdRef.current === loadId) setIsLoadingMore(false);
    }
  }, [address, alias, enabled, hasMore, isLoadingMore]);

  useEffect(() => {
    offsetRef.current = 0;
    setRows([]);
    setHasMore(false);
    setIsLoadingMore(false);
    if (!enabled) {
      setStatus("idle");
      return;
    }
    void loadFirstPage();
  }, [enabled, loadFirstPage]);

  // Delta poll: the newest 20 per query, merged in front; `false` backs off.
  usePolling(
    async () => {
      if (!enabled) return;
      const recent = await fetchRecentInboxMessagesForOwnedName(alias, address);
      const merged = mergeNewRows(rowsRef.current, recent);
      if (merged === rowsRef.current) return false;
      setRows(merged);
      return true;
    },
    { intervalMs: ALIAS_POLL_INTERVAL_MS, enabled }
  );

  // Archived rows and rows whose body turned out to be the delete marker
  // (hash entry `deleted`, see fetchMail.ts) stay out of the list.
  const visibleRows = useMemo(() => {
    return withoutDeletedRows(rows, hashMapMailMessages).filter(
      row => !isArchivedId(archived, getRowId(row))
    );
  }, [archived, hashMapMailMessages, rows]);

  useEffect(() => {
    if (!enabled || status === "idle" || status === "loading") return;
    onMessagesLoaded?.(alias, rows);
    publishMailIndex(aliasIndexKey(alias), rows);
  }, [alias, enabled, onMessagesLoaded, rows, status]);

  const { results, status: searchStatus } = useMailboxSearch({
    messages: visibleRows,
    query: searchQuery,
    mailboxType: "inbox",
    username: user?.name,
    hashMapMailMessages,
    enabled,
    bodyLimit: bodySearchLimit,
  });

  useEffect(() => {
    onSearchStatus?.(searchStatus);
  }, [onSearchStatus, searchStatus]);

  const openMessage = useCallback(
    (messageUser: string, messageIdentifier: string) => {
      void onOpen(messageUser, messageIdentifier, {});
    },
    [onOpen]
  );

  const hasQuery = searchQuery.trim().length > 0;
  const footer =
    hasMore && !hasQuery ? (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 1 }}>
        <Button
          variant="outlined"
          onClick={() => void loadMore()}
          disabled={isLoadingMore}
          sx={{ minHeight: 44, textTransform: "none" }}
        >
          {isLoadingMore ? "Loading…" : "Load older messages"}
        </Button>
        <LoadMoreSentinel onVisible={() => void loadMore()} disabled={isLoadingMore} />
      </Box>
    ) : null;

  return (
    <GroupedMailboxList
      messages={results}
      mailboxType="inbox"
      showSelectAll
      openMessage={openMessage}
      openedMessageId={messageOpenedId}
      onMarkAsRead={onMarkAsRead}
      onMarkAsUnread={onMarkAsUnread}
      onArchive={onArchive}
      status={status}
      errorMessage={loadError || undefined}
      onRetry={() => void loadFirstPage()}
      highlightTerms={searchStatus.terms}
      emptyIcon={<AlternateEmailOutlinedIcon />}
      emptyTitle={hasQuery ? "No matches" : "No mail for this alias yet"}
      emptyHint={
        hasQuery
          ? "Try fewer words, or search message bodies."
          : (
            <>
              Mail addressed to <NameText name={alias} /> shows up here. Give the alias to people who should
              reach you this way.
            </>
          )
      }
      footer={footer}
    />
  );
};
