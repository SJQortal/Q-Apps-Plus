import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, Button, LinearProgress, Typography } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import SaveAltOutlinedIcon from "@mui/icons-material/SaveAltOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { MyContext, downloadPhase, downloadStatusText, type DownloadPhase } from "../../wrappers/DownloadWrapper";
import { RootState } from "../../state/store";
import { setNotification } from "../../state/features/notificationsSlice";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { errorMessage, isHubDecline } from "../../utils/hubErrors";

// Kept here too: other modules import it from this file.
export { errorMessage };

export interface FileInfo {
  name: string;
  service: string;
  identifier: string;
  filename?: string;
  /** Stored as `mimetype` in the share JSON; some callers pass `mimeType`. */
  mimetype?: string;
  mimeType?: string;
  size?: number;
}

export function resourceUrl({ service, name, identifier }: FileInfo): string {
  return `/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

/** An older Hub's "Missing fields: blob" (the field name is never translated). */
function asksForBlob(error: unknown): boolean {
  return /\bblob\b/i.test(errorMessage(error, ""));
}

/**
 * False when GO would save the file by `location` with no name. GO names that
 * file with Hub's normalizeFilename, which keeps only A-Z, a-z, 0-9, space, _
 * and - before the extension (accents stripped), so "Отчёт.pdf" or "规划.docx"
 * lands in Documents/Qortal Go as a hidden, nameless ".pdf". A blob save keeps
 * the name, so such files take that path until GO keeps Unicode names too.
 */
export function keepsNameByLocation(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  return /[A-Za-z0-9]/.test(stem.normalize("NFD"));
}

const STREAM_FROM_BYTES = 100 * 1024 * 1024;

/**
 * Whether to let Hub fetch the file itself (`location`) rather than handing it
 * a blob. GO downloads by location natively, while a blob crosses the WebView
 * bridge, so GO always streams. Desktop Hub follows its own prompt with a
 * native Save As dialog for a location save; a blob goes straight to
 * Downloads in one step, so small files keep that and only big ones, where
 * holding the file in this frame costs real memory, stream.
 */
export function streamsByLocation(size: number | undefined, userAgent = navigator.userAgent): boolean {
  if (/Android/i.test(userAgent)) return true;
  return !size || size >= STREAM_FROM_BYTES;
}

/**
 * Hands a file that is on the node to Hub's SAVE_FILE dialog. Hub streams it
 * from the node by `location` (Electron writes it to disk in chunks, GO
 * downloads it natively), so the file never passes through this frame and the
 * prompt comes before any bytes move. Small files on desktop (see
 * streamsByLocation), Hubs that only take a blob, and names GO would strip to
 * nothing (see keepsNameByLocation) get one read here instead. The node's own
 * filename, type and size win over the stored ones.
 */
export async function saveFromNode(
  ref: FileInfo,
  fallback: { filename?: string; mimeType?: string; size?: number } = {}
): Promise<void> {
  let { filename, mimeType } = fallback;
  let size = fallback.size;
  try {
    const props = await qortalRequest({ action: "GET_QDN_RESOURCE_PROPERTIES", ...ref });
    filename = props?.filename || filename;
    mimeType = props?.mimeType || mimeType;
    size = Number(props?.size) || size;
  } catch {
    /* the stored filename is good enough */
  }
  // Hub refuses a save without a filename.
  filename = filename || ref.identifier;
  const byLocation: QortalRequestOptions = {
    action: "SAVE_FILE",
    filename,
    mimeType,
    location: { service: ref.service, name: ref.name, identifier: ref.identifier },
  };
  if (keepsNameByLocation(filename) && streamsByLocation(size)) {
    try {
      await qortalRequest(byLocation);
      return;
    } catch (error) {
      // Only a Hub without `location` support falls back: after a decline or a
      // failed download a second prompt (and a whole-file read) would be wrong.
      if (!asksForBlob(error)) throw error;
    }
  }
  const response = await fetch(resourceUrl(ref));
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  const blob = await response.blob();
  await qortalRequest({ action: "SAVE_FILE", blob, filename, mimeType });
}

/**
 * One attachment's place in the download machine (see DownloadWrapper), plus
 * the actions a row needs: `start` asks the node to fetch it, `retry` nudges a
 * stalled fetch, and `save` hands the built file to Hub's SAVE_FILE dialog.
 */
export function useFileDownload(fileInfo: FileInfo, jsonId: string) {
  const { downloadVideo, retryDownload } = useContext(MyContext);
  const dispatch = useDispatch();
  const download = useSelector((state: RootState) => state.global?.downloads?.[fileInfo?.identifier]);
  const [saving, setSaving] = useState(false);
  const startedHere = useRef(false);

  const status: string | undefined = download?.status?.status;
  const percent = Math.max(0, Math.min(100, Math.round(download?.status?.percentLoaded ?? 0)));
  const phase: DownloadPhase = downloadPhase(status, Boolean(download));
  const statusText = downloadStatusText(status, percent, Boolean(download));

  const ref = useMemo(
    () => ({ name: fileInfo.name, service: fileInfo.service || "FILE", identifier: fileInfo.identifier }),
    [fileInfo.name, fileInfo.service, fileInfo.identifier]
  );

  const start = useCallback(() => {
    startedHere.current = true;
    downloadVideo({ ...ref, properties: { ...fileInfo, service: ref.service, jsonId } });
  }, [downloadVideo, fileInfo, jsonId, ref]);

  const retry = useCallback(() => {
    startedHere.current = true;
    retryDownload(ref);
  }, [retryDownload, ref]);

  const save = useCallback(async () => {
    if (saving || phase !== "ready") return;
    setSaving(true);
    try {
      await saveFromNode(ref, {
        filename: download?.properties?.filename || fileInfo.filename,
        mimeType: download?.properties?.mimeType || fileInfo.mimeType || fileInfo.mimetype,
        size: fileInfo.size,
      });
    } catch (error) {
      // Declining Hub's save prompt (or letting it time out) is not an error.
      if (!isHubDecline(error)) dispatch(setNotification({ msg: errorMessage(error, "Could not save the file"), alertType: "error" }));
    } finally {
      setSaving(false);
    }
  }, [dispatch, download, fileInfo, phase, ref, saving]);

  useEffect(() => {
    if (phase === "ready" && startedHere.current) {
      startedHere.current = false;
      dispatch(setNotification({ msg: `${fileInfo.filename || "File"} is ready to save`, alertType: "info" }));
    }
  }, [dispatch, fileInfo.filename, phase]);

  return { download, phase, status, percent, statusText, start, retry, save, saving };
}

interface FileElementProps {
  fileInfo: FileInfo;
  jsonId: string;
  disable?: boolean;
}

/**
 * The download control of one attachment: Download → progress (with Retry when
 * stalled) → Building → Save. Buttons fill the width on phones.
 */
export default function FileElement({ fileInfo, jsonId, disable }: FileElementProps) {
  const phone = usePhoneLayout();
  const { phase, percent, statusText, start, retry, save, saving } = useFileDownload(fileInfo, jsonId);
  const label = fileInfo.filename || "file";
  const bigButton = { minHeight: phone ? 48 : 40, width: phone ? "100%" : "auto" };

  if (phase === "idle") {
    return (
      <Button
        variant="contained"
        startIcon={<DownloadOutlinedIcon />}
        onClick={start}
        disabled={disable}
        aria-label={`Download ${label}`}
        sx={bigButton}
      >
        Download
      </Button>
    );
  }

  if (phase === "ready") {
    return (
      <Button
        variant="contained"
        startIcon={<SaveAltOutlinedIcon />}
        onClick={save}
        disabled={disable || saving}
        aria-label={`Save ${label}`}
        sx={bigButton}
      >
        {saving ? "Saving…" : "Save"}
      </Button>
    );
  }

  if (phase === "failed") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" color="error" role="status">
          {statusText}
        </Typography>
        <Button size="small" startIcon={<RefreshOutlinedIcon />} onClick={start} sx={{ minHeight: 44 }}>
          Try again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, width: "100%" }}>
      <LinearProgress
        variant={phase === "building" ? "indeterminate" : "determinate"}
        value={percent}
        aria-label={`${label} download progress`}
        sx={{ borderRadius: 1, height: 6 }}
      />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
          {statusText}
        </Typography>
        {phase === "stalled" && (
          <Button size="small" startIcon={<RefreshOutlinedIcon />} onClick={retry} sx={{ minHeight: 44 }}>
            Retry
          </Button>
        )}
      </Box>
    </Box>
  );
}
