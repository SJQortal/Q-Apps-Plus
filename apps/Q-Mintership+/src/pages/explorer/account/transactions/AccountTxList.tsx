/**
 * An account's transactions as filtered (rules/explorer/accountTxFilters.ts;
 * data/explorer/accountTx.ts): 50 on screen at a time out of reads of 100,
 * newest or oldest first. A time picked is a window over the list
 * (data/explorer/txWindow.ts); a name is matched on the rows read; "Biggest
 * amount first" sorts the rows read. "Load older" (or "Load newer") first
 * shows the rest of what was read, then reads the next 100. It says what
 * it brought in a polite live region and keeps focus on itself (when
 * nothing more is left and it goes, focus moves to the first new row). A
 * busy account whose search takes longer than 3 s says it is still
 * checking. Under the list, how much of the account's list is on screen.
 *
 * A search typed over the tab (Simon, 2026-10-17) narrows the rows read to
 * those that show what was typed (components/explorer/search: names,
 * addresses, amounts, types, blocks, dates; similar words too): those that
 * match first, then, under "Similar to …", those only close. The line
 * under them says how many of how many read, and Load older searches on.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../../components/common/states';
import { TxList } from '../../../../components/explorer/TxListRow';
import { SimilarHeading } from '../../../../components/explorer/search/SimilarHeading';
import { useTxSearch } from '../../../../components/explorer/search/useTxSearch';
import {
  accountTxKey,
  getAccountTx,
  type AccountTxView,
} from '../../../../data/explorer/accountTx';
import { getTxWindow, txWindowKey } from '../../../../data/explorer/txWindow';
import type { TxRow } from '../../../../data/types';
import { useQuery } from '../../../../hooks/useQuery';
import {
  byAmount,
  isAboutName,
  typesToAsk,
  type TxFilters,
} from '../../../../rules/explorer/accountTxFilters';
import { TX_FAMILIES } from '../../../../rules/explorer/txFamilies';
import {
  coverageLine,
  emptyLine,
  familyTitle,
  loadMoreLabel,
  noNameLine,
  olderLoadedLine,
  readingOnLine,
  searchLine,
  STILL_CHECKING,
} from './txTabWords';
import { useSlow } from './useSlow';

/** Rows shown at first and added by each "Load older". */
export const SHOW_STEP = 50;
/** With a name picked: read on by itself while fewer than this match… */
const NAME_ENOUGH = 10;
/** …up to this many more pages. */
const NAME_AUTO_READS = 4;

function StillChecking() {
  return (
    <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
      {STILL_CHECKING}
    </Typography>
  );
}

/** The rows to show: the ones about the name picked, in the order picked. */
function shownRows(rows: TxRow[], filters: TxFilters): TxRow[] {
  const named = filters.name ? rows.filter((tx) => isAboutName(tx, filters.name as string)) : rows;
  return filters.order === 'amount' ? byAmount(named) : named;
}

/** The time picked, as a window (no read for any time). */
function useWindow(filters: TxFilters) {
  const timed = filters.when !== 'any';
  return useQuery(timed ? txWindowKey(filters) : null, (force) => getTxWindow(filters, { force }));
}

