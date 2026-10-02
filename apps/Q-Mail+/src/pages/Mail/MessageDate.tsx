/**
 * A message date: the relative form by default, the exact timestamp on tap,
 * hover or long-press (MUI Tooltip handles the touch long-press).
 */
import { useState } from "react";
import { Tooltip, Typography } from "@mui/material";
import { exactMailDate, relativeMailDate } from "./readerTime";

export function MessageDate({ timestamp, color, asText }: { timestamp: number | string | undefined | null; color?: string; asText?: boolean }) {
  const [exact, setExact] = useState(false);
  const relative = relativeMailDate(timestamp);
  const full = exactMailDate(timestamp);
  if (!relative) return null;
  if (asText) {
    // Inside another button (a collapsed reply header): no nested button, the
    // exact time is on the tooltip (hover, or long-press on touch).
    return (
      <Tooltip title={full} enterTouchDelay={500} leaveTouchDelay={3000}>
        <Typography component="span" variant="body2" sx={{ color: color || "text.secondary", fontSize: "0.875rem" }}>
          <time dateTime={new Date(Number(timestamp)).toISOString()}>{relative}</time>
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
        <time dateTime={new Date(Number(timestamp)).toISOString()}>{exact ? full : relative}</time>
      </Typography>
    </Tooltip>
  );
}
