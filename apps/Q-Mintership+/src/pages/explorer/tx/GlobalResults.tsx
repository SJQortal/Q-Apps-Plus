/**
 * Transactions on Qortal's lists: what waits for a block (the mempool, only
 * with the latest blocks), and the confirmed transactions of the picked
 * type in the picked blocks, 20 a page, newest first (or oldest first, with
 * "Show newer"), with "Show older". Each page is its own read
 * (data/explorer/globalTx.ts); "Show older" reads the next one, says what
 * it brought in a polite live region and keeps focus (when nothing older is
 * left and it goes, focus moves to the first new row, or to the line under
 * the list).
 *
 * Narrowed (rules/explorer/rowFilter.ts), the list shows the rows read that
 * match, the line under it says how many of how many, and "Look further"
 * reads on until a page brings a match, at most 10 pages (200 rows) a press.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Card, Section } from '../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../components/common/states';
import { TxList, TxRows } from '../../../components/explorer/TxListRow';
import {
  getGlobalTx,
  getGlobalWaiting,
  GLOBAL_PAGE,
  globalTxKey,
  globalWaitingKey,
  type BlockRange,
  type GlobalOrder,
} from '../../../data/explorer/globalTx';
import type { TxRow } from '../../../data/types';
import { useQuery } from '../../../hooks/useQuery';
import { filterOn, rowMatches, type RowFilter } from '../../../rules/explorer/rowFilter';
import {
  filteredCoverage,
  globalCoverage,
  globalEmpty,
  globalOlderLoaded,
  lookedFurtherWords,
  typesOfChoice,
  type GlobalType,
} from './globalFilters';
import { useViewState } from '../../../hooks/useViewState';

/** Pages "Look further" reads at most, a press, while none of them matches. */
export const LOOK_PAGES = 10;

export const RESULTS_TITLE = 'Confirmed transactions';
export const WAITING_TITLE = 'Waiting to be confirmed';

/** Up to 20 waiting for a block, of the picked type. Nothing when there are none. */
export function GlobalWaiting({ type }: { type: GlobalType }) {
  const types = typesOfChoice(type);
  const waiting = useQuery(globalWaitingKey(types), (force) => getGlobalWaiting(types, { force }));
  const rows = waiting.data ?? [];
  if (!rows.length) return null;
  return (
    <Section title={WAITING_TITLE} id="explorer-global-waiting" count={rows.length}>
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        Your node holds these until a block takes them.
        {rows.length >= GLOBAL_PAGE ? ` The newest ${GLOBAL_PAGE} are shown.` : ''}
      </Typography>
      <TxList rows={rows} label={WAITING_TITLE} />
    </Section>
  );
}

function Rows({ rows }: { rows: TxRow[] }) {
  return <TxRows rows={rows} />;
}

