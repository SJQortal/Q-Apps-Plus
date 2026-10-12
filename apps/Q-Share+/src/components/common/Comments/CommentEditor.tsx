import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import ShortUniqueId from "short-unique-id";
import { setNotification } from "../../../state/features/notificationsSlice";
import localforage from "localforage";
import { CommentInput, CommentInputContainer, SubmitCommentButton } from "./Comments-styles";
import { QSHARE_COMMENT_BASE } from "../../../constants/Identifiers.ts";
import { errorMessage, isHubDecline } from "../../../utils/hubErrors";
import { invalidateQdnSearches } from "../../../utils/qdnSearch";

const uid = new ShortUniqueId();

const notification = localforage.createInstance({
  name: "notification",
});

const MAX_ITEMS = 10;
/** Comments are short (the original app's limit). */
export const MAX_COMMENT_LENGTH = 200;

export interface Item {
  id: string;
  lastSeen: number;
  postId: string;
  postName: string;
}

export async function addItem(item: Item): Promise<void> {
  const notificationComments: Item[] = (await notification.getItem("comments")) || [];
  const existingItemIndex = notificationComments.findIndex((i) => i.id === item.id);
  if (existingItemIndex !== -1) {
    notificationComments[existingItemIndex].lastSeen = item.lastSeen;
  } else {
    notificationComments.push(item);
    if (notificationComments.length > MAX_ITEMS) {
      notificationComments.sort((a, b) => b.lastSeen - a.lastSeen);
      notificationComments.pop();
    }
  }
  await notification.setItem("comments", notificationComments);
}

export async function updateItemDate(item: any): Promise<void> {
  const notificationComments: Item[] = (await notification.getItem("comments")) || [];
  const notificationCreatorComment: any = (await notification.getItem("post-comments")) || {};
  const findPostId = notificationCreatorComment[item.postId];
  if (findPostId) {
    notificationCreatorComment[item.postId].lastSeen = item.lastSeen;
  }
  notificationComments.forEach((nc, index) => {
    if (nc.postId === item.postId) {
      notificationComments[index].lastSeen = item.lastSeen;
    }
  });
  await notification.setItem("comments", notificationComments);
  await notification.setItem("post-comments", notificationCreatorComment);
}

interface CommentEditorProps {
  postId: string;
  postName: string;
  onSubmit: (obj: any) => void;
  isReply?: boolean;
  commentId?: string;
  isEdit?: boolean;
  commentMessage?: string;
}

function utf8ToBase64(inputString: string): string {
  const utf8String = encodeURIComponent(inputString).replace(/%([0-9A-F]{2})/g, (_match, p1) =>
    String.fromCharCode(Number("0x" + p1))
  );
  return btoa(utf8String);
}

/**
 * Writes a BLOG_COMMENT with the original app's identifier scheme
 * (`qcomment_v1_qshare_<last 12 of share id>_base_<uid>` or
 * `…_reply_<last 6 of base id>_<uid>`), raw UTF-8 text, at most 200 characters.
 */
export const CommentEditor = ({ onSubmit, postId, postName, isReply, commentId, isEdit, commentMessage }: CommentEditorProps) => {
  const [value, setValue] = useState<string>(() => (isEdit && commentMessage ? commentMessage : ""));
  const [submitting, setSubmitting] = useState(false);
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);

  const empty = value.trim().length === 0;
  const over = value.length > MAX_COMMENT_LENGTH;

  const publishComment = async (identifier: string, idForNotification?: string) => {
    const address = user?.address;
    const name = user?.name || "";
    let errorMsg = "";
    if (!address) errorMsg = "Cannot post: your address isn't available";
    if (!name) errorMsg = "Cannot post without a name";
    if (value.length > MAX_COMMENT_LENGTH) errorMsg = `Comment needs to be under ${MAX_COMMENT_LENGTH} characters`;
    if (errorMsg) {
      dispatch(setNotification({ msg: errorMsg, alertType: "error" }));
      throw new Error(errorMsg);
    }

    try {
      const base64 = utf8ToBase64(value);
      const resourceResponse = await qortalRequest({
        action: "PUBLISH_QDN_RESOURCE",
        name,
        service: "BLOG_COMMENT",
        data64: base64,
        identifier,
      });
      dispatch(setNotification({ msg: "Comment published", alertType: "success" }));
      // Comment searches read again from here on; notifications learn about the new comment
      // (Hub alerts get a rule for replies to it).
      invalidateQdnSearches((url) => url.includes("service=BLOG_COMMENT"));
      if (idForNotification) {
        addItem({ id: idForNotification, lastSeen: Date.now(), postId, postName });
      }
      return resourceResponse;
    } catch (error) {
      // Saying no in Hub's dialog (in any of its languages) isn't a failure: keep the text, say nothing.
      if (!isHubDecline(error)) {
        dispatch(setNotification({ msg: errorMessage(error, "Failed to publish comment"), alertType: "error" }));
      }
      throw new Error("Failed to publish comment");
    }
  };

  const handleSubmit = async () => {
    if (empty || over || submitting) return;
    setSubmitting(true);
    try {
      const id = uid();
      const postKey = postId.slice(-12);
      let identifier = `${QSHARE_COMMENT_BASE}${postKey}_base_${id}`;
      let idForNotification = identifier;
      if (isReply && commentId) {
        identifier = `${QSHARE_COMMENT_BASE}${postKey}_reply_${commentId.slice(-6)}_${id}`;
        idForNotification = commentId;
      }
      if (isEdit && commentId) {
        identifier = commentId;
      }
      await publishComment(identifier, idForNotification);
      onSubmit({
        created: Date.now(),
        identifier,
        message: value,
        service: "BLOG_COMMENT",
        name: user?.name,
      });
      setValue("");
    } catch {
      /* the toast above said what failed (a decline needs none); the text stays for another try */
    } finally {
      setSubmitting(false);
    }
  };

  const inputLabel = isReply ? "Your reply" : isEdit ? "Edit your comment" : "Your comment";
  const counterId = `comment-count-${isReply ? "reply" : isEdit ? "edit" : "new"}-${commentId || postId}`;

  return (
    <CommentInputContainer>
      <CommentInput
        label={inputLabel}
        multiline
        minRows={2}
        maxRows={6}
        variant="filled"
        value={value}
        error={over}
        slotProps={{
          htmlInput: { maxLength: MAX_COMMENT_LENGTH, "aria-describedby": counterId },
        }}
        onChange={(e) => setValue(e.target.value)}
      />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, width: "100%", flexWrap: "wrap" }}>
        <Typography id={counterId} variant="caption" aria-live="polite" color={over ? "error" : "text.secondary"}>
          {value.length}/{MAX_COMMENT_LENGTH}
        </Typography>
        <SubmitCommentButton variant="contained" onClick={handleSubmit} disabled={empty || over || submitting}>
          {submitting ? "Publishing…" : isReply ? "Submit reply" : isEdit ? "Save changes" : "Submit comment"}
        </SubmitCommentButton>
      </Box>
    </CommentInputContainer>
  );
};
