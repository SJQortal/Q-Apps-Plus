import { useMediaQuery } from '@mui/material';

/**
 * The three layouts of the mail shell (docs/DESIGN.md → Layout, Mobile):
 * - phone   (< 600 px): one pane at a time, bottom navigation, floating Compose.
 *                       Hub often shows apps in a pane this narrow, so this is
 *                       the layout for small Hub windows too, whatever the device.
 * - medium  (600–899):  message list + reading pane; the rail lives in a drawer.
 * - desktop (≥ 900):    rail + list + reading pane.
 */
export type LayoutMode = 'phone' | 'medium' | 'desktop';

export const PHONE_MAX_WIDTH = 600;
export const DESKTOP_MIN_WIDTH = 900;

export function layoutModeForWidth(width: number): LayoutMode {
  if (width < PHONE_MAX_WIDTH) return 'phone';
  if (width < DESKTOP_MIN_WIDTH) return 'medium';
  return 'desktop';
}

export function useLayoutMode(): LayoutMode {
  const isPhone = useMediaQuery(`(max-width:${PHONE_MAX_WIDTH - 0.05}px)`);
  const isDesktop = useMediaQuery(`(min-width:${DESKTOP_MIN_WIDTH}px)`);
  if (isPhone) return 'phone';
  if (isDesktop) return 'desktop';
  return 'medium';
}
