import { Avatar, Box } from "@mui/material";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { CommentEditor } from "./CommentEditor";
import {
  AuthorTextComment,
  CardContentContainerComment,
  CommentActionButton,
  CommentActionButtonRow,
  CommentAuthorLine,
  CommentDateText,
  ReplyCard,
  StyledCardComment,
  StyledCardContentComment,
  StyledCardHeaderComment,
} from "./Comments-styles";
import { RootState } from "../../../state/store";
import { ResponsiveDialog } from "../mobile/ResponsiveDialog";
import { formatDate } from "../../../utils/time";
import { avatarUrl } from "../../../utils/qortalLinks";

interface CommentProps {
  comment: any;
  postId: string;
  postName: string;
  onSubmit: (obj?: any, isEdit?: boolean) => void;
}

/**
 * A base comment: its own text and actions first, then the reply box, then
 * its replies, so the time and Reply never end up below someone else's reply.
 * The author also gets an edit dialog.
 */
export const Comment = ({ comment, postId, postName, onSubmit }: CommentProps) => {
  const [isReplying, setIsReplying] = useState<boolean>(false);
  const { user } = useSelector((state: RootState) => state.auth);
  const [currentEdit, setCurrentEdit] = useState<any>(null);
  const replies: any[] = comment?.replies || [];

  const handleSubmit = useCallback(
    (obj: any, isEdit?: boolean) => {
      onSubmit(obj, isEdit);
      setCurrentEdit(null);
      setIsReplying(false);
    },
    [onSubmit]
  );

  return (
    <Box id={comment?.identifier} sx={{ display: "flex", width: "100%", flexDirection: "column" }}>
      <ResponsiveDialog open={Boolean(currentEdit)} onClose={() => setCurrentEdit(null)} title="Edit comment" maxWidth="sm">
        {currentEdit && (
          <CommentEditor
            onSubmit={(obj) => handleSubmit(obj, true)}
            postId={postId}
            postName={postName}
            isEdit
            commentId={currentEdit?.identifier}
            commentMessage={currentEdit?.message}
          />
        )}
      </ResponsiveDialog>

      <CardContentContainerComment>
        <CommentBody name={comment?.name} message={comment?.message} created={comment?.created} />
        {user?.name && (
          <CommentActionButtonRow>
            {!isReplying && (
              <CommentActionButton
                size="small"
                variant="outlined"
                startIcon={<ReplyOutlinedIcon />}
                onClick={() => setIsReplying(true)}
                aria-label={`Reply to ${comment?.name}`}
              >
                Reply
              </CommentActionButton>
            )}
            {user.name === comment?.name && (
              <CommentActionButton
                size="small"
                variant="outlined"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setCurrentEdit(comment)}
                aria-label="Edit your comment"
              >
                Edit
              </CommentActionButton>
            )}
            {isReplying && (
              <CommentActionButton
                size="small"
                variant="text"
                startIcon={<CloseIcon />}
                onClick={() => setIsReplying(false)}
                aria-label="Cancel reply"
              >
                Cancel
              </CommentActionButton>
            )}
          </CommentActionButtonRow>
        )}
        {isReplying && <CommentEditor onSubmit={handleSubmit} postId={postId} postName={postName} isReply commentId={comment.identifier} />}

        {replies.length > 0 && (
          <Box sx={{ paddingLeft: { xs: 1, sm: 2 }, display: "flex", flexDirection: "column", gap: 1, marginTop: 1 }}>
            {replies.map((reply: any) => (
              <ReplyCard key={reply?.identifier} id={reply?.identifier}>
                <CardContentContainerComment>
                  <CommentBody name={reply?.name} message={reply?.message} created={reply?.created} />
                  {user?.name && user.name === reply?.name && (
                    <CommentActionButtonRow>
                      <CommentActionButton
                        size="small"
                        variant="outlined"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => setCurrentEdit(reply)}
                        aria-label="Edit your reply"
                      >
                        Edit
                      </CommentActionButton>
                    </CommentActionButtonRow>
                  )}
                </CardContentContainerComment>
              </ReplyCard>
            ))}
          </Box>
        )}
      </CardContentContainerComment>
    </Box>
  );
};

/** Avatar, author and time on one line, then the text. */
const CommentBody = ({ name, message, created }: { name?: string; message?: string; created?: number | string }) => {
  const when = Number(created);
  return (
    <>
      <StyledCardHeaderComment>
        <Avatar src={name ? avatarUrl(name) : undefined} alt="" sx={{ width: 35, height: 35 }} slotProps={{ img: { loading: "lazy" } }} />
        <CommentAuthorLine>
          <AuthorTextComment>{name}</AuthorTextComment>
          {created && Number.isFinite(when) ? (
            <CommentDateText component="time" dateTime={new Date(when).toISOString()}>
              {formatDate(when)}
            </CommentDateText>
          ) : null}
        </CommentAuthorLine>
      </StyledCardHeaderComment>
      <StyledCardContentComment>
        <StyledCardComment>{message}</StyledCardComment>
      </StyledCardContentComment>
    </>
  );
};
