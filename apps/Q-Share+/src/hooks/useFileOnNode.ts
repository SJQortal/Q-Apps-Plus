import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
 *
 * While a reader waits on that download, one whose poller gave up (six status
 * errors in a row: the node dropped out) is started again once without a new
 * tap. If it gives up again, `stopped` is true and the reader offers a way to
 * try again, rather than this hook asking a node that stays down over and over.
 */
export function useFileOnNode(file: NodeFileRef, jsonId?: string) {
  const { downloadVideo, retryDownload } = useContext(MyContext);
  const store = useStore<RootState>();
  const download = useSelector((state: RootState) => state.global?.downloads?.[file.identifier]);
  const [checked, setChecked] = useState<Checked>({ state: "idle" });
  // ensure() is waiting on a download and may restart it once (the effect below).
  const pickUp = useRef(false);

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
    pickUp.current = false;
    if (entryPhase === "ready") {
      setChecked(ON_NODE);
      return true;
    }
    // A download already under way (the row's Download, Fetch all): follow it.
    // REFETCHING may have no poller left (it gives up after six status errors),
    // so pick it up as the row's Retry does; MISSING_DATA always keeps one.
    if (entry && entryPhase !== "failed") {
      if (entry.status?.status === "REFETCHING") retryDownload({ name: file.name, service, identifier: file.identifier });
      pickUp.current = true;
      return false;
    }
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
    pickUp.current = true;
    return false;
  }, [downloadVideo, retryDownload, file, jsonId, store]);

  let state: FileOnNodeState;
  if (phase === "ready" || (checked.state === "ready" && phase !== "failed")) state = "ready";
  else if (checked.state === "checking") state = "checking";
  else if (download) state = phase === "failed" ? "failed" : "fetching";
  else state = checked.state;

  // The poller gave up on the download and nothing polls it now.
  const stopped = state === "fetching" && phase === "stalled" && download?.status?.stopped === true;

  const { name, identifier } = file;
  const service = file.service || "FILE";
  useEffect(() => {
    if (!stopped || !pickUp.current) return;
    pickUp.current = false;
    retryDownload({ name, service, identifier });
  }, [stopped, retryDownload, name, service, identifier]);

  let statusText: string;
  if (stopped) statusText = `Your node stopped answering at ${percent}%`;
  else if (state === "failed" && !download) statusText = downloadStatusText(checked.status, 0);
  else statusText = downloadStatusText(status, percent, Boolean(download));

  // The node itself said READY (status check or download entry), not just no answer.
  const confirmed = checked.status === "READY" || phase === "ready";

  return { state, confirmed, stopped, percent, statusText, ensure };
}
