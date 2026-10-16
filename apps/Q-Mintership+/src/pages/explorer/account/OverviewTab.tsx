/**
 * An account at a glance: its level, blocks minted, balance, and how many
 * names and groups it has. A first, small Overview; the full one (summary
 * sentence, direct links, minting, latest transactions, notes) replaces it.
 * Every read here is shared with the header or cached per account, and none
 * polls.
 */
import { Box, Typography } from '@mui/material';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { formatQort, getBalance } from '../../../data/accounts';
import { getGroupsOf, getNamesOf } from '../../../data/explorer/account';
import { effectiveBlocksMinted } from '../../../rules/levels';
import { useAccount } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import { formatCount, plural } from '../../../utils/format';

export interface OverviewTabProps {
  address: string;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        sx={{ m: 0, fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

export default function OverviewTab({ address }: OverviewTabProps) {
  const account = useAccount(address);
  // The same keys as useBalance and the Names and Groups reads; no polling here.
  const balance = useQuery(`balance:${address}`, (force) => getBalance(address, { force }));
  const names = useQuery(`xnames:${address}`, (force) => getNamesOf(address, { force }));
  const groups = useQuery(`xgroups:${address}`, (force) => getGroupsOf(address, { force }));

  if (account.isError && !account.data)
    return (
      <ErrorState
        compact
        title="Couldn't load this account."
        error={account.error}
        onRetry={() => void account.refetch()}
      />
    );
  if (!account.data) return <ListSkeleton count={2} label="Loading the account" />;
  const a = account.data;
  const adjusted = a.blocksMintedAdjustment !== 0 || a.blocksMintedPenalty !== 0;
  return (
    <Box
      component="dl"
      aria-label="At a glance"
      sx={{
        m: 0,
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))' },
      }}
    >
      <Fact label="Level" value={String(a.level)} />
      <Fact
        label={adjusted ? 'Blocks minted (with adjustments)' : 'Blocks minted'}
        value={formatCount(effectiveBlocksMinted(a))}
      />
      <Fact
        label="Balance"
        value={
          balance.data !== undefined
            ? formatQort(balance.data)
            : balance.isError
              ? "Couldn't load"
              : 'Loading…'
        }
      />
      <Fact
        label="Names"
        value={
          names.data
            ? `${formatCount(names.data.names.length)}${names.data.truncated ? '+' : ''}`
            : names.isError
              ? "Couldn't load"
              : 'Loading…'
        }
      />
      <Fact
        label="Groups"
        value={
          groups.data
            ? plural(groups.data.length, 'group')
            : groups.isError
              ? "Couldn't load"
              : 'Loading…'
        }
      />
    </Box>
  );
}
