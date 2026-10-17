import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../state/store";
import { MyContext, downloadPhase, isFailedStatus } from "../../wrappers/DownloadWrapper";
import type { ShareFile } from "./FileRow";

/**
 * How many files "Fetch all" keeps on their way at once. Every download
 * polls the node every 5 s (DownloadWrapper), so a share of 300 files
 * started together would ask 60 times a second.
 */
export const FETCH_ALL_AT_ONCE = 6;

/** Still being fetched: not ready, failed, waiting for peers that lack it, or given up on. */
function inFlight(entry: any): boolean {
  if (!entry) return false;
  const status: string | undefined = entry.status?.status;
  const phase = downloadPhase(status, true);
  if (phase === "ready" || phase === "failed") return false;
  return status !== "MISSING_DATA" && entry.status?.stopped !== true;
}

/**
 * "Fetch all files" for a share: asks for every file that isn't on its way
 * yet and starts them FETCH_ALL_AT_ONCE at a time, the next as soon as one
 * is ready or stops. Leaving the page stops starting new ones.
 */
export function useFetchAll(files: ShareFile[], jsonId: string) {
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  const [requested, setRequested] = useState<string[]>([]);
  // Started by this page since the last Fetch all; read only in the effect.
  const started = useRef(new Set<string>());

  const pending = useMemo(
    () =>
      files.filter(
        (f) => f?.identifier && (!downloads?.[f.identifier] || isFailedStatus(downloads[f.identifier]?.status?.status))
      ),
    [downloads, files]
  );
  const readyCount = files.filter((f) => downloads?.[f.identifier]?.status?.status === "READY").length;
  const allReady = files.length > 0 && readyCount === files.length;
  const waiting = requested.filter((id) => !downloads?.[id]).length;

  useEffect(() => {
    const busy = files.filter((f) => inFlight(downloads?.[f.identifier])).length;
    let room = FETCH_ALL_AT_ONCE - busy;
    for (const id of requested) {
      if (room <= 0) break;
      if (started.current.has(id)) continue;
      const file = files.find((f) => f.identifier === id);
      started.current.add(id);
      if (!file) continue;
      const service = file.service || "FILE";
      downloadVideo({
        name: file.name,
        service,
        identifier: file.identifier,
        properties: { ...file, service, mimeType: file.mimetype, jsonId },
      });
      room -= 1;
    }
  }, [requested, downloads, files, downloadVideo, jsonId]);

  const fetchAll = useCallback(() => {
    const ids = pending.map((f) => f.identifier);
    for (const id of ids) started.current.delete(id);
    setRequested(ids);
  }, [pending]);

  return { fetchAll, pending, readyCount, allReady, waiting };
}
