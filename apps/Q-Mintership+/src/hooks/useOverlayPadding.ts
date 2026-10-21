/**
 * Room for what sits over the page's edges, so a control that receives
 * focus is never hidden under them (WCAG 2.4.11). index.css turns these
 * into `scroll-padding` on <html>, which Chromium (Hub, GO) uses both to
 * decide whether a focused element is in view and where to scroll it:
 *
 *   --qmp-header-height  the sticky page header (PageHeader)
 *   --qmp-bottom-nav     the phone's bottom bar while it is on screen (AppShell)
 *   --qmp-bottom-bar     a page's own sticky bar: "Sign several", Nominate's submit bar
 */
import { useLayoutEffect } from 'react';

export const HEADER_HEIGHT_VAR = '--qmp-header-height';
export const BOTTOM_NAV_VAR = '--qmp-bottom-nav';
export const BOTTOM_BAR_VAR = '--qmp-bottom-bar';

/**
 * Publish the height of `el` (plus `gap`, its distance from the edge) as
 * `variable` while it is mounted and `enabled`, following its size. Pass
 * the element from a callback ref (useState), so a bar that mounts later
 * is picked up.
 */
export function usePublishOverlay(
  el: HTMLElement | null,
  variable: string,
  { enabled = true, gap = 0 }: { enabled?: boolean; gap?: number } = {}
): void {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    if (!el || !enabled) {
      root.removeProperty(variable);
      return;
    }
    const publish = () => root.setProperty(variable, `${el.offsetHeight + gap}px`);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      root.removeProperty(variable);
    };
  }, [el, variable, enabled, gap]);
}

/** Publish a fixed value (the bottom bar's known height) while `value` is set. */
export function usePublishOffset(variable: string, value: string | null): void {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    if (value === null) {
      root.removeProperty(variable);
      return;
    }
    root.setProperty(variable, value);
    return () => {
      root.removeProperty(variable);
    };
  }, [variable, value]);
}
