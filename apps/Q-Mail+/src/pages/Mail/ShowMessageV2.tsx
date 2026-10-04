/**
 * The message reader: header (avatar, sender, recipient, date), subject,
 * action row (Reply, Reply all, Forward, Save all), attachments, body, and
 * the earlier messages of the conversation collapsed with a count.
 *
 * Layout follows the pane's own width (ResizeObserver), not a viewport
 * query, so a 700 px Hub pane and a phone both get the compact form.
 *
 * Props stay compatible with Mail.tsx (message, setReplyTo, setForwardInfo,
 * alias, onClose, setIsOpen); onReplyAll and onForward are optional extras.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Button, IconButton, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import ReplyAllOutlinedIcon from "@mui/icons-material/ReplyAllOutlined";
import ForwardOutlinedIcon from "@mui/icons-material/ForwardOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import DOMPurify from "dompurify";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { setNotification } from "../../state/features/notificationsSlice";
import ReadOnlySlate from "../../components/editor/ReadOnlySlate";
import { AvatarWrapper } from "./MailTable";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { ShowMessageV2Replies } from "./ShowMessageV2Replies";
import { updateMessageDetails } from "../../utils/helpers";
import { AttachmentList, usableAttachments } from "../../components/AttachmentPreview/AttachmentList";
import { useDownloadAll } from "../../components/AttachmentPreview/useDownloadAll";
import { MessageDate } from "./MessageDate";

/** Below this pane width the reader stacks (subject under the header, wrapped actions). */
export const READER_COMPACT_WIDTH = 600;

export function useElementWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (typeof w === "number") setWidth(Math.round(w));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export interface ShowMessageV2Props {
  message: any;
  setReplyTo?: (message: any) => void;
  setForwardInfo?: (html: string) => void;
  alias?: string | null;
  onClose?: () => void;
  setIsOpen?: (open: boolean) => void;
  isOpen?: boolean;
  /** Optional: shows a Reply all button that receives the message. */
  onReplyAll?: (message: any) => void;
  /** Optional: richer forward hand-off; when absent, setForwardInfo(html) is called. */
  onForward?: (info: { html: string; subject: string; attachments: any[]; message: any }) => void;
}

