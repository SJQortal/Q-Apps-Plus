import { useEffect, useState, type MouseEvent } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { fetchQdnText } from "../../utils/qdnSearch";
import { readSettings, useAppSettings, type AppSettings } from "../../utils/settings";
import { fileKind } from "../../utils/fileKind";

export const IMAGE_AUTO_PREVIEW_BYTES = 5 * 1024 * 1024;
export const TEXT_PREVIEW_BYTES = 200 * 1024;

export interface PreviewFile {
  name: string;
  service?: string;
  identifier: string;
  mimetype?: string;
  size?: number;
  filename?: string;
}

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text";

const KIND_LABEL: Record<PreviewKind, string> = {
  image: "image",
  video: "video",
  audio: "audio",
  pdf: "PDF",
  text: "text",
};

export function previewUrl(file: PreviewFile): string {
  return `/arbitrary/${file.service || "FILE"}/${encodeURIComponent(file.name)}/${encodeURIComponent(file.identifier)}`;
}

/** Which inline preview an attachment gets, or null when none applies. */
export function previewKind(file: PreviewFile): PreviewKind | null {
  const kind = fileKind(file.mimetype, file.filename);
  if (kind === "text") return (file.size ?? 0) <= TEXT_PREVIEW_BYTES ? "text" : null;
  if (kind === "image" || kind === "video" || kind === "audio" || kind === "pdf") return kind;
  return null;
}

/** Images open without a click only when the setting is on and they are small. */
export function shouldAutoPreview(file: PreviewFile, settings: AppSettings = readSettings()): boolean {
  return previewKind(file) === "image" && settings.autoPreviewImages && (file.size ?? 0) <= IMAGE_AUTO_PREVIEW_BYTES;
}

interface PreviewToggleButtonProps {
  kind: PreviewKind;
  open: boolean;
  onToggle: () => void;
  filename?: string;
}

export function PreviewToggleButton({ kind, open, onToggle, filename }: PreviewToggleButtonProps) {
  const phone = usePhoneLayout();
  return (
    <Button
      variant="outlined"
      startIcon={open ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-expanded={open}
      aria-label={open ? `Hide preview of ${filename || "file"}` : `Preview ${KIND_LABEL[kind]} ${filename || ""}`.trim()}
      sx={{ minHeight: phone ? 48 : 40, width: phone ? "100%" : "auto", flexShrink: 0 }}
    >
      {open ? "Hide preview" : `Preview ${KIND_LABEL[kind]}`}
    </Button>
  );
}

const Failed = ({ children }: { children: string }) => (
  <Typography variant="body2" color="text.secondary" role="status">
    {children}
  </Typography>
);

function ImagePreview({ file }: { file: PreviewFile }) {
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const src = previewUrl(file);
  const alt = file.filename || "";
  if (failed) return <Failed>Preview failed</Failed>;
  return (
    <>
      <Box
        component="button"
        type="button"
        onClick={() => setLightbox(true)}
        aria-label={`Open ${alt || "image"} full screen`}
        sx={{
          appearance: "none",
          border: 0,
          padding: 0,
          background: "transparent",
          cursor: "zoom-in",
          display: "block",
          width: "100%",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ display: "block", width: "100%", height: "auto", maxHeight: 480, objectFit: "contain" }}
        />
      </Box>
      <ResponsiveDialog open={lightbox} onClose={() => setLightbox(false)} title={alt || "Image"} maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          <img
            src={src}
            alt={alt}
            style={{ display: "block", maxWidth: "100%", maxHeight: "calc(100vh - 140px)", objectFit: "contain" }}
          />
        </Box>
      </ResponsiveDialog>
    </>
  );
}

function TextPreview({ file }: { file: PreviewFile }) {
  const [state, setState] = useState<{ text?: string; error?: boolean }>({});
  useEffect(() => {
    let active = true;
    fetchQdnText(file.service || "FILE", file.name, file.identifier)
      .then((text) => active && setState({ text }))
      .catch(() => active && setState({ error: true }));
    return () => {
      active = false;
    };
  }, [file.service, file.name, file.identifier]);

  if (state.error) return <Failed>Could not load the text. Download the file instead.</Failed>;
  if (state.text === undefined) return <Failed>Loading text…</Failed>;
  return (
    <Box
      component="pre"
      sx={{
        margin: 0,
        padding: 1.5,
        maxHeight: 400,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 14,
        lineHeight: 1.5,
        color: "text.primary",
        bgcolor: "action.hover",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      {state.text}
    </Box>
  );
}

interface PreviewPanelProps {
  file: PreviewFile;
  kind: PreviewKind;
  open: boolean;
}

/**
 * The preview itself, rendered only while `open`. Nothing here touches the
 * node until it is open: video and audio use `preload="none"`, the PDF frame
 * and text fetch mount on open, and images load lazily.
 */
export function PreviewPanel({ file, kind, open }: PreviewPanelProps) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  if (!open) return null;
  if (failed) return <Failed>Preview failed</Failed>;
  const src = previewUrl(file);
  const stop = (e: MouseEvent) => e.stopPropagation();

  switch (kind) {
    case "image":
      return <ImagePreview key={file.identifier} file={file} />;
    case "video":
      return (
        <Box sx={{ width: "100%" }} onClick={stop}>
          <video
            controls
            playsInline
            preload="none"
            src={src}
            aria-label={file.filename || "Video preview"}
            onError={() => setFailed(true)}
            style={{
              display: "block",
              width: "100%",
              maxHeight: "70vh",
              borderRadius: Number(theme.shape.borderRadius) || 8,
              backgroundColor: theme.palette.common.black,
            }}
          />
        </Box>
      );
    case "audio":
      return (
        <Box sx={{ width: "100%" }} onClick={stop}>
          <audio
            controls
            preload="none"
            src={src}
            aria-label={file.filename || "Audio preview"}
            onError={() => setFailed(true)}
            style={{ display: "block", width: "100%" }}
          />
        </Box>
      );
    case "pdf":
      return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1 }} onClick={stop}>
          <Box
            component="iframe"
            title={`Preview of ${file.filename || "PDF"}`}
            src={src}
            sx={{ width: "100%", height: "70vh", border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper" }}
          />
          <Typography variant="body2" color="text.secondary">
            If the preview stays blank, download the file.
          </Typography>
        </Box>
      );
    case "text":
      return <TextPreview key={file.identifier} file={file} />;
    default:
      return null;
  }
}

interface FilePreviewProps {
  file: PreviewFile;
}

/**
 * Self-contained preview for one attachment: a "Preview …" toggle and, once
 * open, the media fitted to the width. Small images open at once when the
 * "auto preview images" setting is on; everything else waits for a tap.
 */
export const FilePreview = ({ file }: FilePreviewProps) => {
  const settings = useAppSettings();
  const kind = previewKind(file);
  const [open, setOpen] = useState(() => shouldAutoPreview(file, settings));
  if (!kind) return null;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
      <Box>
        <PreviewToggleButton kind={kind} open={open} onToggle={() => setOpen((o) => !o)} filename={file.filename} />
      </Box>
      <PreviewPanel file={file} kind={kind} open={open} />
    </Box>
  );
};
