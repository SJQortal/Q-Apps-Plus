/**
 * The Activity chart: an account's transactions as bars over time, one per
 * period (rules/explorer/activity.ts), each stacked by family in its
 * colour (txFamilyAccent), from when it was first seen to now. Periods not
 * read yet are hatched, never shown as quiet. Its milestones stand across
 * it as coloured lines with a flag (joined MINTER, a name registered, …).
 *
 * - Pointing at a bar shows one card with that period's counts; a click
 *   (or a tap) picks it, and the section lists its transactions.
 * - Keys: the chart takes focus; ← → move between periods (the period is
 *   read out), Home and End go to the ends, Enter or Space picks it.
 * - Zoom: the buttons, or Ctrl/⌘ + wheel at the pointer; scroll (or
 *   Shift + wheel, or a swipe) pans.
 * - A milestone's flag opens what it marks; the milestones are also listed
 *   under the chart as links (ActivitySection), the way keyboards, screen
 *   readers and fingers reach them.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined';
import FitScreenOutlinedIcon from '@mui/icons-material/FitScreenOutlined';
import { markAccent } from '../../../../components/explorer/activityColours';
import { txFamilyAccent } from '../../../../components/explorer/txFamilyAccent';
import type { TxRow } from '../../../../data/types';
import {
  ACTIVITY_FAMILIES,
  activityBuckets,
  axisTicks,
  type ActivityBucket,
  type ActivityFamily,
} from '../../../../rules/explorer/activity';
import { formatCount, formatDate, formatDateTime, plural } from '../../../../utils/format';
import { FAMILY_LABEL, periodWords, bucketWords, type PlacedMark } from './activityWords';

const DAY = 86_400_000;
/** About one bar every this many px. */
const BAR_PX = 10;
const MIN_BARS = 24;
const MAX_BARS = 600;
const MAX_ZOOM = 60;
/** The flags' row above the bars, and the axis under them (px). */
const FLAG_ROW = 22;
const AXIS_ROW = 26;

