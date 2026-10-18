/**
 * Transactions on Qortal: `/explorer/transactions`. Every confirmed
 * transaction of every type but messages, or of one family or type picked
 * (Simon, 2026-10-18: All by default, no longer Payments), in a range
 * of blocks (the latest 1,000 unless another is picked), newest first
 * unless oldest first is picked, 20 a page, shown as soon as the page
 * opens; what waits for a block is listed apart. Messages are never listed
 * here (tx/globalFilters.ts), and the page says so. The rows read can be
 * narrowed to those that mention some text, a name typed also matching
 * its owner's address, and reward shares to one kind
 * (rules/explorer/rowFilter.ts). All of it is in the URL (`?type=`,
 * `?blocks=`, `?span=`, `?order=`, `?find=`, `?share=`, read with
 * appParam, so a query Hub appends doesn't spoil them).
 *
 * The latest blocks hang off the tip read when the page opened, so the
 * rows don't move while they are paged; Refresh reads the tip again. Rows
 * open accounts in the Explorer, each as a new trail. Read-only, and
 * nothing polls.
 */
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography } from '@mui/material';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EXPLORER_START_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { RefreshButton } from '../../components/common/RefreshButton';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { getTip } from '../../data/chain';
import { typesKey } from '../../data/explorer/accountTx';
import { getNameData } from '../../data/explorer/account';
import { rangeFor, type BlocksChoice, type GlobalOrder } from '../../data/explorer/globalTx';
import { isAddress } from '../../data/accounts';
import { invalidate } from '../../data/query';
import { useQuery } from '../../hooks/useQuery';
import { appParam } from '../../routes/hubLocation';
import { PATHS } from '../../routes/paths';
import { isShareKind, type RowFilter, type ShareKind } from '../../rules/explorer/rowFilter';
import { formatCount } from '../../utils/format';
import { GlobalFilterBar } from './tx/GlobalFilterBar';
import { GlobalResults, GlobalWaiting } from './tx/GlobalResults';
import {
  blocksParam,
  orderParam,
  parseBlocksParam,
  parseOrderParam,
  parseTypeParam,
  spanParam,
  typeParam,
  typesOfChoice,
  type GlobalType,
} from './tx/globalFilters';

/** How long typing rests before the rows narrow (and the URL follows). */
const FIND_REST_MS = 300;

/** Text that could be a registered name: its owner's rows match too. */
function couldBeName(text: string): boolean {
  return text.length >= 3 && text.length <= 40 && !isAddress(text) && !/^#?\d+$/.test(text);
}
import { ExplorerHeaderSearch } from '../../components/explorer/ExplorerHeaderSearch';
import { useViewState } from '../../hooks/useViewState';

export default function TransactionsPage() {
  const [params, setParams] = useSearchParams();
  const type = parseTypeParam(appParam(params, 'type'));
  const blocks = parseBlocksParam(appParam(params, 'blocks'), appParam(params, 'span'));
  const order = parseOrderParam(appParam(params, 'order'));
  const find = (appParam(params, 'find') ?? '').trim();
  const shareValue = appParam(params, 'share');
  const share: ShareKind = isShareKind(shareValue) ? shareValue : 'any';
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
  const setType = (value: GlobalType) => setQuery({ type: typeParam(value), share: null });
  const setBlocks = (value: BlocksChoice) =>
    setQuery({ blocks: blocksParam(value), span: spanParam(value) });
  const setOrder = (value: GlobalOrder) => setQuery({ order: orderParam(value) });
  const setShare = (value: ShareKind) => setQuery({ share: value === 'any' ? null : value });

  // What the rows must mention: typed here, in the URL once typing rests.
  const [findInput, setFindInput] = useState(find);
  const findTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (findTimer.current) clearTimeout(findTimer.current);
    },
    []
  );
  const typeFind = (text: string) => {
    setFindInput(text);
    if (findTimer.current) clearTimeout(findTimer.current);
    findTimer.current = setTimeout(
      () => setQuery({ find: text.trim() || null }),
      text ? FIND_REST_MS : 0
    );
  };
  // A name typed: its owner's rows match too (the name's record, kept 10 minutes).
  const named = useQuery(couldBeName(find) ? `xnamedata:${find}` : null, () => getNameData(find));
  const filter: RowFilter = {
    text: find,
    owner:
      named.data && named.data.name.toLowerCase() === find.toLowerCase() ? named.data.owner : null,
    share: type === 'REWARD_SHARE' || type === 'minting' ? share : 'any',
  };

  // The tip on arrival (no poll): the latest blocks are counted back from it. Kept for
  // Back (useViewState), so the same blocks and the older pages shown come back.
  const tip = useQuery('chain:tip', (force) => getTip({ force }));
  const [pinned, setPinned] = useViewState<number | null>('global:pinned', null);
  useEffect(() => {
    if (pinned === null && tip.data) setPinned(tip.data.height);
  }, [pinned, tip.data, setPinned]);
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
          // A new type, range or order starts a new list.
          key={`${typesKey(typesOfChoice(type))}:${range.start}:${range.limit}:${order}`}
          type={type}
          range={range}
          endsAtTip={latest}
          order={order}
          filter={filter}
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
        actions={
          <>
            <ExplorerHeaderSearch />
            {<RefreshButton onClick={() => void refresh()} fetching={refreshing} />}
          </>
        }
      />
      <PageBody>
        <Typography color="text.secondary">
          Every confirmed transaction in a range of blocks, of every type or the one you pick,
          newest or oldest first. Messages aren't listed here: an account's Transactions tab shows
          its own.
        </Typography>
        <GlobalFilterBar
          type={type}
          onType={setType}
          blocks={blocks}
          onBlocks={setBlocks}
          order={order}
          onOrder={setOrder}
          find={findInput}
          onFind={typeFind}
          share={share}
          onShare={setShare}
          tip={pinned}
        />
        {body}
      </PageBody>
    </PersonLinkContext>
  );
}
