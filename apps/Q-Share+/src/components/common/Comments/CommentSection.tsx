import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentEditor } from "./CommentEditor";
import { Comment } from "./Comment";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommentContainer,
  CommentEditorContainer,
  CommentsContainer,
  CommentsPanel,
  CommentsTitle,
  LoadMoreCommentsButton,
  LoadMoreCommentsButtonRow,
  NoCommentsRow,
} from "./Comments-styles";
import { QSHARE_COMMENT_BASE, QSHARE_FILE_BASE } from "../../../constants/Identifiers.ts";
import { fetchQdnText, mapWithConcurrency, searchQdn, searchQdnAll } from "../../../utils/qdnSearch";
import { isNameHidden, useAppSettings } from "../../../utils/settings";

const COMMENT_PAGE = 20;

/**
 * The only `commentsId` the original app writes (`qshare_file__cm_<short id>`).
 * It comes from untrusted share JSON and becomes a Core LIKE prefix, where `%`
 * and `_` are wildcards, so any other value is not searched at all.
 */
const COMMENTS_ID_SHAPE = new RegExp(`^${QSHARE_FILE_BASE}_cm_[A-Za-z0-9]{1,32}$`);

/**
 * One page of base comments from `offset`, plus (on the first page) every
 * reply of the share from one prefix search, each with its body text.
 *
 * The original app keys comments by the last 12 characters of the share id,
 * and so does everything we publish. Some other client keyed them by the
 * share JSON's `commentsId` instead (real rows exist, one from a publisher),
 * so on the first page one more prefix search reads those, base and replies
 * together. `nextOffset` only counts the paged search, so they never shift it.
 * A body the node can't serve is left out and counted in `unreadable`.
 */
