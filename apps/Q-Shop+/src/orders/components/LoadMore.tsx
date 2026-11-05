/**
 * The end of an order list: a sentinel that asks for the next page when it
 * scrolls into view (after Q-Share+'s LazyLoad: it never overlaps two
 * requests, keeps loading while it stays in view up to 5 pages, then offers
 * Load more), and "Couldn't load more orders" with Retry when a page failed.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import { Box, Button, CircularProgress, Typography } from "@mui/material";

export const MAX_AUTO_PAGES = 5;

export function LoadMore({
  hasMore,
  loading,
  failed,
  onLoadMore,
}: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onLoadMore: () => Promise<unknown>;
}) {
  const [capped, setCapped] = useState(false);
  const pending = useRef(false);
  const autoLoads = useRef(0);
  const latest = useRef({ hasMore, loading, failed, onLoadMore });
  useLayoutEffect(() => {
    latest.current = { hasMore, loading, failed, onLoadMore };
  });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = () => {
    pending.current = true;
    Promise.resolve()
      .then(() => latest.current.onLoadMore())
      .catch(() => {})
      .finally(() => {
        pending.current = false;
      });
  };

  const onChange = (visible: boolean) => {
    if (!visible) {
      autoLoads.current = 0;
      return;
    }
    const now = latest.current;
    if (pending.current || now.loading || now.failed || !now.hasMore) return;
    if (autoLoads.current >= MAX_AUTO_PAGES) {
      if (mounted.current) setCapped(true);
      return;
    }
    autoLoads.current += 1;
    load();
  };

  const [ref] = useInView({ threshold: 0, rootMargin: "200px 0px", onChange });

  const loadByButton = () => {
    if (pending.current || loading) return;
    autoLoads.current = 0;
    setCapped(false);
    load();
  };

  if (!hasMore && !failed) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, py: 2 }}>
      {/* A new element when loading ends, so the observer takes a fresh reading. */}
      {!failed && (
        <Box
          key={loading ? "busy" : "idle"}
          ref={ref}
          aria-hidden
          sx={{ minHeight: 28, display: "flex", justifyContent: "center" }}
        >
          <CircularProgress size={24} sx={{ visibility: loading ? "visible" : "hidden" }} />
        </Box>
      )}
      {failed ? (
        <Box role="status" sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Couldn't load more orders.
          </Typography>
          <Button variant="outlined" onClick={loadByButton} aria-disabled={loading || undefined} sx={{ minHeight: 44 }}>
            {loading ? "Loading…" : "Retry"}
          </Button>
        </Box>
      ) : (
        capped && (
          <Button variant="outlined" onClick={loadByButton} aria-disabled={loading || undefined} sx={{ minHeight: 44 }}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        )
      )}
    </Box>
  );
}
