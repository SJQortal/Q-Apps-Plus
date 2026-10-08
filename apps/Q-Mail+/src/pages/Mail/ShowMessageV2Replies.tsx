/**
 * One earlier message of a conversation (an entry of generalData.threadV2),
 * collapsed to sender, date and subject; a tap expands the body and
 * attachments.
 *
 * - An embedded entry is part of the current sender's body, quoted by them
 *   and not verified, so it is never styled as the viewer's own ("You") or
 *   given the claimed sender's real avatar: it is marked as quoted.
 * - A `verified` entry was fetched from QDN under its publisher's name
 *   (useEarlierMessages), so it shows that name's avatar and no quote note.
 *
 * EarlierMessagePlaceholder stands in for a fetched entry until it arrives,
 * or says why it can't be shown.
 */
import { useState } from "react";
import { Avatar, Box, Button, ButtonBase, CircularProgress, Typography, useTheme } from "@mui/material";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { AttachmentList } from "../../components/AttachmentPreview/AttachmentList";
import { MessageDate } from "./MessageDate";
import { NameText, spokenName } from "../../components/common/NameText";
import { firstVisibleChar } from "../../utils/invisibleCharacters";
import { AvatarWrapper } from "./MailTable";
import type { EarlierLoad } from "./earlierMessages";

const useCardSx = () => {
  const theme = useTheme();
  return {
    width: "100%",
    minWidth: 0,
    borderRadius: `${theme.shape.borderRadius}px`,
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    overflow: "hidden",
  };
};

export const ShowMessageV2Replies = ({
  message,
  defaultExpanded = false,
  quotedBy,
  verified = false,
}: {
  message: any;
  defaultExpanded?: boolean;
  /** Who included this entry in their message (the current message's sender). */
  quotedBy?: string;
  /** Fetched from QDN under its publisher's name, not quoted. */
  verified?: boolean;
}) => {
  const theme = useTheme();
  const cardSx = useCardSx();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sender = typeof message?.user === "string" && message.user ? message.user : "Unknown";
  const subject = typeof message?.subject === "string" && message.subject ? message.subject : "(no subject)";

  return (
    <Box
      component="article"
      aria-label={`${message?.user || "Message"}: ${subject}`}
      aria-description={verified ? undefined : quotedBy ? `Quoted by ${quotedBy}, not verified` : "Quoted, not verified"}
      sx={cardSx}
    >
      <ButtonBase
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} message from ${message?.user ? spokenName(message.user) : "unknown"}`}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.5,
          py: 1,
          minHeight: 56,
          textAlign: "left",
          "&:hover": { backgroundColor: theme.palette.action.hover },
          "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
        }}
      >
        {verified ? (
          <Box aria-hidden sx={{ display: "flex", flexShrink: 0 }}>
            <AvatarWrapper height="36px" user={sender} fallback={sender} />
          </Box>
        ) : (
          <Avatar aria-hidden sx={{ width: 36, height: 36, fontSize: "1rem" }}>
            {(firstVisibleChar(sender) || "?").toUpperCase()}
          </Avatar>
        )}
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.95rem", minWidth: 0 }}>
              <NameText name={sender} />
            </Typography>
            <Box sx={{ flexShrink: 0 }}>
              <MessageDate timestamp={message?.createdAt} asText />
            </Box>
          </Box>
          <Typography noWrap variant="body2" color="text.secondary">
            {subject}
          </Typography>
          {!verified && (
            <Typography noWrap variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              {quotedBy ? (
                <>
                  Quoted by <NameText name={quotedBy} />
                </>
              ) : (
                "Quoted"
              )}
            </Typography>
          )}
        </Box>
        <ExpandMoreOutlinedIcon sx={{ transition: "transform 150ms ease", transform: isExpanded ? "rotate(180deg)" : "none", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }} />
      </ButtonBase>
      {isExpanded && (
        <Box sx={{ px: 1.5, pb: 1.5, display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
          {Array.isArray(message?.attachments) && message.attachments.length > 0 && <AttachmentList attachments={message.attachments} compact />}
          {message?.textContentV2 ? (
            <DisplayHtml html={message?.textContentV2} />
          ) : (
            <Typography variant="body2" color="text.secondary">
              This message has no text.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

const PLACEHOLDER_TEXT: Record<Exclude<EarlierLoad["status"], "loaded">, string> = {
  loading: "Loading message",
  deleted: "The sender deleted this message.",
  unableToDecrypt: "This message was not sent to you, so it can't be opened.",
  unavailable: "Not available on your node right now.",
  failed: "This message could not be loaded.",
};

/** A fetched earlier message that isn't on screen: loading, or why not. */
export const EarlierMessagePlaceholder = ({
  name,
  status,
  onRetry,
}: {
  /** The publisher the reference names. */
  name: string;
  status: Exclude<EarlierLoad["status"], "loaded">;
  onRetry?: () => void;
}) => {
  const cardSx = useCardSx();
  const canRetry = Boolean(onRetry) && (status === "unavailable" || status === "failed");
  return (
    <Box
      component="article"
      aria-label={`Earlier message from ${spokenName(name)}`}
      aria-busy={status === "loading" || undefined}
      sx={{ ...cardSx, display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1, minHeight: 56, flexWrap: "wrap" }}
    >
      <Box aria-hidden sx={{ display: "flex", flexShrink: 0 }}>
        <AvatarWrapper height="36px" user={name} fallback={name} />
      </Box>
      <Box role="status" sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.95rem", minWidth: 0 }}>
          <NameText name={name} />
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {status === "loading" && <CircularProgress size={14} aria-hidden />}
          {PLACEHOLDER_TEXT[status]}
        </Typography>
      </Box>
      {canRetry && (
        <Button variant="outlined" onClick={onRetry} sx={{ minHeight: 44, textTransform: "none", flexShrink: 0 }}>
          Retry
        </Button>
      )}
    </Box>
  );
};

/** In place of an earlier message that cannot be drawn (ErrorBoundary fallback). */
export const EarlierMessageUnreadable = () => {
  const cardSx = useCardSx();
  return (
    <Box role="status" sx={{ ...cardSx, px: 1.5, py: 1.5, minHeight: 56, display: "flex", alignItems: "center" }}>
      <Typography variant="body2" color="text.secondary">
        This earlier message could not be shown.
      </Typography>
    </Box>
  );
};
