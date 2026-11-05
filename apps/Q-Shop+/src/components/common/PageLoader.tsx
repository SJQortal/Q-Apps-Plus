import LinearProgress from "@mui/material/LinearProgress";

/**
 * A thin progress line along the bottom edge of the header while something
 * app-wide loads (`global.isLoadingGlobal`). The original covered the whole
 * page with a spinner instead, so every page went blank meanwhile; the page
 * stays readable now, with its own skeletons.
 */
export default function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <LinearProgress
      aria-label={label}
      sx={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: -1,
        height: 3,
        bgcolor: "transparent",
      }}
    />
  );
}
