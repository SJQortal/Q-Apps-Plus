import { useMediaQuery, useTheme } from '@mui/material';

/** True below 600 px: phones, GO, and narrow Hub panes (docs/DESIGN.md). */
export function usePhoneLayout(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

/** True below 900 px: the rail collapses to icons only. */
export function useCompactRail(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}
