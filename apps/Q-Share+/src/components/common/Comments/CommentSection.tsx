import { useCallback, useEffect, useMemo, useState } from "react";
import { CommentEditor } from "./CommentEditor";
import { Comment } from "./Comment";
import { Button, CircularProgress, Typography } from "@mui/material";
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
import { QSHARE_COMMENT_BASE } from "../../../constants/Identifiers.ts";
import { fetchQdnText, mapWithConcurrency, searchQdn, searchQdnAll } from "../../../utils/qdnSearch";
import { isNameHidden, useAppSettings } from "../../../utils/settings";

const COMMENT_PAGE = 20;

/**
 * One page of base comments from `offset`, plus (on the first page) every
 * reply of the share from one prefix search, each with its body text.
 */
async function loadComments(postId: string, offset: number): Promise<{ comments: any[]; hasMore: boolean }> {
  const postKey = postId.slice(-12);
  const [baseRows, replies] = await Promise.all([
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
  ]);
  const rows = [...baseRows, ...replies].filter((c) => c.identifier && c.name);
  const comments = await mapWithConcurrency(rows, 5, async (comment) => ({
    ...comment,
    message: await fetchQdnText("BLOG_COMMENT", comment.name, comment.identifier),
  }));
  return { comments, hasMore: baseRows.length === COMMENT_PAGE };
}

interface CommentSectionProps {
  postId: string;
  postName: string;
}

/**
 * Comments of one share. Base comments come one page at a time; all replies of
 * the share come from one prefix search. Authors on the in-app hidden list are
 * left out, replies included.
 */
export const CommentSection = ({ postId, postName }: CommentSectionProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useAppSettings();
  const [listComments, setListComments] = useState<any[]>([]);
  const { user } = useSelector((state: RootState) => state.auth);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);

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

  /** Callers set `loadingComments` (and clear `loadError`) first, so the first load can start from an effect. */
  const getComments = useCallback(
    (isNewMessages?: boolean, numberOfComments?: number) => {
      let active = true;
      const offset = isNewMessages && numberOfComments ? numberOfComments : 0;
      loadComments(postId, offset)
        .then(({ comments, hasMore: more }) => {
          if (!active) return;
          setHasMore(more);
          if (isNewMessages) {
            setListComments((prev) => {
              const known = new Set(prev.map((c) => c.identifier));
              return [...prev, ...comments.filter((c) => !known.has(c.identifier))];
            });
          } else {
            setListComments(comments);
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
    [postId]
  );

  useEffect(() => getComments(), [getComments]);

  const retry = () => {
    setLoadError(false);
    setLoadingComments(true);
    getComments();
  };

  const loadMore = () => {
    setLoadingComments(true);
    getComments(true, listComments.filter((item) => !item.identifier.includes("_reply_")).length);
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

  return (
    <CommentsPanel aria-labelledby="comments-title">
      <CommentsTitle id="comments-title" component="h2">
        Comments
      </CommentsTitle>
      <CommentsContainer>
        {loadingComments && listComments.length === 0 ? (
          <NoCommentsRow role="status" aria-label="Loading comments">
            <CircularProgress size={24} />
          </NoCommentsRow>
        ) : loadError ? (
          <NoCommentsRow role="status">
            Comments could not be loaded.
            <Button size="small" sx={{ ml: 1, minHeight: 44 }} onClick={retry}>
              Retry
            </Button>
          </NoCommentsRow>
        ) : structuredCommentList.length === 0 ? (
          <NoCommentsRow role="status">No comments yet. Be the first to comment.</NoCommentsRow>
        ) : (
          <CommentContainer>
            {structuredCommentList.map((comment: any) => (
              <Comment key={comment?.identifier} comment={comment} onSubmit={onSubmit} postId={postId} postName={postName} />
            ))}
          </CommentContainer>
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
