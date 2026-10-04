/**
 * The draggable border between two panes (rail | list, list | reading).
 *
 * - An 8 px hit area over the border, a grip that shows on hover, focus and
 *   while dragging;
 * - a window splitter for assistive tech: role="separator",
 *   aria-orientation="vertical", aria-valuenow/min/max in px;
 * - keyboard: ←/→ by 16 px (Shift: 64 px), End to the widest, Home or a
 *   double-click back to the default;
 * - pointer events with capture, so a fast drag never loses the handle,
 *   and no text selection while dragging.
 *
 * The pane to the left of the handle is the one that changes width.
 */
import React, { useEffect, useRef, useState } from 'react';
import { styled } from '@mui/material/styles';

export const RESIZE_STEP = 16;
export const RESIZE_BIG_STEP = 64;

const Handle = styled('div')(({ theme }) => ({
  position: 'relative',
  flex: '0 0 8px',
  width: 8,
  // Overlaps the border it sits on, so it takes no room from the panes.
  margin: '0 -4px',
  zIndex: 3,
  cursor: 'col-resize',
  touchAction: 'none',
  outline: 'none',
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 3,
    width: 2,
    backgroundColor: 'transparent',
    transition: 'background-color 120ms ease',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: 1,
    width: 6,
    height: 40,
    marginTop: -20,
    borderRadius: 3,
    backgroundColor: 'transparent',
    transition: 'background-color 120ms ease',
  },
  '&:hover::after, &:focus-visible::after, &[data-dragging="true"]::after': {
    backgroundColor: theme.palette.primary.main,
  },
  '&:hover::before, &:focus-visible::before, &[data-dragging="true"]::before': {
    backgroundColor: theme.palette.primary.main,
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&::after, &::before': { transition: 'none' },
  },
}));

export interface PaneResizerProps {
  /** Accessible name, e.g. "Resize the message list". */
  label: string;
  value: number;
  min: number;
  max: number;
  /** While dragging: the new width (not saved yet). */
  onChange: (value: number) => void;
  /** Drag end or a key: the width to keep. */
  onCommit: (value: number) => void;
  /** Home or a double-click: back to the default width. */
  onReset: () => void;
  /** Id of the pane this handle sizes. */
  controls?: string;
}

export const clampWidth = (value: number, min: number, max: number) =>
  Math.round(Math.min(max, Math.max(min, value)));

export function PaneResizer({ label, value, min, max, onChange, onCommit, onReset, controls }: PaneResizerProps) {
  const dragRef = useRef<{ pointerId: number; startX: number; startValue: number; last: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // No text selection and a resize cursor everywhere while dragging.
  useEffect(() => {
    if (!dragging) return;
    const style = document.body.style;
    const previous = { userSelect: style.userSelect, cursor: style.cursor };
    style.userSelect = 'none';
    style.cursor = 'col-resize';
    return () => {
      style.userSelect = previous.userSelect;
      style.cursor = previous.cursor;
    };
  }, [dragging]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety: the drag still works without it */
    }
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startValue: value, last: value };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const next = clampWidth(drag.startValue + event.clientX - drag.startX, min, max);
    if (next === drag.last) return;
    drag.last = next;
    onChange(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      /* already released */
    }
    if (drag.last !== drag.startValue) onCommit(drag.last);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? RESIZE_BIG_STEP : RESIZE_STEP;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = value - step;
    else if (event.key === 'ArrowRight') next = value + step;
    else if (event.key === 'End') next = max;
    else if (event.key === 'Home') {
      event.preventDefault();
      onReset();
      return;
    }
    if (next === null) return;
    event.preventDefault();
    const clamped = clampWidth(next, min, max);
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <Handle
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(max)}
      title={`${label} (double-click to reset)`}
      data-dragging={dragging ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
