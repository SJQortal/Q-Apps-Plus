import { Skeleton } from '@mui/material';
import { useUser } from '../../state/user';
import { StatusCard } from './StatusCard';

/**
 * Shown at the top of pages that need an account: nothing when logged in,
 * a skeleton while logging in, and plain words outside Hub or on an error.
 */
export function UserStatusBanner() {
  const user = useUser();
  if (user.status === 'ready') return null;
  if (user.status === 'loading' || user.status === 'idle') {
    return <Skeleton variant="rounded" height={64} sx={{ borderRadius: 1 }} />;
  }
  if (user.status === 'unavailable') {
    return (
      <StatusCard title="Open this app in Qortal Hub or GO">
        Q-Mintership+ reads the boards and forum through your node. Outside Hub there is no node to ask.
      </StatusCard>
    );
  }
  return (
    <StatusCard title="Could not log in" tone="error" actionLabel="Retry" onAction={() => window.location.reload()}>
      {user.error || 'Hub did not return an account.'}
    </StatusCard>
  );
}
