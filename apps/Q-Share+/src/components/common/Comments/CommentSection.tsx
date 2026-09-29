import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommentEditor } from "./CommentEditor";
import { Comment } from "./Comment";
import { Box, Button, CircularProgress, useTheme } from "@mui/material";
import { styled } from "@mui/system";
import { useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import { useNavigate, useLocation } from "react-router-dom";
import {
  CommentContainer,
  CommentEditorContainer,
  CommentsContainer,
  LoadMoreCommentsButton,
  LoadMoreCommentsButtonRow,
  NoCommentsRow,
} from "./Comments-styles";
import { QSHARE_COMMENT_BASE } from "../../../constants/Identifiers.ts";
import { fetchQdnText, mapWithConcurrency, searchQdn, searchQdnAll } from "../../../utils/qdnSearch";

const COMMENT_PAGE = 20;
import { CrowdfundSubTitle, CrowdfundSubTitleRow } from "../../PublishFile/Upload-styles.tsx";

interface CommentSectionProps {
  postId: string;
  postName: string;
}

const Panel = styled("div")`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding-bottom: 10px;
  height: 100%;
  overflow: hidden;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--qp-divider);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--qp-text-secondary);
  }
`;
export const CommentSection = ({ postId, postName }: CommentSectionProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [listComments, setListComments] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { user } = useSelector((state: RootState) => state.auth);
  const [newMessages, setNewMessages] = useState(0);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const onSubmit = (obj?: any, isEdit?: boolean) => {
    if (isEdit) {
      setListComments((prev: any[]) => {
        const findCommentIndex = prev.findIndex(
          item => item?.identifier === obj?.identifier
        );
        if (findCommentIndex === -1) return prev;

        const newArray = [...prev];
        newArray[findCommentIndex] = obj;
        return newArray;
      });

      return;
    }
    setListComments(prev => [
      ...prev,
      {
        ...obj,
      },
    ]);
  };

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    let commentVar = query?.get("comment");
    if (commentVar) {
      if (commentVar && commentVar.endsWith("/")) {
        commentVar = commentVar.slice(0, -1);
      }
      setIsOpen(true);
      if (listComments.length > 0) {
        const el = document.getElementById(commentVar);
        if (el) {
          el.scrollIntoView();
          el.classList.add("glow");
          setTimeout(() => {
            el.classList.remove("glow");
          }, 2000);
        }
        navigate(location.pathname, { replace: true });
      }
    }
  }, [navigate, location, listComments]);

  /** Base comments come one page at a time; all replies of the share come from one prefix search. */
  const getComments = useCallback(
    async (isNewMessages?: boolean, numberOfComments?: number) => {
      try {
        setLoadingComments(true);
        setLoadError(false);
        const offset = isNewMessages && numberOfComments ? numberOfComments : 0;
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
        setHasMore(baseRows.length === COMMENT_PAGE);
        if (isNewMessages) {
          setListComments((prev) => {
            const known = new Set(prev.map((c) => c.identifier));
            return [...prev, ...comments.filter((c) => !known.has(c.identifier))];
          });
          setNewMessages(0);
        } else {
          setListComments(comments);
        }
      } catch (error) {
        console.error(error);
        setLoadError(true);
      } finally {
        setLoadingComments(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    getComments();
  }, [getComments, postId]);

  const structuredCommentList = useMemo(() => {
    return listComments.reduce((acc, curr, index, array) => {
      if (curr?.identifier?.includes("_reply_")) {
        return acc;
      }
      acc.push({
        ...curr,
        replies: array.filter(comment =>
          comment.identifier.includes(`_reply_${curr.identifier.slice(-6)}`)
        ),
      });
      return acc;
    }, []);
  }, [listComments]);

  return (
    <>
    
      <Panel>
      <CrowdfundSubTitleRow >
        <CrowdfundSubTitle>Comments</CrowdfundSubTitle>
      </CrowdfundSubTitleRow>
        <CommentsContainer>
          {loadingComments ? (
            <NoCommentsRow>
              <CircularProgress />
            </NoCommentsRow>
          ) : loadError ? (
            <NoCommentsRow>
              Comments could not be loaded.
              <Button size="small" sx={{ ml: 1 }} onClick={() => getComments()}>
                Retry
              </Button>
            </NoCommentsRow>
          ) : listComments.length === 0 ? (
            <NoCommentsRow>
              There are no comments yet. Be the first to comment!
            </NoCommentsRow>
          ) : (
            <CommentContainer>
              {structuredCommentList.map((comment: any) => {
                return (
                  <Comment
                    key={comment?.identifier}
                    comment={comment}
                    onSubmit={onSubmit}
                    postId={postId}
                    postName={postName}
                  />
                );
              })}
            </CommentContainer>
          )}
          {hasMore && (
            <LoadMoreCommentsButtonRow>
              <LoadMoreCommentsButton
                onClick={() => {
                  getComments(
                    true,
                    listComments.filter(
                      item => !item.identifier.includes("_reply_")
                    ).length
                  );
                }}
                variant="contained"
                size="small"
              >
                Load More Comments
              </LoadMoreCommentsButton>
            </LoadMoreCommentsButtonRow>
          )}
        </CommentsContainer>
        <CommentEditorContainer>
          <CommentEditor
            onSubmit={onSubmit}
            postId={postId}
            postName={postName}
          />
        </CommentEditorContainer>
      </Panel>
    </>
  );
};
