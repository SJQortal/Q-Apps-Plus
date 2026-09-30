import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Skeleton } from "@mui/material";
import { useFetchFiles, summaryToVideo, useListedFiles } from "../../hooks/useFetchFiles.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import { PageRetry } from "../../components/common/PageRetry.tsx";
import { Video } from "../../state/features/fileSlice.ts";
import { QSHARE_FILE_BASE } from "../../constants/Identifiers.ts";
import { QDN_PAGE, QDN_SEARCH_TTL_MS, searchQdn } from "../../utils/qdnSearch";
import { FileList } from "./FileList.tsx";
import { EmptyState } from "../../components/common/EmptyState.tsx";

/** When each name's profile list last opened, to tell a new visit from coming back (share → Back). */
const profileOpenedAt = new Map<string, number>();

/** The shares of one publisher, on the profile page. */
export const FileListComponentLevel = () => {
  const { name: paramName } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [videos, setVideos] = React.useState<Video[]>([]);
  const isFetching = useRef(false);
  // Set per visit: whether shares marked unavailable get their tries again.
  const retryUnavailable = useRef(true);
  const { queueBodies } = useFetchFiles();

  const getVideos = useCallback(
    async (reset = false) => {
      if (!paramName || isFetching.current) return;
      if (!reset && !hasMore) return;
      isFetching.current = true;
      setIsLoading(true);
      setError(false);
      try {
        const offset = reset ? 0 : videos.length;
        // An identifier prefix, as Home searches: the same rows as query= (checked
        // on a node for names with up to 300 shares) from a cheaper Core query.
        const rows = await searchQdn({
          service: "DOCUMENT",
          identifier: QSHARE_FILE_BASE,
          name: paramName,
          limit: QDN_PAGE,
          offset,
          // Titles and dates show before each body lands.
          includemetadata: true,
        });
        const structureData = rows.map(summaryToVideo);
        setVideos((prev) => {
          const next = reset ? [] : [...prev];
          for (const video of structureData) {
            const index = next.findIndex((p) => p.id === video.id);
            if (index !== -1) next[index] = video;
            else next.push(video);
          }
          return next;
        });
        setHasMore(structureData.length >= QDN_PAGE);
        // As on Home: a body already queued (by Home, or before Back) isn't queued twice.
        // Hidden names too: Home never shows them, but a profile opened on purpose does.
        queueBodies(structureData, retryUnavailable.current, false);
      } catch {
        setError(true);
      } finally {
        isFetching.current = false;
        setIsLoading(false);
      }
    },
    [paramName, videos, hasMore, queueBodies]
  );

  // A new name: start over. The fetch is queued after this render so the
  // effect itself sets no state (React 19 hooks rules); a reset ignores the
  // stale list and hasMore captured by this getVideos.
  const lastParam = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastParam.current === paramName) return;
    lastParam.current = paramName;
    isFetching.current = false;
    // Within the search TTL the rows come from the session cache: this is coming
    // back to the same list (share → Back), so, as Home on Back, shares marked
    // unavailable keep their row (the share page has Retry) instead of three
    // more ~15 s tries each.
    const now = Date.now();
    const opened = paramName ? profileOpenedAt.get(paramName) : undefined;
    retryUnavailable.current = opened === undefined || now - opened > QDN_SEARCH_TTL_MS;
    if (paramName) profileOpenedAt.set(paramName, now);
    queueMicrotask(() => {
      setVideos([]);
      setHasMore(true);
      void getVideos(true);
    });
  }, [paramName, getVideos]);

  // Deleted shares ("D" bodies) are left out; a name whose shares are all deleted is empty.
  const listed = useListedFiles(videos);
  // Holds the list's rows, for Retry to move focus to the first row its page adds.
  const rows = useRef<HTMLDivElement>(null);

  return (
    <Box ref={rows} sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
      {error && listed.length === 0 ? (
        <EmptyState title="Could not load this publisher's shares" actionLabel="Retry" onAction={() => getVideos(true)} />
      ) : videos.length === 0 && isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={64} />
          ))}
        </Box>
      ) : listed.length === 0 && !hasMore && !isLoading ? (
        <EmptyState title="No shares from this name yet" />
      ) : (
        <>
          <FileList files={listed} showPublisher={false} />
          {/* A failed page stops the pager (it would retry at once, up to five times) until Retry. */}
          <LazyLoad onLoadMore={() => getVideos(false)} isLoading={isLoading} hasMore={hasMore && !error} />
          <PageRetry failed={error} onRetry={() => getVideos(false)} rows={rows} />
        </>
      )}
    </Box>
  );
};
