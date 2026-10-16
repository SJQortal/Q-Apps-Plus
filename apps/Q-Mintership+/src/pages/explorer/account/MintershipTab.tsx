/**
 * This account's MINTER story and records. A placeholder until this tab is built.
 */
import { Typography } from '@mui/material';

export interface MintershipTabProps {
  address: string;
}

export default function MintershipTab({ address }: MintershipTabProps) {
  return (
    <Typography color="text.secondary" role="status" data-address={address}>
      Coming in this update
    </Typography>
  );
}
