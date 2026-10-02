import React, { useLayoutEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";

interface PageRetryProps {
  /** The last next-page load failed. */
  failed: boolean;
  /** Loads that page again; settles once it has landed or failed again. */
  onRetry: () => Promise<unknown>;
  /** An element holding the list's rows: focus moves to the first row a retried page adds. */
  rows: React.RefObject<HTMLElement | null>;
}

/** A row's main button, as FileList renders it. */
const ROW_SELECTOR = "button.row-main";

/**
 * "Could not load more shares." and a Retry for the page that failed, under a
 * list that keeps its rows. Always render it: it shows while the page has
 * failed or is loading again. The button stays mounted while that page loads
 * (as LazyLoad's Load more does), so a retry that fails again keeps focus on
 * it. When the page lands the button goes, and focus moves to the first row it
 * added instead of dropping to the top of the document.
 */
export function PageRetry({ failed, onRetry, rows }: PageRetryProps) {
  const [retrying, setRetrying] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // Set when Retry is pressed while focused: how many rows the list had then.
  const rowsBefore = useRef<number | null>(null);

  const retry = async () => {
    if (retrying) return;
    rowsBefore.current =
      document.activeElement === button.current ? (rows.current?.querySelectorAll(ROW_SELECTOR).length ?? 0) : null;
    setRetrying(true);
    try {
      await onRetry();
    } catch {
      // The list shows its own error state.
    } finally {
      setRetrying(false);
    }
  };

  // A layout effect: focus moves in the same commit that removes the button.
  useLayoutEffect(() => {
    if (retrying) return;
    const before = rowsBefore.current;
    rowsBefore.current = null;
    // Failed again: the button is still there, with focus.
    if (before === null || failed) return;
    // Only focus that went with the button; not focus the user has moved on meanwhile.
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const list = rows.current?.querySelectorAll<HTMLElement>(ROW_SELECTOR);
    if (!list?.length) return;
    // A page of hidden names adds no row: the last row, next to where the button was.
    (list[before] ?? list[list.length - 1]).focus();
  }, [retrying, failed, rows]);

  if (!failed && !retrying) return null;
  return (
    <Box role="status" sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Could not load more shares.
      </Typography>
      {/* aria-disabled, not disabled, which would drop focus while the page loads. */}
      <Button
        ref={button}
        variant="outlined"
        onClick={retry}
        aria-disabled={retrying || undefined}
        sx={{ minHeight: 44 }}
      >
        {retrying ? "Loading…" : "Retry"}
      </Button>
    </Box>
  );
}
