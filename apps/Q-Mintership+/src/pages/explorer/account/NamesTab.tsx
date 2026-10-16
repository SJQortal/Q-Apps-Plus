/**
 * Every name this account owns. A placeholder until this tab is built.
 */
import { Typography } from '@mui/material';

export interface NamesTabProps {
  address: string;
}

export default function NamesTab({ address }: NamesTabProps) {
  return (
    <Typography color="text.secondary" role="status" data-address={address}>
      Coming in this update
    </Typography>
  );
}
