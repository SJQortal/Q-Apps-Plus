/**
 * Loading, empty, error and "fetching from peers" states shared by every
 * screen (docs/DESIGN.md → Components and states).
 */
import type { ReactNode } from 'react';
import { Box, Button, LinearProgress, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';

const Centered = styled('div')(({ theme }) => ({
  width: '100%',
  minHeight: 220,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(4, 3),
  color: theme.palette.text.secondary,
}));

const IconWrap = styled('div')(({ theme }) => ({
  color: theme.palette.text.secondary,
  opacity: 0.7,
  marginBottom: theme.spacing(0.5),
  '& svg': { fontSize: 40 },
}));

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Box role="status" aria-label="Loading" sx={{ width: '100%', px: 2, py: 1 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', py: 1.25 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton width="45%" height={18} />
            <Skeleton width="80%" height={16} />
          </Box>
          <Skeleton width={48} height={14} />
        </Box>
      ))}
    </Box>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, hint, action }: EmptyStateProps) {
  return (
    <Centered>
      {icon && <IconWrap aria-hidden>{icon}</IconWrap>}
      <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
      {hint && <Typography variant="body2">{hint}</Typography>}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Centered>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <Centered role="alert">
      <Typography sx={{ fontWeight: 600, color: 'error.main' }}>{title}</Typography>
      {message && <Typography variant="body2">{message}</Typography>}
      {onRetry && (
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry} sx={{ mt: 1 }}>
          Retry
        </Button>
      )}
    </Centered>
  );
}

interface FetchingFromPeersProps {
  /** QDN status, e.g. DOWNLOADING, BUILDING, REFETCHING, MISSING_DATA. */
  status?: string;
  percentLoaded?: number;
  onRetry?: () => void;
  compact?: boolean;
}

export function fetchingLabel(status?: string): string {
  switch ((status || '').toUpperCase()) {
    case 'DOWNLOADED':
    case 'BUILDING':
      return 'Preparing…';
    case 'REFETCHING':
      return 'Refetching from peers…';
    case 'MISSING_DATA':
      return 'Not enough peers have this yet';
    case 'FAILED':
      return 'Download failed';
    default:
      return 'Fetching from peers…';
  }
}

export function FetchingFromPeers({ status, percentLoaded, onRetry, compact }: FetchingFromPeersProps) {
  const label = fetchingLabel(status);
  const failed = status === 'MISSING_DATA' || status === 'FAILED';
  const hasPercent = typeof percentLoaded === 'number' && Number.isFinite(percentLoaded) && percentLoaded > 0;
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, p: compact ? 1 : 2 }}
    >
      <Typography variant="body2" color={failed ? 'error.main' : 'text.secondary'}>
        {label}
        {hasPercent ? ` ${Math.min(100, Math.round(percentLoaded))}%` : ''}
      </Typography>
      {!failed && (
        <LinearProgress
          variant={hasPercent ? 'determinate' : 'indeterminate'}
          value={hasPercent ? Math.min(100, percentLoaded) : undefined}
          sx={{ borderRadius: 2 }}
        />
      )}
      {failed && onRetry && (
        <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={onRetry} sx={{ alignSelf: 'flex-start' }}>
          Retry
        </Button>
      )}
    </Box>
  );
}

export function LoadingBanner({ text }: { text: string }) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={(theme) => ({
        flexShrink: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 0.75 }}>
        {text}
      </Typography>
      <LinearProgress sx={{ height: 3 }} />
    </Box>
  );
}
