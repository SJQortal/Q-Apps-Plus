import type { ReactNode } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

/** The card that holds a virtualised list; it fills the column under the header. */
export const ListCard = styled('div')(({ theme }) => ({
  flex: 1,
  minHeight: 320,
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

export const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 64,
  padding: theme.spacing(1.25, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  transition: 'background-color 160ms ease',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 1.5),
  },
}));

export const RowMain = styled('div')({ flex: 1, minWidth: 0 });

export const RowTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: 15,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
});

export const RowMeta = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 13,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
}));

export const RowActions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  flexShrink: 0,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}));

export function RowSkeletons({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, i) => (
        <Row key={i}>
          <Skeleton variant="circular" width={40} height={40} />
          <RowMain>
            <Skeleton width="45%" height={20} />
            <Skeleton width="30%" height={16} />
          </RowMain>
          <Skeleton variant="rounded" width={72} height={30} />
        </Row>
      ))}
    </div>
  );
}

const Centre = styled('div')(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(5, 3),
  color: theme.palette.text.secondary,
}));

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Centre>
      {icon ? <Box sx={{ '& svg': { fontSize: 40, opacity: 0.5 } }}>{icon}</Box> : null}
      <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{title}</Typography>
      {hint ? <Typography variant="body2">{hint}</Typography> : null}
      {action ? <Box sx={{ mt: 1 }}>{action}</Box> : null}
    </Centre>
  );
}

export function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry?: () => void;
}) {
  return (
    <Centre role="alert">
      <ErrorOutlineOutlinedIcon sx={{ fontSize: 40, opacity: 0.6 }} />
      <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{message}</Typography>
      {onRetry ? (
        <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
          {retryLabel}
        </Button>
      ) : null}
    </Centre>
  );
}
