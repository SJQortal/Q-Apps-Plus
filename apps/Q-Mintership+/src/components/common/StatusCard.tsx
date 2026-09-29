import type { ReactNode } from 'react';
import { Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
}));

interface StatusCardProps {
  title: string;
  children?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'info' | 'error';
}

/** One plain-words state card: empty, error or "not available here". */
export function StatusCard({ title, children, actionLabel, onAction, tone = 'info' }: StatusCardProps) {
  return (
    <Card role={tone === 'error' ? 'alert' : undefined}>
      <Typography sx={{ fontWeight: 700, fontSize: 17 }} color={tone === 'error' ? 'error' : 'text.primary'}>
        {title}
      </Typography>
      {children ? (
        <Typography variant="body2" color="text.secondary">
          {children}
        </Typography>
      ) : null}
      {actionLabel && onAction ? (
        <Button variant="outlined" size="small" onClick={onAction} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
