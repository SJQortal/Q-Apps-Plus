import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import FileElement, { type FileInfo } from "../../components/common/FileElement";
import { OpenPdfButton, PreviewPanel, PreviewToggleButton, previewKind, shouldAutoPreview } from "../../components/common/FilePreview";
import { formatBytes } from "../../utils/formatBytes";
import { useAppSettings } from "../../utils/settings";
import { fileKind, fileKindIconElement, fileKindLabel } from "../../utils/fileKind";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import type { PlayerShare, Track } from "../../state/features/playerSlice";
import { usePlaylistControls } from "./PlaylistCard";

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
  /** The share's playlist, when it has one: its audio rows play through the app's player. */
  playlist?: { share: PlayerShare; tracks: Track[] };
}

/** An audio row's Play in a playlist share: starts the playlist here, or pauses and resumes this track. */
function TrackButton({ playlist, file }: { playlist: { share: PlayerShare; tracks: Track[] }; file: ShareFile }) {
  const phone = usePhoneLayout();
  const controls = usePlaylistControls(playlist.share, playlist.tracks);
  const index = playlist.tracks.findIndex((t) => t.identifier === file.identifier);
  const current = controls.current?.identifier === file.identifier;
  const label = current ? (controls.playing ? "Pause" : "Resume") : "Play";
  return (
    <Button
      variant={current ? "contained" : "outlined"}
      startIcon={current && controls.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
      onClick={(e) => {
        e.stopPropagation();
        controls.playOrToggle(index);
      }}
      aria-label={`${label} ${file.filename || "track"}`}
      sx={{ minHeight: phone ? 48 : 40, width: phone ? "100%" : "auto", flexShrink: 0 }}
    >
      {label}
    </Button>
  );
}

/** Marks the row of the track the player is on. */
function NowPlaying({ playlist, file }: { playlist: { share: PlayerShare; tracks: Track[] }; file: ShareFile }) {
  const controls = usePlaylistControls(playlist.share, playlist.tracks);
  if (controls.current?.identifier !== file.identifier) return null;
  return (
    <Typography variant="body2" sx={{ color: "primary.main", display: "flex", alignItems: "center", gap: 0.5, fontWeight: 600 }}>
      <GraphicEqRoundedIcon fontSize="small" aria-hidden />
      {controls.playing ? "Playing" : "Paused"}
    </Typography>
  );
}

/**
 * One attachment on the share page: kind icon, a filename that wraps, the
 * size, the download control (Download → progress → Save) and, when the
 * file can be shown inline, a preview toggle with the preview below ("Play
 * audio" / "Play video" for media; PDFs: "Open PDF", which uses Hub's reader).
 * In a share with a playlist, audio rows have Play instead, which plays
 * through the app's player from that track.
 */
export const FileRow = ({ file, jsonId, playlist }: FileRowProps) => {
  const settings = useAppSettings();
  const kind = fileKind(file.mimetype, file.filename);
  const preview = previewKind(file);
  const inPlaylist = Boolean(playlist) && preview === "audio";
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
          {inPlaylist && playlist ? <NowPlaying playlist={playlist} file={file} /> : null}
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
        {inPlaylist && playlist ? (
          <TrackButton playlist={playlist} file={file} />
        ) : preview === "pdf" ? (
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

      {preview && preview !== "pdf" && !inPlaylist && (
        <PreviewPanel file={file} kind={preview} open={previewOpen} jsonId={jsonId} />
      )}
    </Box>
  );
};