export function GlobalResults({
  type,
  range,
  endsAtTip,
  order = 'newest',
  filter,
  onWider,
}: {
  type: GlobalType;
  range: BlockRange;
  endsAtTip: boolean;
  order?: GlobalOrder;
  /** What narrows the rows read (none when absent). */
  filter?: RowFilter;
  /** Look in more blocks (offered when nothing was found in the latest 1,000). */
  onWider?: () => void;
}) {
  const types = typesOfChoice(type);
  const first = useQuery(globalTxKey(types, range, 0, order), (force) =>
    getGlobalTx(types, range, 0, { force, endsAtTip, order })
  );
  /** Pages shown after the first, each a full read before the next: kept for Back (useViewState). */
  const [older, setOlder] = useViewState<Array<{ offset: number; rows: TxRow[]; done: boolean }>>(
    `global:${types === null ? 'none' : types.join(',')}:${range.start}:${range.limit}:${order}:older`,
    []
  );
  const [loading, setLoading] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const coverageRef = useRef<HTMLParagraphElement>(null);
  const focusRow = useRef<number | null>(null);

  const narrowed = filter !== undefined && filterOn(filter);
  const matches = (tx: TxRow) => !narrowed || rowMatches(tx, filter as RowFilter);
  const last = older.length ? older[older.length - 1] : null;
  const count =
    (first.data?.rows.length ?? 0) + older.reduce((sum, page) => sum + page.rows.length, 0);
  const done = last ? last.done : Boolean(first.data?.done);
  const more = Boolean(first.data) && !done;
  const firstShown = (first.data?.rows ?? []).filter(matches);
  const olderShown = older.map((page) => ({
    offset: page.offset,
    rows: page.rows.filter(matches),
  }));
  const shown = firstShown.length + olderShown.reduce((sum, page) => sum + page.rows.length, 0);

  useLayoutEffect(() => {
    if (focusRow.current === null || more) return;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[data-tx-top]');
    (buttons?.[focusRow.current] ?? coverageRef.current)?.focus();
    focusRow.current = null;
  });

  const showOlder = async () => {
    if (loading || !more) return;
    setLoading(true);
    setOlderError(null);
    let offset = count;
    let read = 0;
    let matched = 0;
    const pages: typeof older = [];
    try {
      // One page; narrowed, on until a page brings a match (at most LOOK_PAGES).
      for (let i = 0; i < LOOK_PAGES; i += 1) {
        const page = await getGlobalTx(types, range, offset, { endsAtTip, order });
        pages.push({ offset, rows: page.rows, done: page.done });
        read += page.rows.length;
        matched += page.rows.filter(matches).length;
        offset += page.rows.length;
        if (page.done || !narrowed || matched > 0) break;
      }
    } catch (error) {
      setOlderError(error);
    } finally {
      if (pages.length) {
        // The first new row: after the list's rows as they are now (alike ones count once).
        if (pages[pages.length - 1].done)
          focusRow.current = listRef.current?.querySelectorAll('[data-tx-top]').length ?? shown;
        setOlder((previous) => [...previous, ...pages]);
        setSaid('');
        requestAnimationFrame(() =>
          setSaid(
            narrowed
              ? lookedFurtherWords(read, matched, order)
              : globalOlderLoaded(type, read, order)
          )
        );
      }
      setLoading(false);
    }
  };

  let body;
  if (!first.data && first.isError) {
    body = (
      <ErrorState
        title="Couldn't search the chain."
        error={first.error}
        onRetry={() => void first.refetch()}
      />
    );
  } else if (!first.data) {
    body = <ListSkeleton count={4} label="Searching the chain" />;
  } else if (!first.data.rows.length) {
    body = (
      <EmptyState
        title={globalEmpty(type, range)}
        actionLabel={onWider ? 'Look in the latest 10,000 blocks' : undefined}
        onAction={onWider}
      />
    );
  } else {
    const coverage = globalCoverage(type, count, done, range, order);
    body = (
      <>
        {shown ? (
          <Card sx={{ p: 0 }}>
            <Box
              component="ul"
              ref={listRef}
              aria-label={RESULTS_TITLE}
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0.5,
                '& > li + li': { borderTop: 1, borderColor: 'divider' },
              }}
            >
              <Rows rows={firstShown} />
              {olderShown.map((page) => (
                <Rows key={page.offset} rows={page.rows} />
              ))}
            </Box>
          </Card>
        ) : null}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography
            ref={coverageRef}
            tabIndex={-1}
            variant="body2"
            color="text.secondary"
            sx={{ flex: '1 1 220px', px: 0.5, '&:focus': { outline: 'none' } }}
          >
            {narrowed ? filteredCoverage(shown, coverage) : coverage}
          </Typography>
          {more ? (
            <Button
              variant="outlined"
              onClick={() => void showOlder()}
              aria-disabled={loading || undefined}
              sx={{ minHeight: 44 }}
            >
              {loading
                ? 'Loading…'
                : narrowed
                  ? 'Look further'
                  : order === 'oldest'
                    ? 'Show newer'
                    : 'Show older'}
            </Button>
          ) : null}
        </Box>
        {olderError ? (
          <ErrorState
            compact
            title={`Couldn't load ${order === 'oldest' ? 'newer' : 'older'} transactions.`}
            error={olderError}
            onRetry={() => void showOlder()}
          />
        ) : null}
      </>
    );
  }

  return (
    <Section title={RESULTS_TITLE} id="explorer-global-tx">
      {body}
      <Box role="status" className="qmp-visually-hidden">
        {said}
      </Box>
    </Section>
  );
}
