import * as React from 'react'
import LinearProgress, {
  LinearProgressProps
} from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material'

interface LoaderBarProps {
  message: string
}
export const LoaderBar = ({ message }: LoaderBarProps) => {
  const theme = useTheme()
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: 1500,
        width: '250px',
        backgroundColor: theme.palette.background.paper,
        borderRadius: '5px',
        padding: '5px'
      }}
    >
      <Box sx={{ width: '100%', mr: 1 }}>
        <LinearProgress color="secondary" />
      </Box>
      <Box sx={{ minWidth: 35 }}>
        <Typography variant="body2">{message}</Typography>
      </Box>
    </Box>
  )
}
