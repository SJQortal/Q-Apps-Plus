/**
 * A name's own history, behind a toggle on its row: "History · 3" opens
 * the account's transactions about that name, newest first, each as a
 * sentence told from this account ("Sold the name “Spare Room” to Nora for
 * 5 QORT") with its date and block. The rows come from the account's one
 * read of its name transactions (NamesTab); nothing is read here.
 */
import { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ExpandChevron } from '../../../../components/common/ExpandChevron';
import { SmoothReveal } from '../../../../components/common/SmoothReveal';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import type { TxRow } from '../../../../data/types';
import { describeTx } from '../../../../rules/explorer/txWords';
import { visibleName } from '../../../../rules/explorer/nameNotes';
import { formatBlock, formatDate } from '../../../../utils/format';

function HistoryRow({ tx, address }: { tx: TxRow; address: string }) {
  const words = describeTx(tx, { viewpoint: address });
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        py: 0.75,
        borderTop: 1,
        borderColor: 'divider',
        minWidth: 0,
        '&:first-of-type': { borderTop: 0 },
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

export function NameHistoryToggle({
  name,
  txs,
  address,
}: {
  name: string;
  txs: readonly TxRow[];
  address: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const count = txs.length;
  return (
    <>
      <Button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${open ? 'Hide' : 'Show'} the history of “${visibleName(name)}” (${count} ${count === 1 ? 'transaction' : 'transactions'})`}
        endIcon={<ExpandChevron open={open} />}
        sx={{ alignSelf: 'flex-start', minHeight: 44, fontSize: 14, px: 1, ml: -1 }}
      >
        History · {count}
      </Button>
      <Box id={id}>
        <SmoothReveal open={open}>
          <Box
            component="ul"
            aria-label={`The history of “${visibleName(name)}”`}
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              pl: 1.5,
              borderLeft: 2,
              borderColor: 'divider',
            }}
          >
            {txs.map((tx) => (
              <HistoryRow key={tx.signature} tx={tx} address={address} />
            ))}
          </Box>
        </SmoothReveal>
      </Box>
    </>
  );
}
