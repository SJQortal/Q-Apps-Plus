/**
 * One family's transactions of an account, newest first (data/explorer/
 * accountTx.ts): 50 on screen at a time out of reads of 100. "Load older"
 * first shows the rest of what was read, then reads the next 100. It says
 * what it brought in a polite live region and keeps focus on itself (when
 * nothing older is left and it goes, focus moves to the first new row).
 * A busy account whose search takes longer than 3 s says it is still
 * checking. Under the list, how much of the account's list is on screen.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../../components/common/states';
import { TxList } from '../../../../components/explorer/TxListRow';
import { accountTxKey, getAccountTx } from '../../../../data/explorer/accountTx';
import { useQuery } from '../../../../hooks/useQuery';
import { TX_FAMILIES, typesFor, type TxFamilyKey } from '../../../../rules/explorer/txFamilies';
import {
  coverageLine,
  emptyLine,
  familyTitle,
  olderLoadedLine,
  STILL_CHECKING,
} from './txTabWords';
import { useSlow } from './useSlow';

/** Rows shown at first and added by each "Load older". */
export const SHOW_STEP = 50;

function StillChecking() {
  return (
    <Typography role="status" variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
      {STILL_CHECKING}
    </Typography>
  );
}

export function AccountTxList({ address, family }: { address: string; family: TxFamilyKey }) {
  const types = typesFor(family);
  const list = useQuery(accountTxKey(address, types), (force) =>
    getAccountTx(address, types, { force })
  );
  const [shown, setShown] = useState(SHOW_STEP);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  const slow = useSlow(list.isLoading || loadingOlder);
  const listRef = useRef<HTMLDivElement>(null);
  /** The row to focus once "Load older" has gone (nothing older left). */
  const focusRow = useRef<number | null>(null);

  const data = list.data;
  const rows = data?.rows ?? [];
  const visible = rows.slice(0, shown);
  const more = data ? rows.length > shown || !data.done : false;

  useLayoutEffect(() => {
    if (focusRow.current === null || more) return;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[data-tx-row]');
    buttons?.[focusRow.current]?.focus();
    focusRow.current = null;
  });

  const showOlder = async () => {
    if (!data || loadingOlder) return;
    setOlderError(null);
    let held = rows.length;
    let done = data.done;
    if (held <= shown && !done) {
      setLoadingOlder(true);
      try {
        const next = await getAccountTx(address, types, { older: true });
        held = next.rows.length;
        done = next.done;
      } catch (error) {
        setOlderError(error);
        return;
      } finally {
        setLoadingOlder(false);
      }
    }
    const added = Math.max(0, Math.min(SHOW_STEP, held - shown));
    if (added > 0) {
      // Focus goes to the first new row only if the button is about to go.
      if (done && held <= shown + SHOW_STEP) focusRow.current = shown;
      setShown(shown + SHOW_STEP);
    }
    // Emptied first, so the same words are said again for a second press.
    setSaid('');
    requestAnimationFrame(() => setSaid(olderLoadedLine(family, added)));
  };

  const label = TX_FAMILIES.find((f) => f.key === family)?.label ?? 'All';
  const title = familyTitle(family, label);

  let body;
  if (!data && list.isError) {
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
  } else if (!rows.length) {
    body = <EmptyState title={emptyLine(family)} />;
  } else {
    body = (
      <>
        <div ref={listRef}>
          <TxList rows={visible} viewpoint={address} label={title} />
        </div>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 220px', px: 0.5 }}>
            {coverageLine(family, visible.length, rows.length, data.done)}
          </Typography>
          {more ? (
            <Button
              variant="outlined"
              onClick={() => void showOlder()}
              aria-disabled={loadingOlder || undefined}
              sx={{ minHeight: 44 }}
            >
              {loadingOlder ? 'Loading…' : 'Load older'}
            </Button>
          ) : null}
        </Box>
        {slow ? <StillChecking /> : null}
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
    <Section title={title} id="explorer-account-tx">
      {body}
      <Box role="status" className="qmp-visually-hidden">
        {said}
      </Box>
    </Section>
  );
}
