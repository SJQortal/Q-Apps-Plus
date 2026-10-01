import { Box, Button, Paper, Typography } from "@mui/material";
import DOMPurify from "dompurify";
import ReplyOutlinedIcon from "@mui/icons-material/ReplyOutlined";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ReadOnlySlate from "../../components/editor/ReadOnlySlate";
import FileElement from "../../components/FileElement";
import { DisplayHtml } from "../../components/common/TextEditor/DisplayHtml";
import { formatEmailDate, formatFullTimestamp } from "../../utils/time";
import { ThreadAvatar } from "./ThreadAvatar";

interface ShowMessageProps {
  message: any;
  /** Quote this post in a new reply. */
  onReply?: (message: any) => void;
}

/** One post in a group thread: who, when, the body and its attachments. */
export const ShowMessage = ({ message, onReply }: ShowMessageProps) => {
  const name = typeof message?.name === "string" ? message.name : "";
  const postedAt = Number(message?.created || message?.createdAt) || 0;
  const cleanHTML = typeof message?.htmlContent === "string" && message.htmlContent ? DOMPurify.sanitize(message.htmlContent) : "";
  const attachments: any[] = Array.isArray(message?.attachments) ? message.attachments : [];

  return (
    <Paper
      component="article"
      variant="outlined"
      aria-label={name ? `Post by ${name}` : "Post"}
      sx={(theme) => ({
        width: "100%",
        p: { xs: 1.5, sm: 2 },
        borderRadius: 3,
        backgroundColor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        overflowWrap: "anywhere",
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        <ThreadAvatar name={name} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 700, fontSize: "1rem" }}>
            {name || "Unknown"}
          </Typography>
          <Typography variant="body2" color="text.secondary" title={formatFullTimestamp(postedAt)}>
            {postedAt ? formatEmailDate(postedAt) : "-"}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          fontSize: "0.9375rem",
          lineHeight: 1.5,
          "& img, & video": { maxWidth: "100%", height: "auto" },
          "& pre": { overflowX: "auto" },
        }}
      >
        {message?.textContent && <ReadOnlySlate content={message.textContent} mode="mail" />}
        {typeof message?.textContentV2 === "string" && message.textContentV2 && <DisplayHtml html={message.textContentV2} />}
        {cleanHTML && <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />}
      </Box>

      {attachments.length > 0 && (
        <Box component="ul" aria-label="Attachments" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {attachments.map((file: any, index: number) => (
            <Box
              component="li"
              key={file?.identifier || `${file?.filename || "attachment"}-${index}`}
              sx={(theme) => ({
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                borderRadius: 2,
                px: 1,
                backgroundColor: theme.qplus.primarySoft,
                "& > *": { display: "flex", alignItems: "center", gap: 1, minWidth: 0, cursor: "pointer" },
              })}
            >
              <FileElement
                fileInfo={{ ...file, mimeTypeSaved: file?.type }}
                title={file?.filename}
                mode="mail"
                otherUser={message?.user}
              >
                <AttachFileIcon fontSize="small" sx={{ color: "primary.main", flexShrink: 0 }} />
                <Typography noWrap sx={{ fontSize: "0.9375rem", color: "primary.main" }}>
                  {file?.originalFilename || file?.filename || "Attachment"}
                </Typography>
              </FileElement>
            </Box>
          ))}
        </Box>
      )}

      {onReply && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            size="small"
            startIcon={<ReplyOutlinedIcon />}
            onClick={() => onReply(message)}
            aria-label={name ? `Reply to ${name}` : "Reply"}
            sx={{ minHeight: 44, textTransform: "none" }}
          >
            Reply
          </Button>
        </Box>
      )}
    </Paper>
  );
};