export function ActivityChart({
  rows,
  from,
  to,
  readFrom,
  hidden,
  marks,
  height,
  selected,
  onSelect,
  label,
}: {
  rows: readonly TxRow[];
  /** When the chart starts (its first transaction, or when it was first seen) and ends (now). */
  from: number;
  to: number;
  /** The oldest transaction read, when older ones exist: before it is unread. */
  readFrom: number | null;
  hidden: ReadonlySet<ActivityFamily>;
  marks: readonly PlacedMark[];
  /** The bars' height, px. */
  height: number;
  /** The period picked, by its start. */
  selected: number | null;
  onSelect: (bucket: ActivityBucket) => void;
  /** Whose activity, for the chart's name. */
  label: string;
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const [viewport, setViewport] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<{ i: number; x: number; width: number } | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewport(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const inner = Math.max(viewport, Math.round(viewport * zoom));
  const count = Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(inner / BAR_PX) || MIN_BARS));
  const buckets = useMemo(
    () => activityBuckets(rows, { from, to, count, readFrom, hidden }),
    [rows, from, to, count, readFrom, hidden]
  );
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const ticks = useMemo(() => axisTicks(from, to, inner), [from, to, inner]);
  const span = Math.max(1, to - from);
  const pct = (ts: number) => Math.max(0, Math.min(100, ((ts - from) / span) * 100));
  const longSpan = span > 400 * DAY;
  const tickWords = (ts: number) =>
    span / Math.max(1, ticks.length - 1) < DAY
      ? formatDateTime(ts)
      : longSpan
        ? new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        : formatDate(ts);

  // Keep the point under the pointer (or the middle) in place as the zoom changes.
  useLayoutEffect(() => {
    if (pendingScroll.current !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [inner]);

  const zoomAt = (factor: number, clientX?: number) => {
    const el = scrollRef.current;
    setZoom((previous) => {
      const next = Math.max(1, Math.min(MAX_ZOOM, previous * factor));
      if (el && viewport > 0 && next !== previous) {
        const rect = el.getBoundingClientRect();
        const offset = (clientX ?? rect.left + rect.width / 2) - rect.left;
        const share = (el.scrollLeft + offset) / Math.max(viewport, viewport * previous);
        pendingScroll.current = Math.max(0, share * Math.max(viewport, viewport * next) - offset);
      }
      return next;
    });
  };

  // Ctrl/⌘ + wheel zooms at the pointer; Shift + wheel pans (a native, non-passive listener).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        zoomAt(event.deltaY < 0 ? 1.2 : 1 / 1.2, event.clientX);
      } else if (event.shiftKey) {
        event.preventDefault();
        el.scrollLeft += event.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport]);

  const indexAt = (clientX: number) => {
    const el = scrollRef.current;
    if (!el || !inner) return null;
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft;
    return Math.max(0, Math.min(count - 1, Math.floor((x / inner) * count)));
  };

  /** Brings a period into view after a key moved to it. */
  const reveal = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const left = (i / count) * inner;
    const right = ((i + 1) / count) * inner;
    if (left < el.scrollLeft) el.scrollLeft = left - 8;
    else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth + 8;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = count - 1;
    const current =
      focusIndex ?? (selected !== null ? buckets.findIndex((b) => b.start === selected) : last);
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = Math.max(0, current - 1);
    else if (event.key === 'ArrowRight') next = Math.min(last, current + 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (current >= 0 && !buckets[current].unread) onSelect(buckets[current]);
      return;
    } else return;
    event.preventDefault();
    setFocusIndex(next);
    reveal(next);
  };

  const hovered = hover ? buckets[hover.i] : null;
  const focused = focusIndex !== null ? buckets[focusIndex] : null;
  const hatch = `repeating-linear-gradient(135deg, ${alpha(theme.palette.text.primary, 0.1)} 0 4px, transparent 4px 9px)`;

  return (
    <Box ref={frameRef} sx={{ position: 'relative', minWidth: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mb: 0.5 }}>
        <Tooltip title="Zoom out">
          <span>
            <IconButton
              aria-label="Zoom out"
              onClick={() => zoomAt(1 / 1.6)}
              disabled={zoom <= 1}
              sx={{ width: 44, height: 44 }}
            >
              <RemoveOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: 'center', minWidth: 52, textAlign: 'center' }}
          aria-live="polite"
        >
          {zoom < 1.05 ? 'All of it' : `${zoom.toFixed(1)}×`}
        </Typography>
        <Tooltip title="Zoom in">
          <span>
            <IconButton
              aria-label="Zoom in"
              onClick={() => zoomAt(1.6)}
              disabled={zoom >= MAX_ZOOM}
              sx={{ width: 44, height: 44 }}
            >
              <AddOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Show all of it">
          <span>
            <IconButton
              aria-label="Show all of it"
              onClick={() => {
                pendingScroll.current = 0;
                setZoom(1);
              }}
              disabled={zoom <= 1}
              sx={{ width: 44, height: 44 }}
            >
              <FitScreenOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box
        ref={scrollRef}
        sx={{ overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain' }}
        onScroll={() => setHover(null)}
      >
        <Box
          sx={{
            position: 'relative',
            width: inner || '100%',
            height: FLAG_ROW + height + AXIS_ROW,
            // A flag at either end mustn't widen the chart (no scrollbar at All of it).
            overflowX: 'clip',
          }}
        >
          {/* The bars: one per period, stacked by family; a hatch where nothing was read yet. */}
          <Box
            role="group"
            tabIndex={0}
            // Pressed and moved over to read its bars: not a swipe to the next tab.
            data-no-swipe=""
            aria-label={`${label}'s activity over time. Use the arrow keys to move between periods, Enter to list one.`}
            onKeyDown={onKeyDown}
            onBlur={() => setFocusIndex(null)}
            onPointerMove={(event) => {
              const i = indexAt(event.clientX);
              const frame = frameRef.current?.getBoundingClientRect();
              if (i !== null && frame)
                setHover({ i, x: event.clientX - frame.left, width: frame.width });
            }}
            onPointerLeave={() => setHover(null)}
            onClick={(event) => {
              const i = indexAt(event.clientX);
              if (i !== null && !buckets[i].unread) onSelect(buckets[i]);
            }}
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: FLAG_ROW,
              height,
              display: 'flex',
              alignItems: 'stretch',
              gap: count > 300 ? 0 : '1px',
              cursor: 'pointer',
              borderBottom: 1,
              borderColor: 'divider',
              outline: 'none',
              '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            {buckets.map((bucket, i) => {
              const isSelected = selected !== null && bucket.start === selected;
              const isFocused = focusIndex === i;
              return (
                <Box
                  key={i}
                  sx={{
                    flex: '1 1 0',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    borderRadius: '2px 2px 0 0',
                    ...(bucket.unread ? { background: hatch } : {}),
                    ...(isSelected || isFocused
                      ? { bgcolor: alpha(theme.palette.primary.main, isSelected ? 0.18 : 0.1) }
                      : hover?.i === i
                        ? { bgcolor: 'action.hover' }
                        : {}),
                    ...(isFocused ? { outline: 2, outlineColor: 'primary.main' } : {}),
                  }}
                >
                  {bucket.unread
                    ? null
                    : ACTIVITY_FAMILIES.map((family) => {
                        const n = bucket.byFamily[family];
                        if (!n) return null;
                        return (
                          <Box
                            key={family}
                            sx={{
                              height: `${(n / max) * 100}%`,
                              minHeight: 2,
                              bgcolor: txFamilyAccent(theme, family),
                            }}
                          />
                        );
                      })}
                </Box>
              );
            })}
          </Box>

          {/* Milestones: a line across the bars, with a flag above them. */}
          {marks.map((mark) => {
            const left = pct(mark.at);
            const colour = markAccent(theme, mark.kind);
            return (
              <Box
                key={mark.key}
                aria-hidden
                sx={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: 0,
                  height: FLAG_ROW + height,
                  translate: '-1px 0',
                  pointerEvents: 'none',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: FLAG_ROW - 4,
                    bottom: 0,
                    width: 2,
                    bgcolor: colour,
                    opacity: 0.85,
                  }}
                />
                <Tooltip title={`${mark.label}: ${formatDate(mark.at)}`}>
                  <Box
                    onClick={() => navigate(mark.to)}
                    sx={{
                      position: 'absolute',
                      top: 2,
                      left: -6,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: colour,
                      boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      transition: 'scale 120ms ease',
                      '&:hover': { scale: '1.3' },
                    }}
                  />
                </Tooltip>
              </Box>
            );
          })}

          {/* The dates under the bars. */}
          <Box
            aria-hidden
            sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: AXIS_ROW }}
          >
            {ticks.map((ts, i) => (
              <Typography
                key={i}
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{
                  position: 'absolute',
                  top: 4,
                  left: `${pct(ts)}%`,
                  translate: i === 0 ? '0 0' : i === ticks.length - 1 ? '-100% 0' : '-50% 0',
                  whiteSpace: 'nowrap',
                }}
              >
                {tickWords(ts)}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {/* One card for the period under the pointer. */}
      {hovered && hover ? (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 44 + FLAG_ROW,
            left: hover.x,
            translate: hover.x > hover.width / 2 ? 'calc(-100% - 12px) 0' : '12px 0',
            zIndex: 3,
            pointerEvents: 'none',
            minWidth: 180,
            maxWidth: 260,
            p: 1.25,
            borderRadius: 1,
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 6,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {periodWords(hovered)}
          </Typography>
          {hovered.unread ? (
            <Typography variant="body2" color="text.secondary">
              Not read yet: read further back to see this period.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                {plural(hovered.total, 'transaction')}
              </Typography>
              {ACTIVITY_FAMILIES.filter((f) => hovered.byFamily[f]).map((family) => (
                <Box key={family} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '2px',
                      bgcolor: txFamilyAccent(theme, family),
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {FAMILY_LABEL[family]}
                  </Typography>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatCount(hovered.byFamily[family] ?? 0)}
                  </Typography>
                </Box>
              ))}
              {hovered.total ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Click to list them
                </Typography>
              ) : null}
            </>
          )}
        </Box>
      ) : null}

      {/* What the keys moved to, read out. */}
      <Box role="status" sx={visuallyHidden}>
        {focused ? bucketWords(focused) : ''}
      </Box>
    </Box>
  );
}
