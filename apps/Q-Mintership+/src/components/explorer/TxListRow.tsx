/**
 * One transaction in a list: a single button (its family's icon, the
 * sentence, when and in which block) that opens to its details in plain
 * words (TxFields), the accounts involved (Explorer links where the page
 * links people there) and "Open transaction". The sentence inside the
 * button is plain text (TxSentence plain: no link inside a button); the
 * links are in the panel it opens.
 *
 * Names in the sentence are looked up once the row nears the screen, so a
 * long list doesn't read every counterparty's name at once; until then the
 * sentence names accounts by their short address.
 *
 * A message never shows its content, an encrypted QDN resource never its
 * identifier (rules/explorer/txWords.ts leaves both out), and the fields
 * only a transaction's raw data carries never show here.
 */
import { useId, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Card } from '../common/Section';
import { ExpandChevron } from '../common/ExpandChevron';
import { SmoothReveal } from '../common/SmoothReveal';
import { usePersonLinks } from '../common/personLinks';
import type { TxRow } from '../../data/types';
import { useInView } from '../../hooks/useInView';
import { explorerTxPath } from '../../routes/paths';
import { formatCount, formatDateTime, formatRelative } from '../../utils/format';
import { TxFields, TxPeople } from './TxFields';
import { TxIcon } from './TxIcon';
import { TxSentence } from './TxSentence';
import { useTxWords } from './useTxWords';

const NOWRAP = { whiteSpace: 'nowrap' } as const;

/**
 * When it happened: "12 Oct 2026, 14:33 · block 2,757,497", or that it
 * waits for a block. Each half stays on one line.
 */
function When({ tx }: { tx: TxRow }) {
  if (typeof tx.blockHeight !== 'number')
    return (
      <>
        <span style={NOWRAP}>Waiting to be confirmed</span> ·{' '}
        <span style={NOWRAP}>sent {formatRelative(tx.timestamp)}</span>
      </>
    );
  return (
    <>
      <span style={NOWRAP}>{formatDateTime(tx.timestamp)}</span> ·{' '}
      <span style={NOWRAP}>block {formatCount(tx.blockHeight)}</span>
    </>
  );
}

export interface TxListRowProps {
  tx: TxRow;
  /**
   * The account whose list this is (an address search for it): sentences
   * are told from it ("Sent", "Received"). None on Transactions on Qortal.
   */
  viewpoint?: string | null;
}

export function TxListRow({ tx, viewpoint = null }: TxListRowProps) {
  const [open, setOpen] = useState(false);
  const words = useTxWords(tx, viewpoint);
  const links = usePersonLinks();
  const panelId = useId();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node, '200px');
  const maker = words.participants[0] ?? null;

  return (
    <Box ref={setNode} sx={{ minWidth: 0 }}>
      <ButtonBase
        data-tx-row=""
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        sx={{
          width: '100%',
          minHeight: 56,
          px: { xs: 1.25, sm: 1.5 },
          py: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          gap: 1.5,
          textAlign: 'left',
          borderRadius: 1,
          font: 'inherit',
          color: 'text.primary',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Box component="span" sx={{ pt: 0.25, display: 'flex' }}>
          <TxIcon type={tx.type} />
        </Box>
        <Box component="span" sx={{ flex: 1, minWidth: 0, display: 'block' }}>
          <Typography
            component="span"
            sx={{ display: 'block', fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere' }}
          >
            {near ? <TxSentence parts={words.parts} plain /> : words.plain}
          </Typography>
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25 }}
          >
            <When tx={tx} />
          </Typography>
        </Box>
        <Box component="span" sx={{ pt: 0.25, display: 'flex', color: 'text.secondary' }}>
          <ExpandChevron open={open} />
        </Box>
      </ButtonBase>
      <SmoothReveal open={open}>
        <Box
          id={panelId}
          sx={{
            px: { xs: 1.25, sm: 1.5 },
            pb: 1.5,
            pt: 0.5,
            pl: { xs: 1.25, sm: 6 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            minWidth: 0,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {words.title}
          </Typography>
          <TxFields fields={words.fields} label={`${words.title} details`} />
          <TxPeople addresses={words.participants} maker={maker} />
          <Button
            component={RouterLink}
            to={explorerTxPath(tx.signature)}
            state={links.state}
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon />}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            Open transaction
          </Button>
        </Box>
      </SmoothReveal>
    </Box>
  );
}

/** A list of transactions, newest first, in a card, one TxListRow each. */
export function TxList({
  rows,
  viewpoint = null,
  label,
}: {
  rows: TxRow[];
  viewpoint?: string | null;
  label: string;
}) {
  return (
    <Card sx={{ p: 0 }}>
      <Box
        component="ul"
        aria-label={label}
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0.5,
          '& > li + li': { borderTop: 1, borderColor: 'divider' },
        }}
      >
        {rows.map((tx) => (
          <li key={tx.signature}>
            <TxListRow tx={tx} viewpoint={viewpoint} />
          </li>
        ))}
      </Box>
    </Card>
  );
}