async function loadComments(
  postId: string,
  offset: number,
  commentsId?: string
): Promise<{ comments: any[]; unreadable: number; hasMore: boolean; nextOffset: number }> {
  const postKey = postId.slice(-12);
  const extraPrefix =
    offset === 0 && commentsId && commentsId !== postKey && COMMENTS_ID_SHAPE.test(commentsId)
      ? `${QSHARE_COMMENT_BASE}${commentsId}_`
      : "";
  const [baseRows, replies, extraRows] = await Promise.all([
    searchQdn({
      service: "BLOG_COMMENT",
      query: `${QSHARE_COMMENT_BASE}${postKey}_base_`,
      limit: COMMENT_PAGE,
      offset,
      reverse: false,
    }),
    offset === 0
      ? searchQdnAll(
          {
            service: "BLOG_COMMENT",
            query: `${QSHARE_COMMENT_BASE}${postKey}_reply_`,
            reverse: false,
          },
          { pageSize: 100, maxPages: 5 }
        ).then((r) => r.rows)
      : Promise.resolve([]),
    extraPrefix
      ? searchQdnAll(
          { service: "BLOG_COMMENT", identifier: extraPrefix, prefix: true, reverse: false },
          { pageSize: 100, maxPages: 5 }
        )
          .then((r) => r.rows.filter((c) => c.identifier?.startsWith(extraPrefix))) // Core matches case-insensitively
          // Additive only: if this read fails, the upstream-key comments still show.
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const seen = new Set<string>();
  const rows = [...baseRows, ...extraRows, ...replies].filter((c) => {
    if (!c.identifier || !c.name || seen.has(c.identifier)) return false;
    seen.add(c.identifier);
    return true;
  });
  // Oldest first, as each search returns them, with the extra rows slotted in by date.
  if (extraRows.length > 0) rows.sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  // A body the node can't serve (missing data, a 404) is left out, never shown
  // as the node's error text, and one bad row doesn't hide the others.
  const read = await mapWithConcurrency(rows, 5, async (comment) => {
    try {
      return { ...comment, message: await fetchQdnText("BLOG_COMMENT", comment.name, comment.identifier) };
    } catch {
      return null;
    }
  });
  const comments = read.filter((c) => c !== null);
  // Counted, not thrown: the section says how many are missing (with Retry)
  // and still shows the rest, and anything the user posts meanwhile.
  return {
    comments,
    unreadable: rows.length - comments.length,
    hasMore: baseRows.length === COMMENT_PAGE,
    nextOffset: offset + baseRows.length,
  };
}

interface CommentSectionProps {
  postId: string;
  postName: string;
  /** The share JSON's `commentsId`, when it has one: comments keyed by it are shown too. */
  commentsId?: string;
}

/**
 * Comments of one share. Base comments come one page at a time; all replies of
 * the share come from one prefix search. Authors on the in-app hidden list are
 * left out, replies included.
 */
export const CommentSection = ({ postId, postName, commentsId }: CommentSectionProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useAppSettings();
  const [listComments, setListComments] = useState<any[]>([]);
  const { user } = useSelector((state: RootState) => state.auth);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  // Comments found whose text the node couldn't serve (left out of the list).
  const [unreadable, setUnreadable] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  // Where the next page of base comments starts. Comments posted here and the
  // commentsId ones are in the list too, so the list length can't be used.
  const [nextOffset, setNextOffset] = useState<number>(0);
  const panelRef = useRef<HTMLElement>(null);
  const wantsComments = location.hash === "#comments";

  // A notification opens the share at #comments: scroll there once the first page is in.
  useEffect(() => {
    if (wantsComments && !loadingComments) panelRef.current?.scrollIntoView({ block: "start" });
  }, [wantsComments, loadingComments]);

  const onSubmit = (obj?: any, isEdit?: boolean) => {
    if (isEdit) {
      setListComments((prev: any[]) => {
        const findCommentIndex = prev.findIndex((item) => item?.identifier === obj?.identifier);
        if (findCommentIndex === -1) return prev;
        const newArray = [...prev];
        newArray[findCommentIndex] = obj;
        return newArray;
      });
      return;
    }
    setListComments((prev) => [...prev, { ...obj }]);
  };

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    let commentVar = query?.get("comment");
    if (commentVar) {
      if (commentVar.endsWith("/")) commentVar = commentVar.slice(0, -1);
      if (listComments.length > 0) {
        const el = document.getElementById(commentVar);
        if (el) {
          el.scrollIntoView();
          el.classList.add("glow");
          setTimeout(() => el.classList.remove("glow"), 2000);
        }
        navigate(location.pathname, { replace: true });
      }
    }
  }, [navigate, location, listComments]);

  /**
   * Callers set `loadingComments` (and clear `loadError`) first, so the first load can start from an effect.
   * `keepListed` keeps what the list already shows (a comment just posted, which a cached search
   * may not have yet) when page one is loaded again.
   */
  const getComments = useCallback(
    (offset = 0, keepListed = false) => {
      let active = true;
      loadComments(postId, offset, commentsId)
        .then(({ comments, unreadable: missing, hasMore: more, nextOffset: next }) => {
          if (!active) return;
          setHasMore(more);
          setNextOffset(next);
          if (offset > 0) {
            setUnreadable((n) => n + missing);
            setListComments((prev) => {
              const known = new Set(prev.map((c) => c.identifier));
              return [...prev, ...comments.filter((c) => !known.has(c.identifier))];
            });
          } else {
            setUnreadable(missing);
            setListComments((prev) => {
              if (!keepListed) return comments;
              const loaded = new Set(comments.map((c) => c.identifier));
              return [...comments, ...prev.filter((c) => !loaded.has(c.identifier))];
            });
          }
        })
        .catch(() => {
          if (active) setLoadError(true);
        })
        .finally(() => {
          if (active) setLoadingComments(false);
        });
      return () => {
        active = false;
      };
    },
    [postId, commentsId]
  );

  useEffect(() => getComments(), [getComments]);

  const retry = () => {
    setLoadError(false);
    setUnreadable(0);
    setLoadingComments(true);
    getComments(0, true);
  };

  const loadMore = () => {
    setLoadingComments(true);
    getComments(nextOffset);
  };

  const structuredCommentList = useMemo(() => {
    const visible = listComments.filter((c) => !isNameHidden(c?.name, settings));
    return visible.reduce((acc, curr) => {
      if (curr?.identifier?.includes("_reply_")) return acc;
      acc.push({
        ...curr,
        replies: visible.filter((comment) => comment.identifier.includes(`_reply_${curr.identifier.slice(-6)}`)),
      });
      return acc;
    }, [] as any[]);
  }, [listComments, settings]);

  // Nothing hides the list: what could be read, and anything posted here, always shows.
  const couldNotLoad = loadError || unreadable > 0;
  const retryButton = (
    <Button size="small" sx={{ ml: 1, minHeight: 44 }} onClick={retry}>
      Retry
    </Button>
  );

  return (
    <CommentsPanel ref={panelRef} id="comments" aria-labelledby="comments-title">
      <CommentsTitle id="comments-title" component="h2">
        Comments
      </CommentsTitle>
      <CommentsContainer>
        {loadingComments && listComments.length === 0 ? (
          <NoCommentsRow role="status" aria-label="Loading comments">
            <CircularProgress size={24} />
          </NoCommentsRow>
        ) : structuredCommentList.length === 0 ? (
          couldNotLoad ? (
            <NoCommentsRow role="status">
              Comments could not be loaded.
              {retryButton}
            </NoCommentsRow>
          ) : (
            <NoCommentsRow role="status">No comments yet. Be the first to comment.</NoCommentsRow>
          )
        ) : (
          <>
            {couldNotLoad && (
              <Box
                role="status"
                sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", mb: 1, fontSize: 14, color: "text.secondary" }}
              >
                {loadError
                  ? "Some comments could not be loaded."
                  : `${unreadable} ${unreadable === 1 ? "comment" : "comments"} could not be loaded.`}
                {retryButton}
              </Box>
            )}
            <CommentContainer>
              {structuredCommentList.map((comment: any) => (
                <Comment key={comment?.identifier} comment={comment} onSubmit={onSubmit} postId={postId} postName={postName} />
              ))}
            </CommentContainer>
          </>
        )}
        {hasMore && (
          <LoadMoreCommentsButtonRow>
            <LoadMoreCommentsButton onClick={loadMore} variant="outlined" disabled={loadingComments}>
              {loadingComments ? "Loading…" : "Load more comments"}
            </LoadMoreCommentsButton>
          </LoadMoreCommentsButtonRow>
        )}
      </CommentsContainer>
      <CommentEditorContainer>
        {user?.name ? (
          <CommentEditor onSubmit={onSubmit} postId={postId} postName={postName} />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Sign in to Hub with a Qortal name to comment.
          </Typography>
        )}
      </CommentEditorContainer>
    </CommentsPanel>
  );
};
