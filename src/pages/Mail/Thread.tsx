import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, Skeleton } from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import { RootState } from "../../state/store";
import { MAIL_SERVICE_TYPE } from "../../constants/mail";
import { base64ToUint8Array, uint8ArrayToObject } from "../../utils/toBase64";
import { addToHashMapMail } from "../../state/features/mailSlice";
import { executeEvent } from "../../utils/events";
import { extractTextFromSlate } from "../../utils/extractTextFromSlate";
import { formatFullTimestamp } from "../../utils/time";
import { searchResources } from "../../utils/qdnSearch";
import { usePolling } from "../../hooks/usePolling";
import { useGroupMembers } from "../../hooks/useGroupMembers";
import { PaneHeader } from "../../layout/PaneHeader";
import { PaneScroll } from "../../layout/MailShell";
import { EmptyState, ErrorState } from "../../layout/states";
import { ShowMessage } from "./ShowMessageWithoutModal";
import {
  THREAD_MESSAGE_PAGE_SIZE,
  invalidateThreadSearches,
  normalizeGroupId,
  threadMessagesSearchParams,
  threadTokenFromThreadId,
} from "./threadData";
import { saveThreadViewed } from "./threadUnread";

// The composer pulls in the rich-text editor; load it the first time Post is pressed.
const NewThread = React.lazy(() => import("./NewThread").then((module) => ({ default: module.NewThread })));

export const THREAD_POLL_MS = 10_000;
export const THREAD_POLL_MAX_MS = 90_000;
const DECRYPT_CONCURRENCY = 4;
const QUOTE_MAX_CHARS = 400;
const QUOTE_MAX_LINES = 6;

interface ThreadProps {
  currentThread: any;
  groupInfo: any;
  closeThread: () => void;
  /** Members map override (`{[name]: {publicKey}}`); by default the shared cache supplies it. */
  members?: any;
  backLabel?: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const stripHtml = (value: string): string =>
  value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|blockquote|h[1-6]|pre)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

export const postPlainText = (message: any): string => {
  if (typeof message?.textContentV2 === "string" && message.textContentV2) return stripHtml(message.textContentV2).trim();
  if (Array.isArray(message?.textContent)) return extractTextFromSlate(message.textContent).trim();
  if (typeof message?.textContent === "string") return message.textContent.trim();
  if (typeof message?.htmlContent === "string" && message.htmlContent) return stripHtml(message.htmlContent).trim();
  return "";
};

/** The quote block that prefills a reply to a post, in the same spirit as mail replies. */
export const buildReplyQuoteHtml = (message: any): string => {
  const author = typeof message?.name === "string" && message.name ? message.name : "Unknown";
  const when = formatFullTimestamp(Number(message?.created || message?.createdAt) || 0);
  const text = postPlainText(message);
  let excerpt = text.length > QUOTE_MAX_CHARS ? `${text.slice(0, QUOTE_MAX_CHARS).trimEnd()}…` : text;
  const lines = excerpt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const shown = lines.slice(0, QUOTE_MAX_LINES);
  if (lines.length > QUOTE_MAX_LINES) shown.push("…");
  const body = (shown.length ? shown : ["- no message body -"]).map((line) => `<blockquote>${escapeHtml(line)}</blockquote>`).join("");
  return `<blockquote>On ${escapeHtml(when)}, ${escapeHtml(author)} wrote:</blockquote>${body}<p><br></p>`;
};

/** Keep only the rows newer than the newest known post (fixes the `slice(0, -1)` of the original poll). */
export const newerRows = (rows: any[], newestKnownId: string | undefined, knownIds: Set<string>): any[] => {
  const index = newestKnownId ? rows.findIndex((row) => row?.identifier === newestKnownId) : -1;
  const sliceLength = index === -1 ? rows.length : index;
  return rows.slice(0, sliceLength).filter((row) => row?.identifier && !knownIds.has(row.identifier));
};

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next];
        next += 1;
        await worker(item);
      }
    })
  );
}

