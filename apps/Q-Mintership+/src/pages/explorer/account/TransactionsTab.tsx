/**
 * An account's transactions: the kind (chips; one picker on phones), then
 * the filters (transactions/TxFilterBar.tsx: one exact type, one of its
 * names, when, and the order), what it sent that waits for a block (when
 * any, and when the time picked reaches now), then its confirmed
 * transactions, 50 at a time (transactions/AccountTxList.tsx). Each row
 * opens to its details, its raw API response, and links on to the
 * accounts involved and the transaction's own page.
 *
 * What is picked lives in the URL (rules/explorer/accountTxFilters.ts), so
 * Back, a copied link and a reload keep it. Every read is the Explorer's
 * own and none polls; an AT (automated contract) has no public key, so it
 * has no waiting list.
 */
import { useSearchParams } from 'react-router-dom';
import { Box } from '@mui/material';
import { getNamesOf, isAtAddress } from '../../../data/explorer/account';
import { useAccount, usePrimaryName } from '../../../hooks/useData';
import { usePhoneLayout } from '../../../hooks/usePhoneLayout';
import { useQuery } from '../../../hooks/useQuery';
import { appParam } from '../../../routes/hubLocation';
import {
  filtersToParams,
  parseFilters,
  type TxFilters,
} from '../../../rules/explorer/accountTxFilters';
import { AccountTxList } from './transactions/AccountTxList';
import { FamilyFilter } from './transactions/FamilyFilter';
import { TxFilterBar } from './transactions/TxFilterBar';
import { WaitingSection } from './transactions/WaitingSection';

export interface TransactionsTabProps {
  address: string;
}

export default function TransactionsTab({ address }: TransactionsTabProps) {
  const phone = usePhoneLayout();
  const [params, setParams] = useSearchParams();
  const filters = parseFilters((key) => appParam(params, key));
  const setFilters = (next: TxFilters) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(filtersToParams(next))) {
          if (value === null) out.delete(key);
          else out.set(key, value);
        }
        return out;
      },
      { replace: true }
    );
  const at = isAtAddress(address);
  // The account read the page made already (no poll); an AT has no account to read.
  const account = useAccount(at ? null : address);
  const publicKey = account.data?.publicKey ?? null;
  // Its names for the Name picker: the page header's read, shared.
  const names = useQuery(at ? null : `xnames:${address}`, (force) =>
    getNamesOf(address, { force })
  );
  const primary = usePrimaryName(at ? null : address);
  // What waits for a block is now: shown unless the time picked ends before now.
  const endsBeforeNow =
    (filters.when === 'dates' || filters.when === 'blocks') && filters.to !== null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <FamilyFilter
        family={filters.kind}
        onFamily={(kind) => setFilters({ ...filters, kind, type: null })}
        phone={phone}
      />
      <TxFilterBar
        filters={filters}
        onChange={setFilters}
        names={names.data?.names}
        primary={primary.data}
      />
      {publicKey && !endsBeforeNow ? (
        <WaitingSection address={address} publicKey={publicKey} filters={filters} />
      ) : null}
      <AccountTxList
        key={JSON.stringify(filtersToParams(filters))}
        address={address}
        filters={filters}
      />
    </Box>
  );
}
