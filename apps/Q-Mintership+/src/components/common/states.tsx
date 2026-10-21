/**
 * Loading, empty and error states (docs/DESIGN.md → Components and states):
 * skeletons shaped like the content, one plain line about why a view is
 * empty plus the next action, and errors in plain words with Retry. Each
 * fades in as it appears (index.css → .qmp-fade).
 */
import type { MouseEvent, ReactNode } from 'react';
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { friendlyError } from '../../utils/friendlyError';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  actionLabel?: string;
  /** Gets the click, so a dialog it opens can give focus back to this button. */
  onAction?: (event: MouseEvent<HTMLButtonElement>) => void;
  icon?: ReactNode;
  /** Plain (no card border), for use inside a card. */
  plain?: boolean;
}

/** One-line explanation of an empty view, plus the next action. */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  plain,
}: EmptyStateProps) {
  return (
    <Box
      role="status"
      className="qmp-fade"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
        px: 2,
        py: plain ? 3 : 5,
        ...(plain
          ? {}
          : { border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }),
        color: 'text.secondary',
      }}
    >
      <Box aria-hidden sx={{ color: 'text.secondary', '& svg': { fontSize: 40 } }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>{title}</Typography>
      {description ? (
        <Typography variant="body2" sx={{ maxWidth: 480 }}>
          {description}
        </Typography>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="outlined" onClick={onAction} sx={{ mt: 1, minHeight: 44 }}>
          {actionLabel}
        </Button>
      ) : null}
    </Box>
  );
}

interface ErrorStateProps {
  /** What failed, in plain words ("Couldn't load the decisions."). */
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

/** A failed load: what failed, why if Core said so, and Retry. Never a stack trace. */
export function ErrorState({
  title = "Couldn't load this.",
  error,
  onRetry,
  compact,
}: ErrorStateProps) {
  const detail = error ? friendlyError(error) : '';
  if (compact) {
    return (
      <Alert
        severity="error"
        variant="outlined"
        className="qmp-fade"
        action={
          onRetry ? (
            <Button color="inherit" onClick={onRetry} sx={{ minHeight: 44 }}>
              Retry
            </Button>
          ) : undefined
        }
      >
        {title}
        {detail ? ` ${detail}` : ''}
      </Alert>
    );
  }
  return (
    <EmptyState
      icon={<ErrorOutlineOutlinedIcon />}
      title={title}
      description={detail || 'Check that your node is running and synced, then try again.'}
      actionLabel={onRetry ? 'Retry' : undefined}
      onAction={onRetry}
    />
  );
}

/** Shown when a bounded read stopped before the end, so a cap is never silent. */
export function TruncatedNote({ what }: { what: string }) {
  return (
    <Typography variant="body2" color="text.secondary" role="note" sx={{ px: 0.5 }}>
      Showing the first part of {what}: there were more than this screen reads at once.
    </Typography>
  );
}

/** A card-shaped placeholder: avatar, two lines and an action row. */
export function CardSkeleton({ lines = 2, ring = false }: { lines?: number; ring?: boolean }) {
  return (
    <Box
      aria-hidden
      sx={{
        p: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        display: 'flex',
        gap: 2,
      }}
    >
      <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="55%" sx={{ fontSize: 18 }} />
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} variant="text" width={i === lines - 1 ? '70%' : '95%'} />
        ))}
      </Box>
      {ring ? <Skeleton variant="circular" width={56} height={56} sx={{ flexShrink: 0 }} /> : null}
    </Box>
  );
}

/** A list of card skeletons, announced once as loading. */
export function ListSkeleton({
  count = 3,
  ring = false,
  label = 'Loading',
}: {
  count?: number;
  ring?: boolean;
  label?: string;
}) {
  return (
    <Box
      role="status"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} ring={ring} />
      ))}
    </Box>
  );
}

/** The status hero's placeholder on Home. */
export function HeroSkeleton() {
  return (
    <Box
      role="status"
      aria-label="Loading your status"
      sx={{
        p: { xs: 2, sm: 3 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Skeleton variant="text" width="40%" sx={{ fontSize: 14 }} />
      <Skeleton variant="text" width="80%" sx={{ fontSize: 28 }} />
      <Skeleton variant="text" width="95%" />
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="rounded" width={180} height={44} sx={{ mt: 2 }} />
    </Box>
  );
}
