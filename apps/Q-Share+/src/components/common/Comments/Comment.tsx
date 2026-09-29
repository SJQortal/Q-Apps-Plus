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
  CommentDateText,
  ReplyCard,
  StyledCardColComment,
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

/** A base comment with its replies, reply box and (for the author) an edit dialog. */
export const Comment = ({ comment, postId, postName, onSubmit }: CommentProps) => {
  const [isReplying, setIsReplying] = useState<boolean>(false);
  const { user } = useSelector((state: RootState) => state.auth);
  const [currentEdit, setCurrentEdit] = useState<any>(null);

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

      <CommentCard name={comment?.name} message={comment?.message} replies={comment?.replies || []} setCurrentEdit={setCurrentEdit}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, marginTop: 1.5, justifyContent: "space-between", flexWrap: "wrap" }}>
          {comment?.created && <CommentDateText>{formatDate(+comment.created)}</CommentDateText>}
          <CommentActionButtonRow>
            {user?.name && !isReplying && (
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
            {user?.name === comment?.name && (
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
        </Box>
      </CommentCard>

      {isReplying && (
        <Box sx={{ display: "flex", width: "100%", flexDirection: "column", alignItems: "center" }}>
          <CommentEditor onSubmit={handleSubmit} postId={postId} postName={postName} isReply commentId={comment.identifier} />
        </Box>
      )}
    </Box>
  );
};

const CommentCard = ({ message, name, replies, children, setCurrentEdit }: any) => {
  const { user } = useSelector((state: RootState) => state.auth);

  return (
    <CardContentContainerComment>
      <StyledCardHeaderComment>
        <Avatar src={name ? avatarUrl(name) : undefined} alt="" sx={{ width: 35, height: 35 }} slotProps={{ img: { loading: "lazy" } }} />
        <StyledCardColComment>
          <AuthorTextComment>{name}</AuthorTextComment>
        </StyledCardColComment>
      </StyledCardHeaderComment>
      <StyledCardContentComment>
        <StyledCardComment>{message}</StyledCardComment>
      </StyledCardContentComment>
      {replies?.length > 0 && (
        <Box sx={{ paddingLeft: { xs: 1, sm: 2 }, display: "flex", flexDirection: "column", gap: 1, marginTop: 1 }}>
          {replies.map((reply: any) => (
            <ReplyCard key={reply?.identifier} id={reply?.identifier}>
              <CommentCard name={reply?.name} message={reply?.message} setCurrentEdit={setCurrentEdit}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between", flexWrap: "wrap" }}>
                  {reply?.created && <CommentDateText>{formatDate(+reply.created)}</CommentDateText>}
                  {user?.name === reply?.name && (
                    <CommentActionButton
                      size="small"
                      variant="outlined"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => setCurrentEdit(reply)}
                      aria-label="Edit your reply"
                    >
                      Edit
                    </CommentActionButton>
                  )}
                </Box>
              </CommentCard>
            </ReplyCard>
          ))}
        </Box>
      )}
      {children}
    </CardContentContainerComment>
  );
};
