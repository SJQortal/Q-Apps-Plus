import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Box, Skeleton } from "@mui/material";
import { useFetchFiles, summaryToVideo } from "../../hooks/useFetchFiles.tsx";
import LazyLoad from "../../components/common/LazyLoad";
import { Video } from "../../state/features/fileSlice.ts";
import { queue } from "../../utils/queue";
import { QSHARE_FILE_BASE } from "../../constants/Identifiers.ts";
import { QDN_PAGE, searchQdn } from "../../utils/qdnSearch";
import { FileList } from "./FileList.tsx";
import { EmptyState } from "../../components/common/EmptyState.tsx";

/** The shares of one publisher, on the profile page. */
export const FileListComponentLevel = () => {
  const { name: paramName } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [videos, setVideos] = React.useState<Video[]>([]);
  const isFetching = useRef(false);
  const { getFile, checkAndUpdateFile } = useFetchFiles();

  const getVideos = useCallback(
    async (reset = false) => {
      if (!paramName || isFetching.current) return;
      if (!reset && !hasMore) return;
      isFetching.current = true;
      setIsLoading(true);
      setError(false);
      try {
        const offset = reset ? 0 : videos.length;
        const rows = await searchQdn({
          service: "DOCUMENT",
          query: QSHARE_FILE_BASE,
          name: paramName,
          limit: QDN_PAGE,
          offset,
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
        for (const content of structureData) {
          if (content.user && content.id && checkAndUpdateFile(content)) {
            queue.push(() => getFile(content.user, content.id, content));
          }
        }
      } catch {
        setError(true);
      } finally {
        isFetching.current = false;
        setIsLoading(false);
      }
    },
    [paramName, videos, hasMore, checkAndUpdateFile, getFile]
  );

  // A new name: start over. The fetch is queued after this render so the
  // effect itself sets no state (React 19 hooks rules); a reset ignores the
  // stale list and hasMore captured by this getVideos.
  const lastParam = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastParam.current === paramName) return;
    lastParam.current = paramName;
    isFetching.current = false;
    queueMicrotask(() => {
      setVideos([]);
      setHasMore(true);
      void getVideos(true);
    });
  }, [paramName, getVideos]);

  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 1.5 }}>
      {error && videos.length === 0 ? (
        <EmptyState title="Could not load this publisher's shares" actionLabel="Retry" onAction={() => getVideos(true)} />
      ) : videos.length === 0 && isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} variant="rounded" height={64} />
          ))}
        </Box>
      ) : videos.length === 0 ? (
        <EmptyState title="No shares from this name yet" />
      ) : (
        <>
          <FileList files={videos} showPublisher={false} />
          <LazyLoad onLoadMore={() => getVideos(false)} isLoading={isLoading} />
        </>
      )}
    </Box>
  );
};
