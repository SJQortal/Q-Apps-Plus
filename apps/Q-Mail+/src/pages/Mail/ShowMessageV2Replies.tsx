/**
 * One earlier message of a conversation (an entry of generalData.threadV2),
 * collapsed to sender, date and subject; a tap expands the body and
 * attachments. These entries are part of the current sender's body, quoted
 * by them and not verified, so none is styled as the viewer's own ("You")
 * or given the claimed sender's real avatar: each is marked as quoted.
 */
import { useState } from "react";
import { Avatar, Box, ButtonBase, Typography, useTheme } from "@mui/material";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { AttachmentList } from "../../components/AttachmentPreview/AttachmentList";
import { MessageDate } from "./MessageDate";
import { NameText } from "../../components/common/NameText";
import { firstVisibleChar } from "../../utils/invisibleCharacters";

export const ShowMessageV2Replies = ({
  message,
  defaultExpanded = false,
  quotedBy,
}: {
  message: any;
  defaultExpanded?: boolean;
  /** Who included this entry in their message (the current message's sender). */
  quotedBy?: string;
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const sender = typeof message?.user === "string" && message.user ? message.user : "Unknown";
  const subject = message?.subject || "(no subject)";

  return (
    <Box
      component="article"
      aria-label={`${message?.user || "Message"}: ${subject}`}
      aria-description={quotedBy ? `Quoted by ${quotedBy}, not verified` : "Quoted, not verified"}
      sx={{
        width: "100%",
        minWidth: 0,
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.primary,
        overflow: "hidden",
      }}
    >
      <ButtonBase
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} message from ${message?.user || "unknown"}`}
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
        <Avatar aria-hidden sx={{ width: 36, height: 36, fontSize: "1rem" }}>
          {(firstVisibleChar(sender) || "?").toUpperCase()}
        </Avatar>
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
          <Typography noWrap variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
            {quotedBy ? (
              <>
                Quoted by <NameText name={quotedBy} />
              </>
            ) : (
              "Quoted"
            )}
          </Typography>
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
