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

const BUILD_NUDGE_MS = 7_500;

export function resourceUrl({ service, name, identifier }: FileInfo): string {
  return `/arbitrary/${service}/${encodeURIComponent(name)}/${encodeURIComponent(identifier)}`;
}

/**
 * Reads a file that is on the node and hands it to Hub's SAVE_FILE dialog.
 * The node's own filename and type win over the stored ones when it has them.
 */
export async function saveFromNode(
  ref: FileInfo,
  fallback: { filename?: string; mimeType?: string } = {}
): Promise<void> {
  let { filename, mimeType } = fallback;
  try {
    const props = await qortalRequest({ action: "GET_QDN_RESOURCE_PROPERTIES", ...ref });
    filename = props?.filename || filename;
    mimeType = props?.mimeType || mimeType;
  } catch {
    /* the stored filename is good enough */
  }
  const response = await fetch(resourceUrl(ref));
  if (!response.ok) throw new Error(`The node answered ${response.status}`);
  const blob = await response.blob();
  await qortalRequest({ action: "SAVE_FILE", blob, filename, mimeType });
}

export function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") return error || fallback;
  const e = error as { error?: unknown; message?: unknown } | null;
  if (typeof e?.error === "string") return e.error || fallback;
  if (typeof e?.message === "string") return e.message || fallback;
  return fallback;
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
  const nudging = useRef(false);
  const nudgeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
      });
    } catch (error) {
      const msg = errorMessage(error, "Could not save the file");
      if (!/cancel/i.test(msg)) dispatch(setNotification({ msg, alertType: "error" }));
    } finally {
      setSaving(false);
    }
  }, [dispatch, download, fileInfo, phase, ref, saving]);

  // Once every chunk is local the node still has to build the file; asking for
  // its properties every few seconds (tab visible only) makes that happen sooner.
  useEffect(() => {
    const stopNudging = () => {
      if (nudgeTimer.current) clearInterval(nudgeTimer.current);
      nudgeTimer.current = null;
    };
    if (phase !== "building") {
      stopNudging();
      return;
    }
    nudgeTimer.current = setInterval(async () => {
      if (nudging.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      nudging.current = true;
      try {
        await qortalRequest({ action: "GET_QDN_RESOURCE_PROPERTIES", ...ref });
      } catch {
        /* the status poll reports the outcome */
      } finally {
        nudging.current = false;
      }
    }, BUILD_NUDGE_MS);
    return stopNudging;
  }, [phase, ref]);

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
