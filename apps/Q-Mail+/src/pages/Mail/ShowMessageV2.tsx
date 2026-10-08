/**
 * The message reader: header (avatar, sender, recipient, date), subject,
 * action row (Reply, Reply all, Forward, Save all, and Archive / Move to
 * inbox and Mark unread when the caller offers them), attachments, body, and
 * the earlier messages of the conversation collapsed with a count.
 *
 * Layout follows the pane's own width (ResizeObserver), not a viewport
 * query, so a 700 px Hub pane and a phone both get the compact form.
 *
 * Earlier messages come from generalData.threadV2 through
 * useEarlierMessages: embedded copies show at once, reference-only entries
 * (Q-Mail+ 1.0.1 replies) are fetched from QDN when "Show earlier" opens,
 * the newest EARLIER_PAGE_SIZE first, with "Show older" for the rest.
 *
 * The header names the recipient ("to …") and, for mail written with Cc
 * names (Q-Mail+'s additive `cc`), a "cc …" line.
 *
 * Props stay compatible with Mail.tsx (message, setReplyTo, setForwardInfo,
 * alias, onClose, setIsOpen); onReplyAll, onForward, onArchive and
 * onMarkUnread are optional extras. Archive and Mark unread are labelled
 * buttons in a wide pane and 44 px icon buttons with aria-labels in a
 * compact one (phones); they carry aria-keyshortcuts for the e / u keys.
 */
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Box, Button, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import ReplyAllOutlinedIcon from "@mui/icons-material/ReplyAllOutlined";
import ForwardOutlinedIcon from "@mui/icons-material/ForwardOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import ExpandLessOutlinedIcon from "@mui/icons-material/ExpandLessOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import UnarchiveOutlinedIcon from "@mui/icons-material/UnarchiveOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import DOMPurify from "dompurify";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { setNotification } from "../../state/features/notificationsSlice";
import ReadOnlySlate from "../../components/editor/ReadOnlySlate";
import { AvatarWrapper } from "./MailTable";
import { NameText } from "../../components/common/NameText";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { EarlierMessagePlaceholder, EarlierMessageUnreadable, ShowMessageV2Replies } from "./ShowMessageV2Replies";
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { useEarlierMessages } from "./useEarlierMessages";
import { EARLIER_PAGE_SIZE } from "./earlierMessages";
import { updateMessageDetails } from "../../utils/helpers";
import { AttachmentList, usableAttachments } from "../../components/AttachmentPreview/AttachmentList";
import { useDownloadAll } from "../../components/AttachmentPreview/useDownloadAll";
import { MessageDate } from "./MessageDate";

/** "Show 2 older messages", or "Show 5 older messages (7 left)" when more are hidden than a page. */
export function olderLabel(hidden: number): string {
  const next = Math.min(EARLIER_PAGE_SIZE, hidden);
  const label = `Show ${next} older message${next === 1 ? "" : "s"}`;
  return hidden > next ? `${label} (${hidden} left)` : label;
}

/** A Cc list longer than this (by more than one) shows these names and "and N more". */
export const CC_NAMES_SHOWN = 3;

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
  /** Optional: shows Archive (or Move to inbox when `archived`); the caller closes the reader. */
  onArchive?: (message: any) => void;
  /** The message is in Archived: the archive action reads "Move to inbox". */
  archived?: boolean;
  /** Optional: shows Mark unread; the caller closes the reader. */
  onMarkUnread?: (message: any) => void;
}

