import { useCallback, useContext, useState } from "react";
import { useSelector, useStore } from "react-redux";
import { FAILED_STATUSES, MyContext, downloadPhase, downloadStatusText } from "../wrappers/DownloadWrapper";
import type { RootState } from "../state/store";
import { resourceStatus } from "../utils/qdnResource";

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

const ON_NODE: Checked = { state: "ready", status: "READY" };

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
  const store = useStore<RootState>();
  const download = useSelector((state: RootState) => state.global?.downloads?.[file.identifier]);
  const [checked, setChecked] = useState<Checked>({ state: "idle" });

  const status: string | undefined = download?.status?.status;
  const phase = downloadPhase(status, Boolean(download));
  const percent = Math.max(0, Math.min(100, Math.round(download?.status?.percentLoaded ?? 0)));

  // A READY entry means the file is on the node. Remember it, so clearing the
  // entry from the downloads list doesn't take away a player that is showing.
  if (phase === "ready" && checked.status !== "READY") setChecked(ON_NODE);

  /**
   * Resolves true when the file can be read now; otherwise follow `state`.
   * Reads the download entry at call time, so it stays stable for effects.
   */
  const ensure = useCallback(async (): Promise<boolean> => {
    const service = file.service || "FILE";
    const entry = store.getState().global?.downloads?.[file.identifier];
    const entryPhase = downloadPhase(entry?.status?.status, Boolean(entry));
    if (entryPhase === "ready") {
      setChecked(ON_NODE);
      return true;
    }
    // A download already under way (the row's Download, Fetch all): just follow it.
    if (entry && entryPhase !== "failed") return false;
    setChecked({ state: "checking" });
    let res: { status?: string } | null = null;
    try {
      res = await resourceStatus({ name: file.name, service, identifier: file.identifier });
    } catch {
      /* no answer: let the read itself say what is wrong */
    }
    const current = res?.status;
    if (!current || current === "READY") {
      // No answer counts as ready too, but not as confirmed.
      setChecked({ state: "ready", status: current });
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
  }, [downloadVideo, file, jsonId, store]);

  let state: FileOnNodeState;
  if (phase === "ready" || (checked.state === "ready" && phase !== "failed")) state = "ready";
  else if (checked.state === "checking") state = "checking";
  else if (download) state = phase === "failed" ? "failed" : "fetching";
  else state = checked.state;

  const statusText =
    state === "failed" && !download ? downloadStatusText(checked.status, 0) : downloadStatusText(status, percent, Boolean(download));

  // The node itself said READY (status check or download entry), not just no answer.
  const confirmed = checked.status === "READY" || phase === "ready";

  return { state, confirmed, percent, statusText, ensure };
}
