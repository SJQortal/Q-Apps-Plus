import { useCallback, useContext, useEffect, useMemo, useState } from "react";
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

/**
 * Still being polled: not ready, failed, or given up on. Files waiting for
 * peers that lack chunks (MISSING_DATA, REFETCHING) count too: their pollers
 * keep going, so a share whose seeder is offline must not start them all.
 */
function inFlight(entry: any): boolean {
  if (!entry) return false;
  const phase = downloadPhase(entry.status?.status, true);
  if (phase === "ready" || phase === "failed") return false;
  return entry.status?.stopped !== true;
}

/**
 * "Fetch all files" for a share: asks for every file that isn't on its way
 * yet and starts them FETCH_ALL_AT_ONCE at a time, the next as soon as one
 * is ready, fails or is given up on. Leaving the page stops starting new ones.
 */
export function useFetchAll(files: ShareFile[], jsonId: string) {
  const { downloadVideo } = useContext(MyContext);
  const downloads = useSelector((state: RootState) => state.global.downloads);
  // Files asked for and not started yet, in order.
  const [queue, setQueue] = useState<string[]>([]);

  const pending = useMemo(
    () =>
      files.filter(
        (f) => f?.identifier && (!downloads?.[f.identifier] || isFailedStatus(downloads[f.identifier]?.status?.status))
      ),
    [downloads, files]
  );
  const readyCount = files.filter((f) => downloads?.[f.identifier]?.status?.status === "READY").length;
  const allReady = files.length > 0 && readyCount === files.length;

  useEffect(() => {
    if (queue.length === 0) return;
    const busy = files.filter((f) => inFlight(downloads?.[f.identifier])).length;
    const next = queue.slice(0, Math.max(0, FETCH_ALL_AT_ONCE - busy));
    if (next.length === 0) return;
    for (const id of next) {
      const file = files.find((f) => f.identifier === id);
      if (!file) continue;
      const service = file.service || "FILE";
      // Skips a file already on its way; starts a failed one again.
      downloadVideo({
        name: file.name,
        service,
        identifier: file.identifier,
        properties: { ...file, service, mimeType: file.mimetype, jsonId },
      });
    }
    // Off the queue once started; the downloads they add bring this effect back for the next ones.
    queueMicrotask(() => setQueue((q) => q.filter((id) => !next.includes(id))));
  }, [queue, downloads, files, downloadVideo, jsonId]);

  const fetchAll = useCallback(() => setQueue(pending.map((f) => f.identifier)), [pending]);

  return { fetchAll, pending, readyCount, allReady, waiting: queue.length };
}
