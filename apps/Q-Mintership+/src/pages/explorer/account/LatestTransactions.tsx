/**
 * Overview's "Latest transactions": the newest 5 of the account's
 * transactions, from the same read as the Transactions tab's first view
 * (`xtx:<address>:all`), so opening the tab next costs nothing. Read once
 * the section nears the screen. "All transactions" switches to the tab in
 * place (like the tabs themselves) and puts focus on it. An account with
 * none says so in one line.
 */
import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Section } from '../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { TxList } from '../../../components/explorer/TxListRow';
import { accountTxKey, getAccountTx } from '../../../data/explorer/accountTx';
import { useInView } from '../../../hooks/useInView';
import { useQuery } from '../../../hooks/useQuery';
import { explorerAccountPath } from '../../../routes/paths';
import { tabIdOf } from './tabIds';
import { STILL_CHECKING } from './transactions/txTabWords';
import { useSlow } from './transactions/useSlow';

/** How many the Overview shows. */
const LATEST = 5;

export interface LatestTransactionsProps {
  address: string;
}

export function LatestTransactions({ address }: LatestTransactionsProps) {
  const location = useLocation();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const list = useQuery(near ? accountTxKey(address, []) : null, (force) =>
    getAccountTx(address, [], { force })
  );
  const slow = useSlow(near && list.isLoading);
  const rows = list.data?.rows.slice(0, LATEST) ?? [];

  let body;
  if (!list.data && list.isError) {
    body = (
      <ErrorState
        compact
        title="Couldn't load the latest transactions."
        error={list.error}
        onRetry={() => void list.refetch()}
      />
    );
  } else if (!list.data) {
    body = (
      <>
        <ListSkeleton count={2} label="Loading the latest transactions" />
        {slow ? (
          <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            {STILL_CHECKING}
          </Typography>
        ) : null}
      </>
    );
  } else if (!rows.length) {
    body = (
      <Typography color="text.secondary" sx={{ px: 0.5 }}>
        No transactions yet.
      </Typography>
    );
  } else {
    body = (
      <>
        <TxList rows={rows} viewpoint={address} label="Latest transactions" />
        <Button
          component={RouterLink}
          to={explorerAccountPath(address, 'transactions')}
          replace
          // Keeps what the page was opened with, as the tabs do.
          state={location.state}
          onClick={() =>
            // The Overview goes; the tab it opened takes the focus.
            requestAnimationFrame(() => document.getElementById(tabIdOf('transactions'))?.focus())
          }
          endIcon={<ChevronRightOutlinedIcon />}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          All transactions
        </Button>
      </>
    );
  }

  return (
    <div ref={setNode}>
      <Section title="Latest transactions" id="explorer-latest-tx">
        {body}
      </Section>
    </div>
  );
}
