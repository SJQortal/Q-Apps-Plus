/**
 * Transactions on Qortal's lists: what waits for a block (the mempool, only
 * with the latest blocks), and the confirmed transactions of the picked
 * type in the picked blocks, 20 a page, newest first, with "Show older".
 * Each page is its own read (data/explorer/globalTx.ts); "Show older" reads
 * the next one, says what it brought in a polite live region and keeps
 * focus (when nothing older is left and it goes, focus moves to the first
 * new row, or to the line under the list).
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Card, Section } from '../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../components/common/states';
import { TxList, TxListRow } from '../../../components/explorer/TxListRow';
import {
  getGlobalTx,
  getGlobalWaiting,
  GLOBAL_PAGE,
  globalTxKey,
  globalWaitingKey,
  type BlockRange,
} from '../../../data/explorer/globalTx';
import { useQuery } from '../../../hooks/useQuery';
import {
  globalCoverage,
  globalEmpty,
  globalOlderLoaded,
  typesOfChoice,
  type GlobalType,
} from './globalFilters';

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

interface PageProps {
  types: readonly string[];
  range: BlockRange;
  offset: number;
  endsAtTip: boolean;
}

/** One page of rows, as list items (the first page is read by the list itself). */
function OlderPage({ types, range, offset, endsAtTip }: PageProps) {
  const page = useQuery(globalTxKey(types, range, offset), (force) =>
    getGlobalTx(types, range, offset, { force, endsAtTip })
  );
  return (
    <>
      {(page.data?.rows ?? []).map((tx) => (
        <li key={tx.signature}>
          <TxListRow tx={tx} />
        </li>
      ))}
    </>
  );
}

export function GlobalResults({
  type,
  range,
  endsAtTip,
  onWider,
}: {
  type: GlobalType;
  range: BlockRange;
  endsAtTip: boolean;
  /** Look in more blocks (offered when nothing was found in the latest 1,000). */
  onWider?: () => void;
}) {
  const types = typesOfChoice(type);
  const first = useQuery(globalTxKey(types, range, 0), (force) =>
    getGlobalTx(types, range, 0, { force, endsAtTip })
  );
  /** Pages shown after the first, each a full read before the next. */
  const [older, setOlder] = useState<Array<{ offset: number; count: number; done: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const coverageRef = useRef<HTMLParagraphElement>(null);
  const focusRow = useRef<number | null>(null);

  const last = older.length ? older[older.length - 1] : null;
  const count = (first.data?.rows.length ?? 0) + older.reduce((sum, page) => sum + page.count, 0);
  const done = last ? last.done : Boolean(first.data?.done);
  const more = Boolean(first.data) && !done;

  useLayoutEffect(() => {
    if (focusRow.current === null || more) return;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[data-tx-row]');
    (buttons?.[focusRow.current] ?? coverageRef.current)?.focus();
    focusRow.current = null;
  });

  const showOlder = async () => {
    if (loading || !more) return;
    setLoading(true);
    setOlderError(null);
    const offset = count;
    try {
      const page = await getGlobalTx(types, range, offset, { endsAtTip });
      if (page.done) focusRow.current = offset;
      setOlder((pages) => [...pages, { offset, count: page.rows.length, done: page.done }]);
      setSaid('');
      requestAnimationFrame(() => setSaid(globalOlderLoaded(type, page.rows.length)));
    } catch (error) {
      setOlderError(error);
    } finally {
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
    body = (
      <>
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
            {first.data.rows.map((tx) => (
              <li key={tx.signature}>
                <TxListRow tx={tx} />
              </li>
            ))}
            {older.map((page) => (
              <OlderPage
                key={page.offset}
                types={types}
                range={range}
                offset={page.offset}
                endsAtTip={endsAtTip}
              />
            ))}
          </Box>
        </Card>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography
            ref={coverageRef}
            tabIndex={-1}
            variant="body2"
            color="text.secondary"
            sx={{ flex: '1 1 220px', px: 0.5, '&:focus': { outline: 'none' } }}
          >
            {globalCoverage(type, count, done, range)}
          </Typography>
          {more ? (
            <Button
              variant="outlined"
              onClick={() => void showOlder()}
              aria-disabled={loading || undefined}
              sx={{ minHeight: 44 }}
            >
              {loading ? 'Loading…' : 'Show older'}
            </Button>
          ) : null}
        </Box>
        {olderError ? (
          <ErrorState
            compact
            title="Couldn't load older transactions."
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
