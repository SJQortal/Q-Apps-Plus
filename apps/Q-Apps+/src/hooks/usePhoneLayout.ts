import { useMediaQuery, useTheme } from '@mui/material';

/** Below 600 px: phones in GO and narrow Hub panes (docs/DESIGN.md). */
export function usePhoneLayout(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}
