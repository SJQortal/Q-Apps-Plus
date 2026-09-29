import React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';

interface PageLoaderProps {
  size?: number
  thickness?: number
}

/** A translucent overlay with a spinner, sized to the Hub/GO frame. */
const PageLoader: React.FC<PageLoaderProps> = ({
  size = 40,
  thickness = 5
}) => {
  const theme = useTheme()

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label="Loading"
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'fixed',
        inset: 0,
        height: 'var(--qshare-app-height, 100dvh)',
        width: '100%',
        backgroundColor: alpha(theme.palette.background.default, 0.6),
        zIndex: theme.zIndex.modal - 1
      }}
    >
      <CircularProgress
        size={size}
        thickness={thickness}
        sx={{
          color: theme.palette.primary.main
        }}
      />
    </Box>
  )
}

export default PageLoader;
