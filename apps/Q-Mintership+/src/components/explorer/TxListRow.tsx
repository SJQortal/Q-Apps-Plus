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
 * The details end with "Raw API response", which opens to the
 * transaction's JSON as Core sent it (components/explorer/RawJson.tsx),
 * right there in the list.
 *
 * A message never shows its content, an encrypted QDN resource never its
 * identifier (rules/explorer/txWords.ts and rawTx.ts leave both out), and
 * the fields only a transaction's raw response carries show only there.
 */
import { useId, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { Card } from '../common/Section';
import { CHEVRON_TURN } from '../common/ExpandChevron';
import { SmoothReveal } from '../common/SmoothReveal';
import { usePersonLinks } from '../common/personLinks';
import type { TxRow } from '../../data/types';
import { useInView } from '../../hooks/useInView';
import { explorerTxPath } from '../../routes/paths';
import { formatCount, formatDateTime, formatRelative } from '../../utils/format';
import { RawResponse } from './RawJson';
import { TxFields, TxPeople } from './TxFields';
import { TxIcon } from './TxIcon';
import { TX_FAMILIES, txFamilyAccent } from './txFamilyAccent';
import { familyOf } from '../../rules/explorer/txFamilies';
import { TxSentence } from './TxSentence';
import { useTxWords } from './useTxWords';

const NOWRAP = { whiteSpace: 'nowrap' } as const;

// The closed row's parts, styled once: a list shows 50 rows, so each row is
// a plain button and spans (no per-row sx, ripple or focus tracking).
const RowButton = styled('button')(({ theme }) => ({
  width: '100%',
  minHeight: 56,
  margin: 0,
  border: 0,
  padding: theme.spacing(1, 1.25),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(1, 1.5) },
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  gap: theme.spacing(1.5),
  textAlign: 'left',
  borderRadius: theme.shape.borderRadius,
  background: 'none',
  cursor: 'pointer',
  font: 'inherit',
  color: theme.palette.text.primary,
  WebkitTapHighlightColor: 'transparent',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
  // The chevron turns over as the row opens (ExpandChevron's turn).
  '& [data-chevron]': { transition: CHEVRON_TURN },
  '&[aria-expanded="true"] [data-chevron]': { transform: 'rotate(180deg)' },
}));
// The family's icon in a soft circle of its colour (txFamilyAccent), one rule per family.
const Slot = styled('span')(({ theme }) => ({
  width: 34,
  height: 34,
  flexShrink: 0,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
  '& > svg': { fontSize: 20 },
  ...Object.fromEntries(
    TX_FAMILIES.map((family) => {
      const accent = txFamilyAccent(theme, family);
      return [
        `&[data-family="${family}"]`,
        {
          color: accent,
          backgroundColor: alpha(accent, theme.palette.mode === 'dark' ? 0.16 : 0.12),
        },
      ];
    })
  ),
}));
const Lines = styled('span')({ flex: 1, minWidth: 0, display: 'block' });
const SentenceLine = styled('span')({
  display: 'block',
  fontSize: 15,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
});
const WhenLine = styled('span')(({ theme }) => ({
  ...theme.typography.body2,
  display: 'block',
  marginTop: 2,
  color: theme.palette.text.secondary,
}));
const Row = styled('div')({ minWidth: 0 });

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
    <Row ref={setNode}>
      <RowButton
        type="button"
        data-tx-row=""
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        <Slot data-family={familyOf(tx.type)}>
          <TxIcon type={tx.type} />
        </Slot>
        <Lines>
          <SentenceLine>
            {near ? <TxSentence parts={words.parts} plain /> : words.plain}
          </SentenceLine>
          <WhenLine>
            <When tx={tx} />
          </WhenLine>
        </Lines>
        <Slot>
          <ExpandMoreOutlinedIcon aria-hidden data-chevron="" />
        </Slot>
      </RowButton>
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
          <RawResponse
            tx={tx}
            before={
              <Button
                component={RouterLink}
                to={explorerTxPath(tx.signature)}
                state={links.state}
                variant="outlined"
                endIcon={<OpenInNewOutlinedIcon />}
                sx={{ minHeight: 44 }}
              >
                Open transaction
              </Button>
            }
          />
        </Box>
      </SmoothReveal>
    </Row>
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
