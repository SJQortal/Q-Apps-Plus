/**
 * A name's own history, shown beside it (no toggle): the account's
 * transactions about that name, newest first, each as a sentence told from
 * this account ("Sold the name “Spare Room” to Nora for 5 QORT") with its
 * date and block. The newest 4 show; "Show all 9" shows the rest. The rows
 * come from the account's one read of its name transactions (NamesTab);
 * nothing is read here. `txs` undefined: that read hasn't come back (the
 * tab says so once, under the names).
 */
import { useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import type { TxRow } from '../../../../data/types';
import { describeTx } from '../../../../rules/explorer/txWords';
import { visibleName } from '../../../../rules/explorer/nameNotes';
import { formatBlock, formatCount, formatDate } from '../../../../utils/format';

/** Entries shown before "Show all". */
export const HISTORY_SHOWN = 4;

function HistoryRow({ tx, address }: { tx: TxRow; address: string }) {
  const words = describeTx(tx, { viewpoint: address });
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        py: 0.5,
        minWidth: 0,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0, pt: 0 },
      }}
    >
      <Typography sx={{ fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
        <TxSentence parts={words.parts} />
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {formatDate(tx.timestamp)}
        {typeof tx.blockHeight === 'number' ? ` · ${formatBlock(tx.blockHeight)}` : ''}
      </Typography>
    </Box>
  );
}

export function NameHistoryList({
  name,
  txs,
  address,
}: {
  name: string;
  txs: readonly TxRow[] | undefined;
  address: string;
}) {
  const [all, setAll] = useState(false);
  const label = (
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 0.2 }}>
      History{txs && txs.length ? ` · ${formatCount(txs.length)}` : ''}
    </Typography>
  );
  if (txs === undefined)
    return (
      <Box sx={{ minWidth: 0 }}>
        {label}
        <Skeleton variant="text" width="80%" aria-hidden />
        <Skeleton variant="text" width="45%" aria-hidden />
      </Box>
    );
  if (!txs.length)
    return (
      <Box sx={{ minWidth: 0 }}>
        {label}
        <Typography variant="body2" color="text.secondary">
          None found in its name transactions.
        </Typography>
      </Box>
    );
  const shown = all ? txs : txs.slice(0, HISTORY_SHOWN);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      {label}
      <Box
        component="ul"
        aria-label={`The history of “${visibleName(name)}”`}
        sx={{ listStyle: 'none', m: 0, p: 0, minWidth: 0 }}
      >
        {shown.map((tx) => (
          <HistoryRow key={tx.signature} tx={tx} address={address} />
        ))}
      </Box>
      {txs.length > shown.length ? (
        <Button
          onClick={() => setAll(true)}
          sx={{ alignSelf: 'flex-start', minHeight: 44, px: 1, ml: -1 }}
        >
          Show all {formatCount(txs.length)}{' '}
          <Box component="span" sx={visuallyHidden}>
            {`of “${visibleName(name)}”`}
          </Box>
        </Button>
      ) : null}
    </Box>
  );
}
