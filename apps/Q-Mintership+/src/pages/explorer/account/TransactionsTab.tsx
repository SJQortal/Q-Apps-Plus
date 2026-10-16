/**
 * This account's transactions. A placeholder until this tab is built.
 */
import { Typography } from '@mui/material';

export interface TransactionsTabProps {
  address: string;
}

export default function TransactionsTab({ address }: TransactionsTabProps) {
  return (
    <Typography color="text.secondary" role="status" data-address={address}>
      Coming in this update
    </Typography>
  );
}
