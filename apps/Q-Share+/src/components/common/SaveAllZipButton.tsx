import { useState } from "react";
import { useDispatch } from "react-redux";
import { Button, Tooltip } from "@mui/material";
import FolderZipOutlinedIcon from "@mui/icons-material/FolderZipOutlined";
import { setNotification } from "../../state/features/notificationsSlice";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { formatBytes } from "../../utils/formatBytes";
import { shareSlug } from "../../utils/publishPayload";
import { buildZip } from "../../utils/zip";
import { resourceUrl } from "./FileElement";

export interface ZipFile {
  name: string;
  identifier: string;
  service?: string;
  filename: string;
  size?: number;
}

interface SaveAllZipButtonProps {
  files: ZipFile[];
  /** The share title, for the archive's name. */
  title: string;
  /** Every file is on the node (the page's Fetch all has finished). */
  allReady: boolean;
}

/** The archive is built in memory, so it stays modest; bigger shares are saved file by file. */
export const ZIP_MAX_BYTES = 150 * 1024 * 1024;

/**
 * Saves every file of a share as one .zip through Hub's SAVE_FILE, once they
 * are all on the node: each file is read from the node and stored (no
 * compression) with utils/zip.ts. Shown for shares with two or more files
 * under the size limit.
 */
export function SaveAllZipButton({ files, title, allReady }: SaveAllZipButtonProps) {
  const dispatch = useDispatch();
  const phone = usePhoneLayout();
  const [progress, setProgress] = useState<string | null>(null);
  const total = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (files.length < 2 || total > ZIP_MAX_BYTES) return null;

  const save = async () => {
    if (progress) return;
    try {
      const entries = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setProgress(`Packing ${i + 1} of ${files.length}…`);
        const response = await fetch(resourceUrl({ ...file, service: file.service || "FILE" }));
        if (!response.ok) throw new Error(`The node answered ${response.status} for ${file.filename}`);
        entries.push({ name: file.filename || file.identifier, data: new Uint8Array(await response.arrayBuffer()) });
      }
      setProgress("Saving…");
      const blob = new Blob([buildZip(entries)], { type: "application/zip" });
      await qortalRequest({ action: "SAVE_FILE", blob, filename: `${shareSlug(title || "share")}.zip`, mimeType: "application/zip" });
    } catch (error: any) {
      const msg = typeof error?.error === "string" ? error.error : error?.message || "Could not build the zip";
      if (!/cancel/i.test(msg)) dispatch(setNotification({ msg, alertType: "error" }));
    } finally {
      setProgress(null);
    }
  };

  const label = progress ?? `Save all as .zip (${formatBytes(total)})`;
  const button = (
    <Button
      variant="outlined"
      startIcon={<FolderZipOutlinedIcon />}
      onClick={save}
      disabled={!allReady || progress !== null}
      sx={{ minHeight: phone ? 48 : 40, width: phone ? "100%" : "auto" }}
    >
      {label}
    </Button>
  );
  return allReady ? button : (
    <Tooltip title="Fetch all files first">
      <span style={{ display: phone ? "block" : "inline-flex" }}>{button}</span>
    </Tooltip>
  );
}
