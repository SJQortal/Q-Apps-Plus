import { useState } from "react";
import { Box, Button } from "@mui/material";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";

const IMAGE_AUTO_PREVIEW_BYTES = 5 * 1024 * 1024;

interface FilePreviewProps {
  file: { name: string; service: string; identifier: string; mimetype?: string; size?: number; filename?: string };
}

function resourceUrl(file: FilePreviewProps["file"]): string {
  return `/arbitrary/${file.service}/${encodeURIComponent(file.name)}/${encodeURIComponent(file.identifier)}`;
}

/**
 * Inline preview for images, audio and video attachments. Reading the URL
 * makes the node fetch the file, so images above 5 MB and all audio/video
 * wait for a click (preload="none") instead of downloading on page open.
 */
export const FilePreview = ({ file }: FilePreviewProps) => {
  const mime = (file.mimetype || "").toLowerCase();
  const [show, setShow] = useState(mime.startsWith("image/") && (file.size ?? 0) <= IMAGE_AUTO_PREVIEW_BYTES);
  const [failed, setFailed] = useState(false);

  if (failed) return null;
  if (mime.startsWith("image/")) {
    if (!show) {
      return (
        <Button size="small" startIcon={<ImageOutlinedIcon />} onClick={(e) => { e.stopPropagation(); setShow(true); }}>
          Preview image
        </Button>
      );
    }
    return (
      <Box sx={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <img
          src={resourceUrl(file)}
          alt={file.filename || ""}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ maxWidth: "100%", maxHeight: 480, borderRadius: 8, display: "block" }}
        />
      </Box>
    );
  }
  if (mime.startsWith("audio/")) {
    return (
      <Box sx={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <audio controls preload="none" src={resourceUrl(file)} style={{ width: "100%" }} onError={() => setFailed(true)} />
      </Box>
    );
  }
  if (mime.startsWith("video/")) {
    return (
      <Box sx={{ width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <video
          controls
          preload="none"
          src={resourceUrl(file)}
          style={{ width: "100%", maxHeight: 480, borderRadius: 8, background: "black" }}
          onError={() => setFailed(true)}
        />
      </Box>
    );
  }
  return null;
};