export const Thread = ({ currentThread, groupInfo, closeThread, members, backLabel = "Back to threads" }: ThreadProps) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const hashMapMailMessages = useSelector((state: RootState) => state.mail.hashMapMailMessages);

  const groupId = normalizeGroupId(currentThread?.threadData?.groupId || groupInfo?.id);
  const threadId: string = currentThread?.threadId || currentThread?.identifier || "";
  const token = threadTokenFromThreadId(threadId);
  const threadTitle = currentThread?.threadData?.title || "Thread";
  const groupName = typeof groupInfo?.name === "string" && groupInfo.name.trim() ? groupInfo.name.trim() : "Group";

  const { membersByName, error: membersError } = useGroupMembers(members ? null : groupId);
  const composerMembers = members ?? membersByName;

  /** Search rows, newest first (as the search returns them). */
  const [messages, setMessages] = useState<any[]>([]);
  const messagesRef = useRef<any[]>([]);
  messagesRef.current = messages;
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerMounted, setComposerMounted] = useState(false);
  const [pendingComposer, setPendingComposer] = useState<{ quoteHtml?: string } | null>(null);
  const generation = useRef(0);
  const hashMapRef = useRef(hashMapMailMessages);
  hashMapRef.current = hashMapMailMessages;

  const decryptMessage = useCallback(
    async (row: any) => {
      if (!row?.identifier || hashMapRef.current[row.identifier]) return;
      try {
        const messageRes = await qortalRequest({
          action: "FETCH_QDN_RESOURCE",
          name: row.name,
          service: MAIL_SERVICE_TYPE,
          identifier: row.identifier,
          encoding: "base64",
        });
        const decryptRequest: any = { action: "DECRYPT_DATA", encryptedData: messageRes };
        const resDecrypt = await qortalRequest(decryptRequest);
        const decoded = uint8ArrayToObject(base64ToUint8Array(resDecrypt));
        dispatch(addToHashMapMail({ ...row, ...(decoded || {}), id: row.identifier }));
      } catch {
        /* stays a skeleton; the next poll or reopen tries again */
      }
    },
    [dispatch]
  );

  const decryptAll = useCallback(
    (rows: any[]) => runWithConcurrency(rows.filter((row) => !hashMapRef.current[row?.identifier]), DECRYPT_CONCURRENCY, decryptMessage),
    [decryptMessage]
  );

  const loadPage = useCallback(
    async (offset: number, reset: boolean) => {
      if (!groupId || !token) return;
      const run = reset ? ++generation.current : generation.current;
      if (reset) {
        setIsLoading(true);
        setError(null);
      } else {
        setIsLoadingMore(true);
      }
      try {
        const rows = await searchResources<any>(threadMessagesSearchParams(groupId, token, offset));
        if (run !== generation.current) return;
        setMessages((current) => {
          const base = reset ? [] : current;
          const known = new Set(base.map((row) => row.identifier));
          return [...base, ...rows.filter((row) => row?.identifier && !known.has(row.identifier))];
        });
        setHasMore(rows.length >= THREAD_MESSAGE_PAGE_SIZE);
        void decryptAll(rows);
      } catch (loadError: any) {
        if (run !== generation.current) return;
        setError(typeof loadError?.message === "string" ? loadError.message : "Could not load this thread");
      } finally {
        if (run === generation.current) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [decryptAll, groupId, token]
  );

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setComposerMounted(false);
    setPendingComposer(null);
    if (!user?.name || !threadId) return;
    void loadPage(0, true);
    saveThreadViewed(user.name, groupId, threadId);
  }, [groupId, loadPage, threadId, user?.name]);

  const checkNewPosts = useCallback(async () => {
    if (!groupId || !token) return false;
    const rows = await searchResources<any>(threadMessagesSearchParams(groupId, token, 0), { ttlMs: 0 });
    const current = messagesRef.current;
    const fresh = newerRows(rows, current[0]?.identifier, new Set(current.map((row) => row.identifier)));
    if (!fresh.length) return false;
    setMessages((existing) => {
      const known = new Set(existing.map((row) => row.identifier));
      return [...fresh.filter((row) => !known.has(row.identifier)), ...existing];
    });
    void decryptAll(fresh);
    if (user?.name) saveThreadViewed(user.name, groupId, threadId);
    return true;
  }, [decryptAll, groupId, threadId, token, user?.name]);

  usePolling(checkNewPosts, {
    intervalMs: THREAD_POLL_MS,
    maxIntervalMs: THREAD_POLL_MAX_MS,
    enabled: Boolean(user?.name && groupId && token),
  });

  const openComposer = useCallback((quoteHtml?: string) => {
    setPendingComposer({ quoteHtml });
    setComposerMounted(true);
  }, []);

  // Once the (lazy) composer is mounted, ask it to open with the pending quote.
  useEffect(() => {
    if (!composerMounted || !pendingComposer) return;
    const timer = setTimeout(() => {
      executeEvent("openNewThreadMessageModal", { quoteHtml: pendingComposer.quoteHtml });
      setPendingComposer(null);
    }, 0);
    return () => clearTimeout(timer);
  }, [composerMounted, pendingComposer]);

  const messageCallback = useCallback(
    (msg: any) => {
      dispatch(addToHashMapMail(msg));
      setMessages((existing) => [msg, ...existing.filter((row) => row.identifier !== msg.identifier)]);
      invalidateThreadSearches(groupId);
      if (user?.name) saveThreadViewed(user.name, groupId, threadId);
    },
    [dispatch, groupId, threadId, user?.name]
  );

  const canPost = Boolean(composerMembers && Object.keys(composerMembers).length);
  const chronological = useMemo(() => [...messages].reverse(), [messages]);

  if (!currentThread) return null;

  const postButton = (
    <Button
      variant="contained"
      startIcon={<SendOutlinedIcon />}
      onClick={() => openComposer()}
      disabled={!canPost}
      aria-label="Post a reply"
      title={!canPost ? (membersError ? "Could not load the group's members" : "Loading the group's members…") : undefined}
      sx={{ minHeight: 44, textTransform: "none", fontWeight: 600, borderRadius: 2, mr: 1 }}
    >
      Post
    </Button>
  );

  let body: React.ReactNode;
  if (error && !messages.length) {
    body = <ErrorState title="Could not load this thread" message={error} onRetry={() => void loadPage(0, true)} />;
  } else if (isLoading && !messages.length) {
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2 }} role="status" aria-label="Loading posts">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 3 }} />
        ))}
      </Box>
    );
  } else if (!messages.length) {
    body = (
      <EmptyState
        icon={<ForumOutlinedIcon />}
        title="No posts yet"
        hint="Be the first to post in this thread."
        action={canPost ? postButton : undefined}
      />
    );
  } else {
    body = (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: { xs: 1.5, sm: 2 }, maxWidth: 900, mx: "auto", width: "100%" }}>
        {hasMore && (
          <Button
            variant="outlined"
            onClick={() => void loadPage(messages.length, false)}
            disabled={isLoadingMore}
            sx={{ minHeight: 44, textTransform: "none", alignSelf: "center" }}
          >
            {isLoadingMore ? "Loading…" : "Load earlier posts"}
          </Button>
        )}
        {chronological.map((row) => {
          const full = hashMapMailMessages[row?.identifier];
          if (full) return <ShowMessage key={row.identifier} message={full} onReply={(msg) => openComposer(buildReplyQuoteHtml(msg))} />;
          return (
            <Skeleton
              key={row?.identifier}
              variant="rounded"
              height={120}
              sx={{ borderRadius: 3 }}
              aria-label="Decrypting post"
            />
          );
        })}
      </Box>
    );
  }

  return (
    <>
      <PaneHeader title={threadTitle} subtitle={groupName} onBack={closeThread} backLabel={backLabel} actions={postButton} />
      <PaneScroll>{body}</PaneScroll>
      {composerMounted && (
        <Suspense fallback={null}>
          <NewThread
            groupInfo={groupInfo}
            isMessage={true}
            currentThread={currentThread}
            messageCallback={messageCallback}
            members={composerMembers ?? {}}
          />
        </Suspense>
      )}
    </>
  );
};
