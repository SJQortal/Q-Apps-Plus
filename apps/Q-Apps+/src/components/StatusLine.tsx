import { Skeleton, Typography } from '@mui/material';
import type { AppResource } from '../qortal/appResources';
import type { AppResourcesStatus } from '../hooks/useAppResources';
import { formatBytes, timeAgo } from '../utils/format';

interface StatusLineProps {
  status: AppResourcesStatus;
  resource?: AppResource;
  now?: number;
}

/** One line under an app name: when it was last published and how big it is. */
export function StatusLine({ status, resource, now }: StatusLineProps) {
  if (status === 'loading') return <Skeleton width={150} height={18} data-testid="status-skeleton" />;
  let text: string;
  if (status === 'offline') text = 'Live details need Hub or GO';
  else if (status === 'error') text = 'Details unavailable';
  else if (!resource) text = 'Not on QDN yet';
  else {
    const parts = [`Updated ${timeAgo(resource.updated, now)}`];
    const size = formatBytes(resource.size);
    if (size) parts.push(size);
    text = parts.join(' · ');
  }
  return (
    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
      {text}
    </Typography>
  );
}
