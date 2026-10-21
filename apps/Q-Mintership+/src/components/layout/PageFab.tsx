/**
 * A page's main action on a phone (docs/DESIGN.md → Mobile: a floating main
 * action, never in landscape): a round button 16 px above the bottom bar,
 * its icon only, named for screen readers and shown as a tooltip. Pages
 * leave it out while the keyboard is open or the frame is short, and keep
 * FabClearance under their last card so it never covers it.
 */
import type { ReactNode, Ref } from 'react';
import { Box, Fab, Tooltip, type FabProps } from '@mui/material';
import { BOTTOM_NAV_HEIGHT } from './BottomNav';

/** The floating button (56 px, 16 px above the bar) plus a margin. */
export const FAB_CLEARANCE = 88;

export function PageFab({
  label,
  icon,
  ref,
  ...props
}: Omit<FabProps, 'children' | 'color' | 'sx'> & {
  label: string;
  icon: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <Tooltip title={label}>
      <Fab
        ref={ref}
        color="primary"
        aria-label={label}
        {...props}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: `calc(${BOTTOM_NAV_HEIGHT + 16}px + var(--qp-safe-bottom))`,
          zIndex: (theme) => theme.zIndex.speedDial,
        }}
      >
        {icon}
      </Fab>
    </Tooltip>
  );
}

/** Room under a page's last card, so its floating button never covers it. */
export function FabClearance() {
  return <Box aria-hidden sx={{ height: FAB_CLEARANCE, flexShrink: 0 }} />;
}
