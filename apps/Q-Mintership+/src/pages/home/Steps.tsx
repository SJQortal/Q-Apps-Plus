/** A numbered list of plain steps, for help dialogs and "How it works". */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

export function StepList({ children, label }: { children: ReactNode; label: string }) {
  return (
    <Box
      component="ol"
      aria-label={label}
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {children}
    </Box>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Box component="li" sx={{ display: 'flex', gap: 1.5 }}>
      <Box
        aria-hidden
        sx={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: 14,
          border: 1,
          borderColor: 'divider',
        }}
      >
        {n}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ typography: 'body2', color: 'text.secondary', overflowWrap: 'anywhere' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
