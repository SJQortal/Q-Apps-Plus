import { useState } from "react";
import { Box, Typography } from "@mui/material";
import FileElement, { type FileInfo } from "../../components/common/FileElement";
import { OpenPdfButton, PreviewPanel, PreviewToggleButton, previewKind, shouldAutoPreview } from "../../components/common/FilePreview";
import { formatBytes } from "../../utils/formatBytes";
import { useAppSettings } from "../../utils/settings";
import { fileKind, fileKindIconElement, fileKindLabel } from "../../utils/fileKind";

/** One entry of a share's `files` array (docs/apps/Q-Share+.md, data contract). */
export interface ShareFile {
  filename: string;
  identifier: string;
  name: string;
  service?: string;
  mimetype?: string;
  size?: number;
}

interface FileRowProps {
  file: ShareFile;
  /** Identifier of the share the file belongs to, so the downloads panel can link back. */
  jsonId: string;
}

/**
 * One attachment on the share page: kind icon, a filename that wraps, the
 * size, the download control (Download → progress → Save) and, when the
 * file can be shown inline, a preview toggle with the preview below (PDFs:
 * "Open PDF", which uses Hub's reader).
 */
export const FileRow = ({ file, jsonId }: FileRowProps) => {
  const settings = useAppSettings();
  const kind = fileKind(file.mimetype, file.filename);
  const preview = previewKind(file);
  const [previewOpen, setPreviewOpen] = useState(() => shouldAutoPreview(file, settings));
  const fileInfo: FileInfo = {
    name: file.name,
    service: file.service || "FILE",
    identifier: file.identifier,
    filename: file.filename,
    mimetype: file.mimetype,
    mimeType: file.mimetype,
    size: file.size,
  };

  return (
    <Box
      component="li"
      sx={{
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        width: "100%",
        minWidth: 0,
        padding: { xs: 1.5, sm: 2 },
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 1.5,
            bgcolor: "action.hover",
            color: "text.secondary",
          }}
        >
          {fileKindIconElement(kind)}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h3"
            sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere", wordBreak: "break-word" }}
          >
            {file.filename}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ marginTop: 0.25 }}>
            {fileKindLabel(kind)} · {formatBytes(file.size || 0)}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          gap: 1,
          minWidth: 0,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>
          <FileElement fileInfo={fileInfo} jsonId={jsonId} />
        </Box>
        {preview === "pdf" ? (
          <OpenPdfButton file={file} jsonId={jsonId} />
        ) : (
          preview && (
            <PreviewToggleButton
              kind={preview}
              open={previewOpen}
              onToggle={() => setPreviewOpen((o) => !o)}
              filename={file.filename}
            />
          )
        )}
      </Box>

      {preview && preview !== "pdf" && <PreviewPanel file={file} kind={preview} open={previewOpen} />}
    </Box>
  );
};
