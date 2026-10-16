/**
 * An account's transactions: a filter by family (chips; one picker on
 * phones), what it sent that waits for a block (when any), then its
 * confirmed transactions of that family, newest first, 50 at a time
 * (transactions/AccountTxList.tsx). Each row opens to its details and
 * links on to the accounts involved and the transaction's own page.
 *
 * Every read is the Explorer's own and none polls; an AT (automated
 * contract) has no public key, so it has no waiting list.
 */
import { useState } from 'react';
import { Box } from '@mui/material';
import { isAtAddress } from '../../../data/explorer/account';
import { useAccount } from '../../../hooks/useData';
import { usePhoneLayout } from '../../../hooks/usePhoneLayout';
import type { TxFamilyKey } from '../../../rules/explorer/txFamilies';
import { AccountTxList } from './transactions/AccountTxList';
import { FamilyFilter } from './transactions/FamilyFilter';
import { WaitingSection } from './transactions/WaitingSection';

export interface TransactionsTabProps {
  address: string;
}

export default function TransactionsTab({ address }: TransactionsTabProps) {
  const phone = usePhoneLayout();
  const [family, setFamily] = useState<TxFamilyKey>('all');
  // The account read the page made already (no poll); an AT has no account to read.
  const account = useAccount(isAtAddress(address) ? null : address);
  const publicKey = account.data?.publicKey ?? null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <FamilyFilter family={family} onFamily={setFamily} phone={phone} />
      {publicKey ? (
        <WaitingSection address={address} publicKey={publicKey} family={family} />
      ) : null}
      <AccountTxList key={family} address={address} family={family} />
    </Box>
  );
}