export const ShowMessageV2 = ({ setIsOpen, message, setReplyTo, alias, setForwardInfo, onClose, onReplyAll, onForward }: ShowMessageV2Props) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const compact = width > 0 && width < READER_COMPACT_WIDTH;
  const [showEarlier, setShowEarlier] = useState(false);

  const attachments = useMemo(() => usableAttachments(message?.attachments), [message?.attachments]);
  const downloadAll = useDownloadAll(attachments);

  const earlier = useMemo(() => {
    const thread = Array.isArray(message?.generalData?.threadV2) ? message.generalData.threadV2 : [];
    return thread
      .filter((entry: any) => entry?.data && !entry.data.markedAsReadLocally && (entry.data.user || entry.data.subject || entry.data.textContentV2))
      .sort((a: any, b: any) => (Number(a.data?.createdAt) || 0) - (Number(b.data?.createdAt) || 0));
  }, [message?.generalData?.threadV2]);

  useEffect(() => {
    setShowEarlier(false);
  }, [message?.id]);

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    if (typeof setIsOpen === "function") setIsOpen(false);
  };

  const handleReply = () => setReplyTo?.(message);

  const handleForwardedMessage = useCallback(() => {
    if (!username) return;
    let secondpart = "";
    if (message?.textContentV2) secondpart = message.textContentV2;
    if (message?.htmlContent) secondpart = DOMPurify.sanitize(message.htmlContent);
    let newTo = username;
    if (alias) newTo = `${alias} (alias inbox)`;
    // updateMessageDetails escapes its arguments (src/utils/mailCompose.ts).
    const firstPart = updateMessageDetails(message?.user, message?.subject || "", newTo);
    const fullMessage = firstPart + secondpart;
    if (onForward) {
      onForward({ html: fullMessage, subject: message?.subject || "", attachments, message });
      return;
    }
    setForwardInfo?.(fullMessage);
  }, [alias, attachments, message, onForward, setForwardInfo, username]);

  const saveAll = async () => {
    const result = await downloadAll.run();
    if (result.failed.length) {
      dispatch(setNotification({ msg: `Could not save: ${result.failed.join(", ")}`, alertType: "error" }));
    } else if (result.saved > 0) {
      dispatch(setNotification({ msg: `Saved ${result.saved} file${result.saved === 1 ? "" : "s"}`, alertType: "success" }));
    }
  };

  const recipient = message?.recipient || message?.to;
  const subject = message?.subject || "(no subject)";
  const cleanHTML = message?.htmlContent ? DOMPurify.sanitize(message.htmlContent) : "";

  const actionSx = { minHeight: 44, textTransform: "none" as const, flexShrink: 0 };
  const actions = (
    <Box role="group" aria-label="Message actions" sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
      <Button variant="outlined" startIcon={<ReplyOutlinedIcon />} onClick={handleReply} disabled={!setReplyTo} sx={actionSx}>
        Reply
      </Button>
      {onReplyAll && (
        <Button variant="outlined" startIcon={<ReplyAllOutlinedIcon />} onClick={() => onReplyAll(message)} sx={actionSx}>
          Reply all
        </Button>
      )}
      <Button variant="outlined" startIcon={<ForwardOutlinedIcon />} onClick={handleForwardedMessage} disabled={!username} sx={actionSx}>
        Forward
      </Button>
      {attachments.length > 1 && (
        <Button
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={downloadAll.progress.active ? downloadAll.cancel : () => void saveAll()}
          sx={actionSx}
        >
          {downloadAll.progress.active ? `Saving ${downloadAll.progress.current} of ${downloadAll.progress.total}… Cancel` : `Save all (${attachments.length})`}
        </Button>
      )}
    </Box>
  );

  return (
    <Box ref={rootRef} component="article" aria-label={subject} sx={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
      <Box sx={{ width: "100%", px: compact ? 1.5 : 2.5, pt: 1.5, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
        <Box component="header" sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
          <AvatarWrapper height="48px" user={message?.user} fallback={message?.user} />
          <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 0.25 }}>
            <Typography component="h2" noWrap sx={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.3 }}>
              {message?.user}
            </Typography>
            {recipient && (
              <Typography variant="body2" color="text.secondary" noWrap>
                to {recipient}
              </Typography>
            )}
            <MessageDate timestamp={message?.createdAt} />
          </Box>
          <IconButton aria-label="Close message" onClick={handleClose} sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Typography component="h1" sx={{ fontSize: compact ? "1.15rem" : "1.3rem", fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word" }}>
          {subject}
        </Typography>

        {actions}

        {attachments.length > 0 && (
          <Box sx={{ width: "100%" }}>
            <AttachmentList attachments={attachments} hideDownloadAll />
          </Box>
        )}

        <Box sx={{ width: "100%", minWidth: 0, pt: 0.5 }}>
          {message?.textContentV2 && <DisplayHtml html={message?.textContentV2} />}
          {message?.htmlContent && <DisplayHtml html={cleanHTML} />}
          {message?.textContent && <ReadOnlySlate content={message.textContent} mode="mail" />}
          {!message?.textContentV2 && !message?.htmlContent && !message?.textContent && (
            <Typography variant="body2" color="text.secondary">
              This message has no text.
            </Typography>
          )}
        </Box>
      </Box>

      {earlier.length > 0 && (
        <Box component="section" aria-label={message?.user ? `Earlier messages included by ${message.user}` : "Earlier messages included by the sender"} sx={{ width: "100%", mt: 3, px: compact ? 1.5 : 2.5, pb: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            onClick={() => setShowEarlier((v) => !v)}
            aria-expanded={showEarlier}
            startIcon={showEarlier ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
            sx={{ alignSelf: "flex-start", minHeight: 44, textTransform: "none", color: theme.palette.text.secondary }}
          >
            {showEarlier
              ? "Hide earlier"
              : `Show earlier · ${earlier.length} message${earlier.length === 1 ? "" : "s"} included by ${message?.user || "the sender"}`}
          </Button>
          {showEarlier &&
            earlier.map((entry: any, index: number) => (
              <ShowMessageV2Replies
                key={entry.data?.id || entry.reference?.identifier || index}
                message={entry.data}
                quotedBy={message?.user}
                defaultExpanded={index === earlier.length - 1}
              />
            ))}
        </Box>
      )}
    </Box>
  );
};
