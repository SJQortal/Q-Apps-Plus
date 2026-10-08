/**
 * A preview of the files being attached in the composer, before they are
 * sent: images, text, PDFs, audio and video from the local file, with
 * Previous/Next (buttons and arrow keys). Nothing is fetched or published.
 * Other kinds say there is no preview. Loaded in its own chunk on first use.
 */
import { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useLayoutMode } from "../../layout/useLayoutMode";
import { useLandscapeFrame } from "../../utils/hubFrame";
import { attachmentKind, formatFileSize } from "../../utils/attachmentMeta";
import { ImageViewer } from "../../components/AttachmentPreview/ImageViewer";
import { TextViewer } from "../../components/AttachmentPreview/TextViewer";
import { PdfFromBlob } from "../../components/AttachmentPreview/AttachmentPreviewDialog";
import { AttachmentIcon } from "../../components/AttachmentPreview/AttachmentIcon";
import { OverlayBackClose } from "../../layout/OverlayBackClose";

export interface LocalAttachmentPreviewProps {
  files: File[];
  index: number;
  onClose: () => void;
}

export const localFileKind = (file: File) => attachmentKind({ originalFilename: file.name, type: file.type || null });

export function LocalAttachmentPreview({ files, index, onClose }: LocalAttachmentPreviewProps) {
  const theme = useTheme();
  const phone = useLayoutMode() === "phone";
  const landscape = useLandscapeFrame();
  const compact = phone || landscape;
  const count = files.length;
  const [current, setCurrent] = useState(() => Math.min(Math.max(0, index), Math.max(0, count - 1)));
  const file = files[Math.min(current, count - 1)];
  const kind = file ? localFileKind(file) : "other";
  const canPrev = current > 0;
  const canNext = current < count - 1;

  // One object URL for the file on screen, released when it changes or closes.
  const url = useMemo(() => (file && (kind === "image" || kind === "audio" || kind === "video") ? URL.createObjectURL(file) : ""), [file, kind]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (kind === "pdf") return; // the PDF viewer pages with the arrows
      if (event.target instanceof Element && event.target.closest("audio, video, input, textarea")) return;
      if (event.key === "ArrowRight" && canNext) setCurrent(value => value + 1);
      else if (event.key === "ArrowLeft" && canPrev) setCurrent(value => value - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [kind, canNext, canPrev]);

  if (!file) return null;
  const name = file.name;
  const subtitle = [count > 1 ? `${current + 1} of ${count}` : "", formatFileSize(file.size), "not sent yet"].filter(Boolean).join(" · ");

  let body: React.ReactNode;
  if (kind === "image") {
    body = (
      <ImageViewer
        src={url}
        alt={name}
        onSwipe={direction => {
          if (direction > 0 && canNext) setCurrent(value => value + 1);
          else if (direction < 0 && canPrev) setCurrent(value => value - 1);
        }}
      />
    );
  } else if (kind === "text") {
    body = <TextViewer blob={file} title={name} />;
  } else if (kind === "pdf") {
    body = <PdfFromBlob blob={file} title={name} />;
  } else if (kind === "audio") {
    body = (
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, p: 2 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere", textAlign: "center" }}>{name}</Typography>
        <audio controls src={url} style={{ width: "100%", maxWidth: 560 }} aria-label={name} />
      </Box>
    );
  } else if (kind === "video") {
    body = (
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: theme.palette.common.black, borderRadius: 2 }}>
        <video controls playsInline src={url} style={{ maxWidth: "100%", maxHeight: "100%", width: "100%", display: "block" }} aria-label={name} />
      </Box>
    );
  } else {
    body = (
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5, p: 2, textAlign: "center" }}>
        <AttachmentIcon kind={kind} sx={{ fontSize: 56, color: "text.secondary" }} />
        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{name}</Typography>
        <Typography color="text.secondary">No preview for this kind of file. It is sent as it is.</Typography>
      </Box>
    );
  }

  return (
    <>
    {/* Full screen on a phone: Back closes the preview, not the composer with its files. */}
    <OverlayBackClose open onClose={onClose} enabled={compact} />
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      fullScreen={compact}
      aria-labelledby="local-attachment-preview-title"
      slotProps={{ paper: { sx: compact ? undefined : { height: "calc(100% - 64px)" } } }}
    >
      <DialogTitle id="local-attachment-preview-title" sx={{ display: "flex", alignItems: "center", gap: 0.5, py: compact ? 0.75 : 1.5, pl: compact ? 2 : 3, pr: compact ? 0.5 : 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="span" noWrap sx={{ display: "block", fontWeight: 700, fontSize: compact ? "1rem" : "1.1rem" }}>
            {name}
          </Typography>
          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>
            {subtitle}
          </Typography>
        </Box>
        {count > 1 && (
          <>
            <IconButton aria-label="Previous attachment" disabled={!canPrev} onClick={() => setCurrent(value => value - 1)} sx={{ minWidth: 44, minHeight: 44 }}>
              <ChevronLeftIcon />
            </IconButton>
            <IconButton aria-label="Next attachment" disabled={!canNext} onClick={() => setCurrent(value => value + 1)} sx={{ minWidth: 44, minHeight: 44 }}>
              <ChevronRightIcon />
            </IconButton>
          </>
        )}
        {compact && (
          <IconButton aria-label="Close preview" onClick={onClose} sx={{ minWidth: 44, minHeight: 44 }}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", px: compact ? 1 : 3, pb: compact ? 1 : 2, pt: 0 }}>
        {body}
      </DialogContent>
      {!compact && (
        <DialogActions>
          <Button variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
            Close
          </Button>
        </DialogActions>
      )}
    </Dialog>
    </>
  );
}
