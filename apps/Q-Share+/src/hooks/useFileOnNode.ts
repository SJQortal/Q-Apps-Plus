import { useCallback, useContext, useState } from "react";
import { useSelector } from "react-redux";
import { FAILED_STATUSES, MyContext, downloadPhase, downloadStatusText } from "../wrappers/DownloadWrapper";
import type { RootState } from "../state/store";

export interface NodeFileRef {
  name: string;
  service?: string;
  identifier: string;
  filename?: string;
  mimetype?: string;
  size?: number;
}

/**
 * - "idle": not asked yet.
 * - "checking": the status call is out.
 * - "fetching": on its way from peers (follow `statusText` and `percent`).
 * - "ready": on the node, safe to read.
 * - "failed": the node can't provide it (`statusText` says why).
 */
export type FileOnNodeState = "idle" | "checking" | "fetching" | "ready" | "failed";

type Checked = { state: FileOnNodeState; status?: string };

/**
 * Gets a file onto the node before the app reads it. A GET of
 * `/arbitrary/FILE/…` for a file that isn't fully local blocks for up to
 * about 15 s and then answers 404 ("Data unavailable"), so readers call
 * `ensure()` first: one GET_QDN_RESOURCE_STATUS, and when the file isn't
 * READY it starts through the shared download machine (DownloadWrapper), so
 * the file row shows the same progress and nothing polls twice.
 */
export function useFileOnNode(file: NodeFileRef, jsonId?: string) {
  const { downloadVideo } = useContext(MyContext);
  const download = useSelector((state: RootState) => state.global?.downloads?.[file.identifier]);
  const [checked, setChecked] = useState<Checked>({ state: "idle" });

  const status: string | undefined = download?.status?.status;
  const phase = downloadPhase(status, Boolean(download));
  const percent = Math.max(0, Math.min(100, Math.round(download?.status?.percentLoaded ?? 0)));
  const service = file.service || "FILE";

  /** Resolves true when the file can be read now; otherwise follow `state`. */
  const ensure = useCallback(async (): Promise<boolean> => {
    if (phase === "ready" || (checked.state === "ready" && !download)) return true;
    // A download already under way (the row's Download, Fetch all): just follow it.
    if (download && phase !== "failed") return false;
    setChecked({ state: "checking" });
    let res: { status?: string } | null = null;
    try {
      res = await qortalRequest({ action: "GET_QDN_RESOURCE_STATUS", name: file.name, service, identifier: file.identifier });
    } catch {
      /* no answer: let the read itself say what is wrong */
    }
    const current = res?.status;
    if (!current || current === "READY") {
      setChecked({ state: "ready" });
      return true;
    }
    if (FAILED_STATUSES.has(current)) {
      setChecked({ state: "failed", status: current });
      return false;
    }
    downloadVideo({
      name: file.name,
      service,
      identifier: file.identifier,
      properties: { ...file, service, mimeType: file.mimetype, jsonId },
    });
    setChecked({ state: "fetching" });
    return false;
  }, [checked.state, download, downloadVideo, file, jsonId, phase, service]);

  let state: FileOnNodeState;
  if (phase === "ready" || (checked.state === "ready" && phase !== "failed")) state = "ready";
  else if (checked.state === "checking") state = "checking";
  else if (download) state = phase === "failed" ? "failed" : "fetching";
  else state = checked.state;

  const statusText =
    state === "failed" && !download ? downloadStatusText(checked.status, 0) : downloadStatusText(status, percent, Boolean(download));

  return { state, percent, statusText, ensure };
}
