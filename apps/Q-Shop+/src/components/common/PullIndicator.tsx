import { Box, CircularProgress } from "@mui/material";

/** The spinner a pull to refresh shows above a page (hooks/usePullToRefresh.ts). */
export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  return (
    <Box
      role="status"
      aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
      sx={{
        height: refreshing ? 48 : Math.round(pull * 0.6),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <CircularProgress
        size={24}
        variant={refreshing ? "indeterminate" : "determinate"}
        value={Math.min(100, (pull / 72) * 100)}
      />
    </Box>
  );
}