export const ShowMessageV2 = ({
  setIsOpen,
  message,
  setReplyTo,
  alias,
  setForwardInfo,
  onClose,
  onReplyAll,
  onForward,
  onArchive,
  archived = false,
  onMarkUnread,
}: ShowMessageV2Props) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const compact = width > 0 && width < READER_COMPACT_WIDTH;
  // "Show earlier" belongs to the message it was opened on. The reader is
  // reused for the next message, so the section is closed for it in that same
  // render, before the loader could start on its history.
  const messageKey = `${message?.user || ""}|${message?.id || ""}`;
  const [earlierOpenFor, setEarlierOpenFor] = useState<string | null>(null);
  const showEarlier = earlierOpenFor === messageKey;

  const attachments = useMemo(() => usableAttachments(message?.attachments), [message?.attachments]);
  const downloadAll = useDownloadAll(attachments);

  const earlier = useEarlierMessages(message, showEarlier);

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

  // The To of the send. Every copy of a Q-Mail+ send carries it in `to`
  // (§17), while `recipient` names the copy's own target, a Cc or Bcc name
  // on those copies; mail from the original app has only `recipient`.
  // Strings only: a decrypted body can hold anything, and an object here
  // would break the whole reader.
  const recipient: string | undefined =
    Array.isArray(message?.to) && typeof message.to[0] === "string" && message.to[0].trim()
      ? message.to[0]
      : typeof message?.recipient === "string" && message.recipient.trim()
        ? message.recipient
        : typeof message?.to === "string" && message.to.trim()
          ? message.to
          : undefined;
  // Cc names Q-Mail+ writes into every copy (data contract §17); Bcc never.
  const ccNames: string[] = Array.isArray(message?.cc)
    ? Array.from(new Set(message.cc.filter((name: unknown): name is string => typeof name === "string" && name.trim().length > 0)))
    : [];
  // A long Cc list shows its first names and "and N more", which shows the
  // rest. The line wraps, so every name is readable on a phone (no hover).
  const [ccOpenFor, setCcOpenFor] = useState<string | null>(null);
  const ccShown = ccOpenFor === messageKey || ccNames.length <= CC_NAMES_SHOWN + 1 ? ccNames : ccNames.slice(0, CC_NAMES_SHOWN);
  const ccMore = ccNames.length - ccShown.length;
  const subject = typeof message?.subject === "string" && message.subject ? message.subject : "(no subject)";
  const cleanHTML = message?.htmlContent ? DOMPurify.sanitize(message.htmlContent) : "";

  const actionSx = { minHeight: 44, textTransform: "none" as const, flexShrink: 0 };
  const iconActionSx = { minWidth: 44, minHeight: 44, flexShrink: 0 };
  const archiveLabel = archived ? "Move to inbox" : "Archive";
  const archiveIcon = archived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />;
  // Wide pane: labelled buttons. Compact (phones): icon buttons with a label
  // for screen readers and a tooltip on long-press.
  const sideAction = (label: string, icon: React.ReactNode, onClick: () => void, shortcut: string) =>
    compact ? (
      <Tooltip key={label} title={label} enterTouchDelay={500}>
        <IconButton aria-label={label} aria-keyshortcuts={shortcut} onClick={onClick} sx={iconActionSx}>
          {icon}
        </IconButton>
      </Tooltip>
    ) : (
      <Button key={label} variant="outlined" startIcon={icon} aria-keyshortcuts={shortcut} onClick={onClick} sx={actionSx}>
        {label}
      </Button>
    );
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
      {onArchive && sideAction(archiveLabel, archiveIcon, () => onArchive(message), "e")}
      {onMarkUnread && sideAction("Mark unread", <MarkEmailUnreadOutlinedIcon />, () => onMarkUnread(message), "u")}
    </Box>
  );

  return (
    <Box ref={rootRef} component="article" aria-label={subject} sx={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
      <Box sx={{ width: "100%", px: compact ? 1.5 : 2.5, pt: 1.5, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
        <Box component="header" sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
          <AvatarWrapper height="48px" user={message?.user} fallback={message?.user} />
          <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, gap: 0.25 }}>
            <Typography component="p" noWrap sx={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.3 }}>
              <NameText name={message?.user} />
            </Typography>
            {recipient && (
              <Typography variant="body2" color="text.secondary" noWrap>
                to <NameText name={recipient} />
              </Typography>
            )}
            {ccNames.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                cc{" "}
                {ccShown.map((name, index) => (
                  <React.Fragment key={name}>
                    {index > 0 && ", "}
                    <NameText name={name} />
                  </React.Fragment>
                ))}
                {ccMore > 0 && (
                  <>
                    {" "}
                    <Box
                      component="button"
                      type="button"
                      onClick={() => setCcOpenFor(messageKey)}
                      aria-label={`Show all ${ccNames.length} Cc names`}
                      sx={{
                        background: "none",
                        border: 0,
                        p: 0,
                        // A 44 px target that keeps the line's height.
                        minHeight: 44,
                        my: "-12px",
                        display: "inline-flex",
                        alignItems: "center",
                        verticalAlign: "baseline",
                        font: "inherit",
                        color: "primary.main",
                        cursor: "pointer",
                        textDecoration: "underline",
                        "&:focus-visible": { outline: (theme) => `2px solid ${theme.palette.primary.main}`, borderRadius: 1 },
                      }}
                    >
                      and {ccMore} more
                    </Box>
                  </>
                )}
              </Typography>
            )}
            <MessageDate timestamp={message?.createdAt} />
          </Box>
          <IconButton aria-label="Close message" onClick={handleClose} sx={{ minWidth: 44, minHeight: 44, flexShrink: 0 }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* h2: the view's one h1 is the PaneHeader's (the list's, or the phone reader's). */}
        <Typography component="h2" sx={{ fontSize: compact ? "1.15rem" : "1.3rem", fontWeight: 600, lineHeight: 1.3, wordBreak: "break-word" }}>
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

      {earlier.total > 0 && (
        <Box component="section" aria-label="Earlier messages in this conversation" sx={{ width: "100%", mt: 3, px: compact ? 1.5 : 2.5, pb: 2, display: "flex", flexDirection: "column", gap: 1 }}>
          <Button
            onClick={() => setEarlierOpenFor(showEarlier ? null : messageKey)}
            aria-expanded={showEarlier}
            startIcon={showEarlier ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
            sx={{ alignSelf: "flex-start", minHeight: 44, textTransform: "none", color: theme.palette.text.secondary }}
          >
            {showEarlier ? "Hide earlier" : `Show earlier · ${earlier.total} message${earlier.total === 1 ? "" : "s"}`}
          </Button>
          {showEarlier && earlier.hidden > 0 && (
            <Button
              onClick={earlier.showOlder}
              sx={{ alignSelf: "flex-start", minHeight: 44, textTransform: "none" }}
            >
              {olderLabel(earlier.hidden)}
            </Button>
          )}
          {showEarlier &&
            earlier.items.map(({ entry, load }, index) => {
              const newest = index === earlier.items.length - 1;
              const card = !load ? (
                <ShowMessageV2Replies message={entry.data} quotedBy={entry.quotedBy || message?.user} defaultExpanded={newest} />
              ) : load.status === "loaded" ? (
                <ShowMessageV2Replies message={load.message} verified defaultExpanded={newest} />
              ) : (
                <EarlierMessagePlaceholder
                  name={entry.reference?.name || "Unknown"}
                  status={load.status}
                  onRetry={() => earlier.retry(entry.key)}
                />
              );
              // One earlier message that cannot be drawn says so in its place.
              return (
                <ErrorBoundary key={entry.key} fallback={<EarlierMessageUnreadable />}>
                  {card}
                </ErrorBoundary>
              );
            })}
        </Box>
      )}
    </Box>
  );
};
