/**
 * One earlier message of a conversation (an entry of generalData.threadV2),
 * collapsed to avatar, sender, date and subject; a tap expands the body and
 * attachments. Your own messages sit on a primary wash, others on paper.
 */
import { useState } from "react";
import { Box, ButtonBase, Typography, useTheme } from "@mui/material";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { AvatarWrapper } from "./MailTable";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { AttachmentList } from "../../components/AttachmentPreview/AttachmentList";
import { primarySoft } from "../../hub-theme";
import { MessageDate } from "./MessageDate";

export const ShowMessageV2Replies = ({ message, defaultExpanded = false }: { message: any; defaultExpanded?: boolean }) => {
  const theme = useTheme();
  const username = useSelector((state: RootState) => state.auth?.user?.name);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isUser = Boolean(username) && username === message?.user;
  const subject = message?.subject || "(no subject)";

  return (
    <Box
      component="article"
      aria-label={`${message?.user || "Message"}: ${subject}`}
      sx={{
        width: "100%",
        minWidth: 0,
        borderRadius: `${theme.shape.borderRadius}px`,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: isUser ? primarySoft(theme) : theme.palette.background.paper,
        color: theme.palette.text.primary,
        overflow: "hidden",
      }}
    >
      <ButtonBase
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? "Collapse" : "Expand"} message from ${isUser ? "you" : message?.user || "unknown"}`}
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
        <AvatarWrapper height="36px" user={message?.user} fallback={message?.user} />
        <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: "0.95rem", minWidth: 0 }}>
              {isUser ? "You" : message?.user}
            </Typography>
            <Box sx={{ flexShrink: 0 }}>
              <MessageDate timestamp={message?.createdAt} asText />
            </Box>
          </Box>
          <Typography noWrap variant="body2" color="text.secondary">
            {subject}
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
