import { useEffect, useState, type MouseEvent } from "react";
import { Box, Button, CircularProgress, Typography, useTheme } from "@mui/material";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { ResponsiveDialog } from "./mobile/ResponsiveDialog";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { useFileOnNode } from "../../hooks/useFileOnNode";
import { fetchQdnText } from "../../utils/qdnSearch";
import { readSettings, useAppSettings, type AppSettings } from "../../utils/settings";
import { fileKind } from "../../utils/fileKind";

export const IMAGE_AUTO_PREVIEW_BYTES = 5 * 1024 * 1024;
export const TEXT_PREVIEW_BYTES = 200 * 1024;
/** Hub's reader gets the whole file in memory, so bigger PDFs are downloaded instead. */
export const PDF_OPEN_MAX_BYTES = 100 * 1024 * 1024;

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

const PDF_TOO_LARGE = "Too large to open here. Download to view.";
const PDF_FAILED = "Couldn't open the PDF. Download to view.";

/** The PDF spec allows the `%PDF-` header anywhere in the first 1 KB. */
function hasPdfHeader(bytes: Uint8Array): boolean {
  return String.fromCharCode(...bytes).includes("%PDF-");
}

/**
 * Reads a PDF from the node and hands it to Hub's own reader (SHOW_PDF_READER,
 * which needs a Blob typed application/pdf). The stored type comes from the
 * publisher, so the bytes must really start like a PDF. Resolves to null when
 * the reader opened, else to the message to show.
 */
export async function openPdfInHub(file: PreviewFile): Promise<string | null> {
  try {
    const response = await fetch(previewUrl(file));
    if (!response.ok) return PDF_FAILED;
    if (Number(response.headers.get("content-length")) > PDF_OPEN_MAX_BYTES) {
      response.body?.cancel().catch(() => {});
      return PDF_TOO_LARGE;
    }
    const data = await response.blob();
    if (data.size > PDF_OPEN_MAX_BYTES) return PDF_TOO_LARGE;
    if (!hasPdfHeader(new Uint8Array(await data.slice(0, 1024).arrayBuffer()))) {
      return "This file isn't a PDF. Download to view.";
    }
    // slice() re-types the blob without copying the bytes.
    await qortalRequest({ action: "SHOW_PDF_READER", blob: data.slice(0, data.size, "application/pdf") });
    return null;
  } catch {
    return PDF_FAILED;
  }
}

interface OpenPdfButtonProps {
  file: PreviewFile;
  /** The share the file belongs to, for the downloads panel. */
  jsonId?: string;
}

/**
 * "Open PDF": PDFs open in Hub's own reader. An inline frame stays blank in
 * Hub (the sandboxed app frame and Electron without plugins have no PDF
 * viewer) and GO's WebView turns it into a download. A file that isn't on the
 * node yet is fetched first (the row shows the progress) and opens when ready.
 */
export function OpenPdfButton({ file, jsonId }: OpenPdfButtonProps) {
  const phone = usePhoneLayout();
  const node = useFileOnNode(file, jsonId);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tooLarge = (file.size ?? 0) > PDF_OPEN_MAX_BYTES;

  // Opens once the file is on the node: at once when it already was, or
  // when the fetch started by the tap finishes.
  const { state } = node;
  useEffect(() => {
    if (!pending || state !== "ready") return;
    let active = true;
    void openPdfInHub(file).then((problem) => {
      if (!active) return;
      setPending(false);
      setMessage(problem);
    });
    return () => {
      active = false;
    };
  }, [file, pending, state]);

  const width = phone ? "100%" : "auto";
  if (tooLarge) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ width, alignSelf: "center" }}>
        {PDF_TOO_LARGE}
      </Typography>
    );
  }

  const failed = pending && state === "failed";
  const busy = pending && !failed;
  const open = (e: MouseEvent) => {
    e.stopPropagation();
    setMessage(null);
    setPending(true);
    void node.ensure();
  };
  const note = failed ? node.statusText : message;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, width, flexShrink: 0 }}>
      <Button
        variant="outlined"
        startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfOutlinedIcon />}
        onClick={open}
        disabled={busy}
        aria-label={`Open PDF ${file.filename || ""}`.trim()}
        sx={{ minHeight: phone ? 48 : 40, width }}
      >
        {!busy ? "Open PDF" : state === "fetching" ? "Opens when ready" : "Opening…"}
      </Button>
      {note && <Failed>{note}</Failed>}
    </Box>
  );
}

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
          style={{ display: "block", maxWidth: "100%", height: "auto", maxHeight: 480, margin: "0 auto", objectFit: "contain" }}
        />
      </Box>
      <ResponsiveDialog open={lightbox} onClose={() => setLightbox(false)} title={alt || "Image"} maxWidth="lg">
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
          <img
            src={src}
            alt={alt}
            style={{ display: "block", maxWidth: "100%", maxHeight: "calc(var(--qshare-app-height, 100dvh) - 140px)", objectFit: "contain" }}
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
 * node until it is open: video and audio use `preload="none"`, the text fetch
 * mounts on open, and images load lazily. PDFs have no inline preview: they
 * open in Hub's reader through `OpenPdfButton`.
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
              maxHeight: "calc(var(--qshare-app-height, 100dvh) * 0.7)",
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
 * PDFs get "Open PDF" (Hub's reader) instead.
 */
export const FilePreview = ({ file }: FilePreviewProps) => {
  const settings = useAppSettings();
  const kind = previewKind(file);
  const [open, setOpen] = useState(() => shouldAutoPreview(file, settings));
  if (!kind) return null;
  if (kind === "pdf") return <OpenPdfButton file={file} />;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
      <Box>
        <PreviewToggleButton kind={kind} open={open} onToggle={() => setOpen((o) => !o)} filename={file.filename} />
      </Box>
      <PreviewPanel file={file} kind={kind} open={open} />
    </Box>
  );
};