export function AccountTxList({
  address,
  filters,
  search = '',
}: {
  address: string;
  filters: TxFilters;
  /** What was typed in the tab's search (empty: no search). */
  search?: string;
}) {
  const windowRead = useWindow(filters);
  const timed = filters.when !== 'any';
  const range = timed ? windowRead.data : null;
  // The filters arrive anew each render (parsed from the URL): kept per value.
  const typesWord = JSON.stringify(typesToAsk(filters));
  const types = useMemo(() => JSON.parse(typesWord) as string[] | null, [typesWord]);
  const oldest = filters.order === 'oldest';
  // Known once the time picked is a window; nothing to read when nothing can be in it.
  const view = useMemo<AccountTxView | null>(
    () =>
      types === null || range === undefined || range === 'empty'
        ? null
        : { order: oldest ? 'oldest' : 'newest', window: range },
    [types, range, oldest]
  );
  const list = useQuery(view && types ? accountTxKey(address, types, view) : null, (force) =>
    getAccountTx(address, types ?? [], { force, view: view ?? {} })
  );
  const [shown, setShown] = useState(SHOW_STEP);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  const slow = useSlow(list.isLoading || windowRead.isLoading || loadingOlder);
  const listRef = useRef<HTMLDivElement>(null);
  const coverageRef = useRef<HTMLParagraphElement>(null);
  /**
   * Once "Load older" has gone (nothing older left), focus moves to the
   * first new row, or to the line under the list when nothing came.
   */
  const focusRow = useRef<number | null>(null);

  const data = list.data;
  const read = data?.rows ?? [];
  const rows = shownRows(read, filters);
  // The search: what matches first, then what is similar.
  const txSearch = useTxSearch(rows, address, search);
  const tiers = txSearch.tiers;
  const found = tiers ? [...tiers.match, ...tiers.similar] : rows;
  const visible = found.slice(0, shown);
  const more = data ? found.length > shown || !data.done : false;
  // A new search starts again at the first rows.
  const [searchShown, setSearchShown] = useState(search);
  if (searchShown !== search) {
    setSearchShown(search);
    setShown(SHOW_STEP);
  }

  // A name is matched on the rows read: while fewer than 10 match, read on
  // by itself, up to 4 more pages, so a sparse name doesn't need many presses.
  const autoReads = useRef(0);
  const [autoReading, setAutoReading] = useState(false);
  useEffect(() => {
    if (!filters.name || !data || data.done || loadingOlder || autoReading) return;
    if (rows.length >= NAME_ENOUGH || autoReads.current >= NAME_AUTO_READS) return;
    autoReads.current += 1;
    setAutoReading(true);
    getAccountTx(address, types ?? [], { older: true, view: view ?? {} })
      .catch(() => {
        // "Load older" is still there to try again.
        autoReads.current = NAME_AUTO_READS;
      })
      .finally(() => setAutoReading(false));
  }, [filters.name, data, loadingOlder, autoReading, rows.length, address, types, view]);

  useLayoutEffect(() => {
    if (focusRow.current === null || more) return;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[data-tx-top]');
    (buttons?.[focusRow.current] ?? coverageRef.current)?.focus();
    focusRow.current = null;
  });

  const showOlder = async () => {
    if (!data || loadingOlder) return;
    setOlderError(null);
    let held = found.length;
    let done = data.done;
    if (held <= shown && !done) {
      setLoadingOlder(true);
      try {
        const next = await getAccountTx(address, types ?? [], {
          older: true,
          view: view ?? {},
        });
        const nextRows = shownRows(next.rows, filters);
        const nextTiers = tiers ? txSearch.tiersOf(nextRows) : null;
        held = nextTiers ? nextTiers.match.length + nextTiers.similar.length : nextRows.length;
        done = next.done;
      } catch (error) {
        setOlderError(error);
        return;
      } finally {
        setLoadingOlder(false);
      }
    }
    const added = Math.max(0, Math.min(SHOW_STEP, held - shown));
    // The button goes when this shows the last of the list: focus moves on.
    if (done && held <= shown + SHOW_STEP)
      // The first new row: after the list's rows as they are now (alike ones count once).
      focusRow.current = listRef.current?.querySelectorAll('[data-tx-top]').length ?? shown;
    if (added > 0) setShown(shown + SHOW_STEP);
    // Emptied first, so the same words are said again for a second press.
    setSaid('');
    requestAnimationFrame(() => setSaid(olderLoadedLine(filters, added, done)));
  };

  const loadMore = (
    <Button
      variant="outlined"
      onClick={() => void showOlder()}
      aria-disabled={loadingOlder || undefined}
      sx={{ minHeight: 44, alignSelf: 'flex-start' }}
    >
      {loadingOlder ? 'Loading…' : loadMoreLabel(filters)}
    </Button>
  );

  const label = TX_FAMILIES.find((f) => f.key === filters.kind)?.label ?? 'All';
  const title = familyTitle(filters.kind, label);

  let body;
  if (types === null) {
    body = <EmptyState title={noNameLine(filters)} />;
  } else if (timed && windowRead.isError && windowRead.data === undefined) {
    body = (
      <ErrorState
        title="Couldn't read the blocks picked."
        error={windowRead.error}
        onRetry={() => void windowRead.refetch()}
      />
    );
  } else if (range === 'empty') {
    body = <EmptyState title={emptyLine(filters)} />;
  } else if (!data && list.isError) {
    body = (
      <ErrorState
        title="Couldn't load this account's transactions."
        error={list.error}
        onRetry={() => void list.refetch()}
      />
    );
  } else if (!data) {
    body = (
      <>
        <ListSkeleton count={4} label="Loading this account's transactions" />
        {slow ? <StillChecking /> : null}
      </>
    );
  } else if (tiers && txSearch.query) {
    const typed = txSearch.query.text;
    const shownMatch = tiers.match.slice(0, shown);
    const shownSimilar = tiers.similar.slice(0, Math.max(0, shown - tiers.match.length));
    body = (
      <>
        <div ref={listRef}>
          {shownMatch.length ? (
            <TxList
              rows={shownMatch}
              viewpoint={address}
              label={`${title} matching “${typed}”`}
              hintOf={txSearch.hintOf}
            />
          ) : null}
          {shownSimilar.length ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                mt: shownMatch.length ? 2 : 0,
              }}
            >
              <SimilarHeading typed={typed} />
              <TxList
                rows={shownSimilar}
                viewpoint={address}
                label={`${title} similar to “${typed}”`}
                hintOf={txSearch.hintOf}
              />
            </Box>
          ) : null}
        </div>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography
            ref={coverageRef}
            tabIndex={-1}
            role="status"
            variant="body2"
            color="text.secondary"
            sx={{ flex: '1 1 220px', px: 0.5, '&:focus': { outline: 'none' } }}
          >
            {searchLine(filters, typed, {
              match: tiers.match.length,
              similar: tiers.similar.length,
              searched: rows.length,
              done: data.done,
            })}
            {txSearch.reading ? ' Reading the names of the accounts in them…' : ''}
          </Typography>
          {more ? loadMore : null}
        </Box>
      </>
    );
  } else if (!rows.length) {
    body = data.done ? (
      <EmptyState title={emptyLine(filters)} />
    ) : (
      // A name matched on the rows read: none yet, and there is more to read.
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <Typography
          ref={coverageRef}
          tabIndex={-1}
          color="text.secondary"
          sx={{ flex: '1 1 220px', px: 0.5, '&:focus': { outline: 'none' } }}
        >
          {coverageLine(filters, 0, 0, read.length, false)}
        </Typography>
        {loadMore}
      </Box>
    );
  } else {
    body = (
      <>
        <div ref={listRef}>
          <TxList rows={visible} viewpoint={address} label={title} />
        </div>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography
            ref={coverageRef}
            tabIndex={-1}
            variant="body2"
            color="text.secondary"
            sx={{ flex: '1 1 220px', px: 0.5, '&:focus': { outline: 'none' } }}
          >
            {coverageLine(filters, visible.length, rows.length, read.length, data.done)}
          </Typography>
          {more ? loadMore : null}
        </Box>
      </>
    );
  }

  return (
    <Section title={title} id="explorer-account-tx">
      {body}
      {data && slow ? <StillChecking /> : null}
      {autoReading && filters.name ? (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          {readingOnLine(filters.name)}
        </Typography>
      ) : null}
      {olderError ? (
        <ErrorState
          compact
          title="Couldn't load more transactions."
          error={olderError}
          onRetry={() => void showOlder()}
        />
      ) : null}
      <Box role="status" className="qmp-visually-hidden">
        {said}
      </Box>
    </Section>
  );
}
