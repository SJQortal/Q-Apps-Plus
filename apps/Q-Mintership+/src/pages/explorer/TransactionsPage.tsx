/**
 * Transactions on Qortal: `/explorer/transactions`. Every confirmed
 * transaction of one type (Payments unless another is picked) in a range
 * of blocks (the latest 1,000 unless another is picked), newest first, 20
 * a page, shown as soon as the page opens; what waits for a block is
 * listed apart. The type and blocks are in the URL (`?type=`, `?blocks=`,
 * read with appParam, so a query Hub appends doesn't spoil them).
 *
 * The latest blocks hang off the tip read when the page opened, so the
 * rows don't move while they are paged; Refresh reads the tip again. Rows
 * open accounts in the Explorer, each as a new trail. Read-only, and
 * nothing polls.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography } from '@mui/material';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EXPLORER_START_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { RefreshButton } from '../../components/common/RefreshButton';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { getTip } from '../../data/chain';
import { typesKey } from '../../data/explorer/accountTx';
import { rangeFor, type BlocksChoice } from '../../data/explorer/globalTx';
import { invalidate } from '../../data/query';
import { useQuery } from '../../hooks/useQuery';
import { appParam } from '../../routes/hubLocation';
import { PATHS } from '../../routes/paths';
import { formatCount } from '../../utils/format';
import { GlobalFilterBar } from './tx/GlobalFilterBar';
import { GlobalResults, GlobalWaiting } from './tx/GlobalResults';
import {
  blocksParam,
  parseBlocksParam,
  parseTypeParam,
  typeParam,
  typesOfChoice,
  type GlobalType,
} from './tx/globalFilters';

export default function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const type = parseTypeParam(appParam(params, 'type'));
  const blocks = parseBlocksParam(appParam(params, 'blocks'));
  const setQuery = (values: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(values)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  const setType = (value: GlobalType) => setQuery({ type: typeParam(value) });
  const setBlocks = (value: BlocksChoice) => setQuery({ blocks: blocksParam(value) });

  // The tip on arrival (no poll): the latest blocks are counted back from it.
  const tip = useQuery('chain:tip', (force) => getTip({ force }));
  const [pinned, setPinned] = useState<number | null>(null);
  useEffect(() => {
    if (pinned === null && tip.data) setPinned(tip.data.height);
  }, [pinned, tip.data]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      const fresh = await getTip({ force: true });
      setPinned(fresh.height);
      invalidate('xglobal:waiting:');
    } catch {
      // The tip on screen stays; the lists keep what they show.
    } finally {
      setRefreshing(false);
    }
  };

  let body: React.ReactNode;
  if (pinned === null && tip.isError) {
    body = (
      <ErrorState
        title="Couldn't read the chain's latest block."
        error={tip.error}
        onRetry={() => void tip.refetch()}
      />
    );
  } else if (pinned === null) {
    body = <ListSkeleton count={4} label="Searching the chain" />;
  } else if (blocks.kind === 'from' && blocks.start > pinned) {
    body = (
      <EmptyState
        title={`The chain is at block ${formatCount(pinned)}.`}
        description="Pick an earlier block to start from."
      />
    );
  } else {
    const range = rangeFor(blocks, pinned);
    const latest = blocks.kind === 'latest';
    body = (
      <>
        {latest ? <GlobalWaiting type={type} /> : null}
        <GlobalResults
          // A new type or range starts a new list.
          key={`${typesKey(typesOfChoice(type))}:${range.start}:${range.limit}`}
          type={type}
          range={range}
          endsAtTip={latest}
          onWider={
            latest && blocks.blocks === 1000
              ? () => setBlocks({ kind: 'latest', blocks: 10000 })
              : undefined
          }
        />
      </>
    );
  }

  return (
    <PersonLinkContext value={EXPLORER_START_LINKS}>
      <PageHeader
        title="Transactions on Qortal"
        back={PATHS.explorer}
        actions={<RefreshButton onClick={() => void refresh()} fetching={refreshing} />}
      />
      <PageBody>
        <Typography color="text.secondary">
          Every confirmed transaction of one type in a range of blocks, newest first.
        </Typography>
        <GlobalFilterBar
          type={type}
          onType={setType}
          blocks={blocks}
          onBlocks={setBlocks}
          tip={pinned}
        />
        {body}
      </PageBody>
    </PersonLinkContext>
  );
}
