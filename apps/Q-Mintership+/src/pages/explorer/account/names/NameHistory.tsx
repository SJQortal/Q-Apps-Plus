/**
 * The account's name transactions, newest first, each as a sentence told
 * from this account ("Registered the name “Maps”", "Sold the name “Spare
 * Room” to Nora for 5 QORT"), with its date and block. One read of the
 * newest 100 once the section nears the screen (a heavy read, through the
 * Explorer's limiter); 20 rows at a time, since each names the accounts
 * involved.
 */
import { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import { getNameHistory, nameHistoryKey } from '../../../../data/explorer/nameHistory';
import type { TxRow } from '../../../../data/types';
import { useInView } from '../../../../hooks/useInView';
import { useQuery } from '../../../../hooks/useQuery';
import { describeTx } from '../../../../rules/explorer/txWords';
import { formatBlock, formatDate } from '../../../../utils/format';
import { historyCoverage, NO_NAME_HISTORY, showMoreWords } from './namesWords';
import { FOCUSABLE_ROW_SX, useShowMore } from './useShowMore';

/** Rows shown at first, and added by each "Show more". */
export const HISTORY_PAGE = 20;

function HistoryRow({ tx, address }: { tx: TxRow; address: string }) {
  const words = describeTx(tx, { viewpoint: address });
  return (
    <Box
      component="li"
      tabIndex={-1}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        minWidth: 0,
        '&:first-of-type': { borderTop: 0, pt: 0 },
        ...FOCUSABLE_ROW_SX,
      }}
    >
      <Typography sx={{ overflowWrap: 'anywhere' }}>
        <TxSentence parts={words.parts} />
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {formatDate(tx.timestamp)}
        {typeof tx.blockHeight === 'number' ? ` · ${formatBlock(tx.blockHeight)}` : ''}
      </Typography>
    </Box>
  );
}

export function NameHistory({ address }: { address: string }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const history = useQuery(near ? nameHistoryKey(address) : null, (force) =>
    getNameHistory(address, { force })
  );
  const { shown, showMore, listRef } = useShowMore(HISTORY_PAGE);
  const rows = history.data?.rows ?? [];
  const visible = rows.slice(0, shown);
  const left = rows.length - visible.length;
  return (
    <Section title="Name history" id="names-history">
      <Card ref={setNode} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {history.isError && !history.data ? (
          <ErrorState
            compact
            title="Couldn't load its name history."
            error={history.error}
            onRetry={() => void history.refetch()}
          />
        ) : !history.data ? (
          <ListSkeleton count={2} label="Loading its name history" />
        ) : !rows.length ? (
          <Typography color="text.secondary">{NO_NAME_HISTORY}</Typography>
        ) : (
          <>
            <Box
              component="ul"
              ref={listRef}
              aria-label="Its name transactions"
              sx={{ listStyle: 'none', m: 0, p: 0 }}
            >
              {visible.map((tx) => (
                <HistoryRow key={tx.signature} tx={tx} address={address} />
              ))}
            </Box>
            {left > 0 ? (
              <Button onClick={showMore} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
                {showMoreWords(left, HISTORY_PAGE)}
              </Button>
            ) : null}
            <Typography variant="body2" color="text.secondary">
              {historyCoverage(rows.length, history.data.capped)}
            </Typography>
          </>
        )}
      </Card>
    </Section>
  );
}
