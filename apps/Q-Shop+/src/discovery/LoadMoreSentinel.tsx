import { Box } from "@mui/material";
import { useInView } from "react-intersection-observer";

/**
 * An invisible line at the end of a list that calls `onVisible` when it comes
 * near the screen. Give it a new `key` after each load, so a list that is
 * still too short to push it off screen keeps loading.
 */
export function LoadMoreSentinel({ onVisible }: { onVisible: () => void }) {
  const { ref } = useInView({
    rootMargin: "0px 0px 600px 0px",
    onChange: (inView) => {
      if (inView) onVisible();
    },
  });
  return <Box ref={ref} aria-hidden sx={{ height: 2 }} />;
}
