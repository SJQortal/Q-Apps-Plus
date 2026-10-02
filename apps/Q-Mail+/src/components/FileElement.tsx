/**
 * Legacy attachment row: the children are the label, a tap fetches the file
 * (through the attachment cache) and a second tap saves it with SAVE_FILE.
 * Kept for the older readers; the mail readers use AttachmentCard.
 */
import * as React from "react";
import { Box, ButtonBase, Button, CircularProgress, Typography } from "@mui/material";
import { useDispatch } from "react-redux";
import { setNotification } from "../state/features/notificationsSlice";
import { FetchingFromPeers } from "../layout/states";
import { useAttachment } from "./AttachmentPreview/useAttachment";
import type { AttachmentRef } from "../utils/attachmentMeta";
import { errorMessage } from "../utils/hubErrors";

interface IFileElement {
  title: string;
  description?: string;
  author?: string;
  fileInfo?: any;
  postId?: string;
  user?: string;
  children?: React.ReactNode;
  mimeTypeSaved?: string;
  mimeType?: string;
  disable?: boolean;
  mode?: string;
  otherUser?: string;
  customStyles?: any;
  loadStyles?: any;
}

export default function FileElement({
  fileInfo,
  children,
  mimeTypeSaved,
  disable,
  customStyles,
  loadStyles = {},
}: IFileElement) {
  const dispatch = useDispatch();
  const [saving, setSaving] = React.useState(false);
  const ref = React.useMemo<AttachmentRef | null>(() => {
    if (!fileInfo?.identifier || !fileInfo?.name || !fileInfo?.service) return null;
    return { ...fileInfo, type: fileInfo.type ?? mimeTypeSaved ?? fileInfo.mimeTypeSaved ?? null };
  }, [fileInfo, mimeTypeSaved]);
  const attachment = useAttachment(ref);

  const handleClick = async () => {
    if (disable || !ref) return;
    if (attachment.phase === "ready") {
      if (saving) return;
      setSaving(true);
      try {
        // A declined Hub prompt resolves false and stays quiet (pitfall 11).
        await attachment.save();
      } catch (error: unknown) {
        dispatch(setNotification({ msg: errorMessage(error, "The file could not be saved."), alertType: "error" }));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (attachment.phase === "error") {
      attachment.retry();
      return;
    }
    attachment.start();
  };

  const stalled = attachment.status === "MISSING_DATA" || attachment.status === "FAILED";

  return (
    <Box sx={[{ width: "100%", overflow: "hidden", position: "relative" }, customStyles || {}]}>
      <ButtonBase
        onClick={handleClick}
        disabled={disable}
        aria-label={attachment.phase === "ready" ? "Save file" : "Fetch file"}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          minHeight: 44,
          borderRadius: 1,
          px: 0.5,
          textAlign: "left",
          maxWidth: "100%",
        }}
      >
        {children}
        {attachment.phase === "ready" && (
          <>
            <Typography sx={{ fontSize: "0.875rem" }} style={{ ...loadStyles }} color="text.secondary">
              {saving ? "Saving…" : "Tap to save"}
            </Typography>
            {saving && <CircularProgress color="secondary" size={14} />}
          </>
        )}
      </ButtonBase>
      {(attachment.phase === "fetching" || attachment.phase === "decrypting") && !stalled && (
        <FetchingFromPeers
          compact
          status={attachment.phase === "decrypting" ? "BUILDING" : attachment.status}
          percentLoaded={attachment.percent}
        />
      )}
      {attachment.phase === "fetching" && stalled && (
        <FetchingFromPeers compact status={attachment.status} onRetry={attachment.retry} />
      )}
      {attachment.phase === "error" && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", px: 0.5 }}>
          <Typography variant="body2" color="error.main">
            {attachment.error || "This file could not be opened."}
          </Typography>
          <Button size="small" variant="outlined" onClick={attachment.retry} sx={{ minHeight: 36 }}>
            Retry
          </Button>
        </Box>
      )}
    </Box>
  );
}
