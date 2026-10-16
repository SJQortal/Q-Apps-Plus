/**
 * How this account is linked to other accounts. A placeholder until this tab is built.
 */
import { Typography } from '@mui/material';

export interface ConnectionsTabProps {
  address: string;
}

export default function ConnectionsTab({ address }: ConnectionsTabProps) {
  return (
    <Typography color="text.secondary" role="status" data-address={address}>
      Coming in this update
    </Typography>
  );
}
