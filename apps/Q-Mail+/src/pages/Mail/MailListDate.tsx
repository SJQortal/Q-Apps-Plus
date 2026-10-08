/**
 * A message's date in a list (inbox, archive, sent, alias inboxes, search
 * results, sender groups, threads, drafts): the weekday, day, month and
 * time, with the year when it isn't this year (readerTime.ts), as in the
 * reader.
 *
 * Beside a row's two lines of text the date is `stacked`, the day over the
 * time, so the name and the subject keep their room on a phone; a row that
 * lays out as one line of columns (`inlineFrom`, a container query) puts it
 * back on one line.
 *
 * The detail, the full timestamp and how long ago, shows on hover. On a
 * touch screen (no hover: phones, GO) a tap on the date shows it for a few
 * seconds instead of opening the row; a tap anywhere else in the row still
 * opens it. Keyboard and screen-reader users get the date in the row's own
 * label (spokenMailDate), so the date itself is not a separate stop.
 */
import { useEffect, useRef, useState } from "react";
import type React from "react";
import { Tooltip, Typography, type SxProps, type Theme } from "@mui/material";
import { mailDateDetail, readerMailDateParts } from "./readerTime";
import { mailDateTime } from "./MessageDate";

/** How long a tapped date keeps its detail open. */
export const TAP_DETAIL_MS = 4000;

const hoverNone = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(hover: none)").matches;

export interface MailListDateProps {
  timestamp: number | string | undefined | null;
  /** Unread: the theme's primary colour and a heavier weight. */
  emphasis?: boolean;
  /** Put before the detail, e.g. "Latest: " on a sender group, "Saved " on a draft. */
  detailPrefix?: string;
  /** The day above the time, right-aligned: a column beside two lines of text. */
  stacked?: boolean;
  /** A container or media query (`@container …`) in which a stacked date goes back on one line. */
  inlineFrom?: string;
  sx?: SxProps<Theme>;
}

const STACKED = {
  display: "inline-block",
  textAlign: "right",
  "& [data-date-day], & [data-date-time]": { display: "block" },
  // The day lines up with a row's first line (1rem text), the time with its second.
  "& [data-date-day]": { lineHeight: "1.3rem" },
  "& [data-date-time]": { lineHeight: "1.2rem" },
  "& [data-date-sep]": { display: "none" },
} as const;

const INLINE = {
  display: "inline",
  textAlign: "left",
  "& [data-date-day], & [data-date-time], & [data-date-sep]": { display: "inline", lineHeight: 1.3 },
} as const;

export function MailListDate({
  timestamp,
  emphasis = false,
  detailPrefix = "",
  stacked = false,
  inlineFrom,
  sx,
}: MailListDateProps) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const parts = readerMailDateParts(timestamp);
  const dateTime = mailDateTime(timestamp);
  if (!parts || !dateTime) return null;
  const touch = hoverNone();

  // On touch screens the tap is the date's own: it neither opens the row nor
  // starts the row's ripple. With a mouse the click goes on to the row.
  const onTap = (event: React.MouseEvent) => {
    if (!hoverNone()) return;
    event.stopPropagation();
    event.preventDefault();
    window.clearTimeout(timer.current);
    setOpen(previous => {
      if (!previous) timer.current = window.setTimeout(() => setOpen(false), TAP_DETAIL_MS);
      return !previous;
    });
  };
  const keepFromRow = (event: React.SyntheticEvent) => {
    if (hoverNone()) event.stopPropagation();
  };

  return (
    <Tooltip
      title={`${detailPrefix}${mailDateDetail(timestamp)}`}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      describeChild
      enterDelay={300}
      disableFocusListener
      disableTouchListener
      disableHoverListener={touch}
    >
      <Typography
        component="time"
        dateTime={dateTime}
        data-list-date=""
        onClick={onTap}
        onMouseDown={keepFromRow}
        onTouchStart={keepFromRow}
        sx={[
          {
            flexShrink: 0,
            fontSize: "0.875rem",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            fontWeight: emphasis ? 600 : 400,
            color: emphasis ? "primary.main" : "text.secondary",
            // A finger-sized target around the text, without moving it.
            "@media (hover: none)": { py: "10px", my: "-10px", px: "6px", mx: "-6px" },
          },
          stacked ? STACKED : INLINE,
          stacked && inlineFrom ? { [inlineFrom]: INLINE } : {},
          ...(sx === undefined ? [] : Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {/* textContent reads "Sun 2 Aug, 08:58" in both forms; the comma only shows on one line. */}
        <span data-date-day="">
          {parts.day}
          <span data-date-sep="">, </span>
        </span>
        <span data-date-time="">{parts.time}</span>
      </Typography>
    </Tooltip>
  );
}
