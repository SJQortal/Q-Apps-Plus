/**
 * The widths of the rail and the message list, which the user can drag
 * (PaneResizer). The reading pane takes what is left.
 *
 * - Limits keep every pane usable: rail 180–360 px; list from 260 px up to
 *   60 % of the main area, and never so wide that the reading pane gets
 *   under 360 px.
 * - Saved per account in localStorage under `qmail_pane_widths_<address>`
 *   as JSON `{ rail?, list? }`; a pane without a saved width uses the
 *   layout's default. Only what the user set is stored: a narrower window
 *   clamps the width on screen, and the saved width comes back when the
 *   window grows again.
 * - Storage can be missing or throw (private window, preview): widths then
 *   live for the session only.
 */
import { useCallback, useState } from 'react';

export const PANE_LIMITS = {
  railMin: 180,
  railMax: 360,
  listMin: 260,
  /** Share of the main area (list + reading) the list may take. */
  listMaxShare: 0.6,
  readingMin: 360,
} as const;

/** Used for the list's upper bound while the main area is not measured yet. */
const UNMEASURED_LIST_MAX = 720;

export interface PaneWidths {
  rail?: number;
  list?: number;
}

export type PaneName = keyof PaneWidths;

export const paneWidthsKey = (address: string) => `qmail_pane_widths_${address}`;

const isWidth = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function clampRailWidth(width: number): number {
  return Math.round(Math.min(PANE_LIMITS.railMax, Math.max(PANE_LIMITS.railMin, width)));
}

/** The list's limits for a main area (list + reading) of `mainWidth` px; null when not measured. */
export function listWidthBounds(mainWidth: number | null): { min: number; max: number } {
  const min = PANE_LIMITS.listMin;
  if (!mainWidth || mainWidth <= 0) return { min, max: Math.max(min, UNMEASURED_LIST_MAX) };
  const max = Math.floor(Math.min(mainWidth * PANE_LIMITS.listMaxShare, mainWidth - PANE_LIMITS.readingMin));
  return { min, max: Math.max(min, max) };
}

export function clampListWidth(width: number, mainWidth: number | null): number {
  const { min, max } = listWidthBounds(mainWidth);
  return Math.round(Math.min(max, Math.max(min, width)));
}

export function readPaneWidths(address: string): PaneWidths {
  if (!address) return {};
  try {
    const raw = window.localStorage.getItem(paneWidthsKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const widths: PaneWidths = {};
    if (isWidth(parsed?.rail)) widths.rail = clampRailWidth(parsed.rail);
    if (isWidth(parsed?.list)) widths.list = Math.max(PANE_LIMITS.listMin, Math.round(parsed.list));
    return widths;
  } catch {
    return {};
  }
}

export function writePaneWidths(address: string, widths: PaneWidths): void {
  if (!address) return;
  try {
    const key = paneWidthsKey(address);
    if (widths.rail === undefined && widths.list === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, JSON.stringify(widths));
    }
  } catch {
    /* storage blocked: the widths last for this session */
  }
}

export interface PaneWidthsApi {
  widths: PaneWidths;
  /** Shows a width while dragging; nothing is saved. */
  preview: (pane: PaneName, width: number) => void;
  /** Sets and saves a width (drag end, keyboard). */
  commit: (pane: PaneName, width: number) => void;
  /** Back to the layout's default, and forgets the saved width. */
  reset: (pane: PaneName) => void;
}

/** Saved widths for `address` (empty: not saved, session only). */
export function usePaneWidths(address: string): PaneWidthsApi {
  const [state, setState] = useState(() => ({ address, widths: readPaneWidths(address) }));
  // Another account signed in: its own widths.
  let current = state;
  if (state.address !== address) {
    current = { address, widths: readPaneWidths(address) };
    setState(current);
  }

  const update = useCallback(
    (next: (widths: PaneWidths) => PaneWidths, persist: boolean) => {
      setState((previous) => {
        const widths = next(previous.widths);
        if (persist) writePaneWidths(previous.address, widths);
        return { address: previous.address, widths };
      });
    },
    []
  );

  const preview = useCallback(
    (pane: PaneName, width: number) => update((w) => ({ ...w, [pane]: Math.round(width) }), false),
    [update]
  );
  const commit = useCallback(
    (pane: PaneName, width: number) => update((w) => ({ ...w, [pane]: Math.round(width) }), true),
    [update]
  );
  const reset = useCallback(
    (pane: PaneName) =>
      update((w) => {
        const next = { ...w };
        delete next[pane];
        return next;
      }, true),
    [update]
  );

  return { widths: current.widths, preview, commit, reset };
}
