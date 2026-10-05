/**
 * A message date: the relative form by default, the exact timestamp on tap,
 * hover or long-press (MUI Tooltip handles the touch long-press). The
 * <time> element always carries a machine-readable `dateTime` (ISO 8601),
 * from `mailDateTime`, which list rows can use for theirs too.
 */
import { useState } from "react";
import { Tooltip, Typography } from "@mui/material";
import { exactMailDate, relativeMailDate } from "./readerTime";

/** ISO 8601 for a <time dateTime>, or undefined for a missing or invalid timestamp. */
export function mailDateTime(timestamp: number | string | undefined | null): string | undefined {
  const n = Number(timestamp);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  const date = new Date(n);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function MessageDate({ timestamp, color, asText }: { timestamp: number | string | undefined | null; color?: string; asText?: boolean }) {
  const [exact, setExact] = useState(false);
  const relative = relativeMailDate(timestamp);
  const full = exactMailDate(timestamp);
  const dateTime = mailDateTime(timestamp);
  if (!relative || !dateTime) return null;
  if (asText) {
    // Inside another button (a collapsed reply header): no nested button, the
    // exact time is on the tooltip (hover, or long-press on touch).
    return (
      <Tooltip title={full} enterTouchDelay={500} leaveTouchDelay={3000}>
        <Typography component="span" variant="body2" sx={{ color: color || "text.secondary", fontSize: "0.875rem" }}>
          <time dateTime={dateTime}>{relative}</time>
        </Typography>
      </Tooltip>
    );
  }
  return (
    <Tooltip title={exact ? "Show relative time" : full} enterTouchDelay={500} leaveTouchDelay={3000}>
      <Typography
        component="button"
        type="button"
        onClick={() => setExact((v) => !v)}
        aria-label={exact ? `Sent ${full}. Show relative time` : `Sent ${relative}. Show exact time`}
        variant="body2"
        sx={{
          background: "none",
          border: 0,
          padding: 0,
          margin: 0,
          // A 44 px target; the negative margin keeps the header's rhythm.
          minHeight: 44,
          my: "-10px",
          display: "inline-flex",
          alignItems: "center",
          cursor: "pointer",
          font: "inherit",
          fontSize: "0.875rem",
          color: color || "text.secondary",
          textAlign: "left",
          "&:focus-visible": { outline: (theme) => `2px solid ${theme.palette.primary.main}`, borderRadius: 1 },
        }}
      >
        <time dateTime={dateTime}>{exact ? full : relative}</time>
      </Typography>
    </Tooltip>
  );
}
