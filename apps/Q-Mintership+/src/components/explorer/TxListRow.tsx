/**
 * One transaction in a list: its family's icon, the sentence, when and in
 * which block, over a single button that opens it to its details in plain
 * words (TxFields), the accounts involved (Explorer links where the page
 * links people there) and "Open transaction". A press anywhere on the row
 * opens it, except on an account, a name or a transaction in the sentence
 * (Simon, 2026-10-17: "whenever there is a name … click that name to go
 * into it"): those are links (TxSentence quiet), left out of the Tab
 * order, since the panel the row opens has the same links for the
 * keyboard. The button is named by the row's words, which screen readers
 * read once, as the button.
 *
 * Names in the sentence are looked up once the row nears the screen, so a
 * long list doesn't read every counterparty's name at once; until then the
 * sentence names accounts by their short address.
 *
 * The details end with "Raw API response", which opens to the
 * transaction's JSON as Core sent it (components/explorer/RawJson.tsx),
 * right there in the list; a public QDN publish also has Open File and
 * Save File (file/QdnFileButtons.tsx).
 *
 * A message never shows its content, an encrypted QDN resource never its
 * identifier (rules/explorer/txWords.ts and rawTx.ts leave both out), and
 * the fields only a transaction's raw response carries show only there.
 *
 * Consecutive alike transactions (rules/explorer/alikeRuns.ts: rows that
 * would say the very same thing) are one row, "×6", that opens to each of
 * them as a row of its own (TxRows). A list's top rows carry `data-tx-top`, for
 * the focus to land on the first new one after "Show older". A search's
 * row can carry a hint under its time (why it was found: "YT-LinQ holds
 * the name “Simon Dixon”").
 */
import { useId, useMemo, useState } from 'react';
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
import { formatCount, formatDateTime, formatRelative, formatTimeSpan } from '../../utils/format';
import { RawResponse } from './RawJson';
import { TxFields, TxPeople } from './TxFields';
import { TxIcon } from './TxIcon';
import { DirectionMark } from './DirectionMark';
import { directionRules } from './directionTone';
import { TX_FAMILIES, txFamilyAccent } from './txFamilyAccent';
import { familyOf } from '../../rules/explorer/txFamilies';
import { alikeRuns } from '../../rules/explorer/alikeRuns';
import { TxSentence } from './TxSentence';
import { QdnFileButtons } from './file/QdnFileButtons';
import { useTxWords } from './useTxWords';
import { useViewState } from '../../hooks/useViewState';

const NOWRAP = { whiteSpace: 'nowrap' } as const;

// The closed row's parts, styled once: a list shows 50 rows, so each row is
// a plain button and spans (no per-row sx, ripple or focus tracking).
// The row's head: its words over the button that opens it. The words let
// presses through to the button, except on their links (TxSentence quiet).
const Head = styled('div')(({ theme }) => ({
  position: 'relative',
  minHeight: 56,
  padding: theme.spacing(1, 1.25),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(1, 1.5) },
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.primary,
  '& > :not(button)': { position: 'relative', pointerEvents: 'none' },
  '&:hover': { backgroundColor: theme.palette.action.hover },
  // The chevron turns over as the row opens (ExpandChevron's turn).
  '& [data-chevron]': { transition: CHEVRON_TURN },
  '&[data-open] [data-chevron]': { transform: 'rotate(180deg)' },
  // Incoming amounts green, outgoing red (the row's data-direction).
  ...directionRules(theme),
}));
// The button under the head's words: the whole head opens the row.
const RowButton = styled('button')(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  margin: 0,
  border: 0,
  padding: 0,
  borderRadius: theme.shape.borderRadius,
  background: 'none',
  cursor: 'pointer',
  font: 'inherit',
  WebkitTapHighlightColor: 'transparent',
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
}));
// The family's icon in a soft circle of its colour (txFamilyAccent), one rule per family.
const Slot = styled('span')(({ theme }) => ({
  position: 'relative',
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
// Why a search found the row, under its time.
const HintLine = styled('span')(({ theme }) => ({
  ...theme.typography.body2,
  display: 'block',
  marginTop: 2,
  color: theme.palette.text.secondary,
  fontStyle: 'italic',
  overflowWrap: 'anywhere',
}));
// How many alike transactions a row stands for: "×6".
const Count = styled('span')(({ theme }) => ({
  ...theme.typography.body2,
  fontWeight: 700,
  padding: theme.spacing(0.25, 0.75),
  borderRadius: 999,
  color: theme.palette.text.primary,
  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.12),
  whiteSpace: 'nowrap',
  alignSelf: 'center',
}));

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
  /** A row of the list itself (true), not one inside a run of alike ones. */
  top?: boolean;
  /** Why a search found it, under its time. */
  hint?: string | null;
}

export function TxListRow({ tx, viewpoint = null, top = true, hint = null }: TxListRowProps) {
  // Kept for Back (useViewState): a row inside a run apart from the same one on its own.
  const [open, setOpen] = useViewState(`tx:${tx.signature}${top ? '' : ':run'}`, false);
  const words = useTxWords(tx, viewpoint);
  const links = usePersonLinks();
  const panelId = useId();
  const labelId = useId();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node, '200px');
  const maker = words.participants[0] ?? null;
  // Which way it went from the list's account: incoming green, outgoing red.
  const flow = words.direction === 'in' || words.direction === 'out' ? words.direction : null;

  return (
    <Row ref={setNode}>
      <Head data-direction={flow ?? undefined} data-open={open ? '' : undefined}>
        <RowButton
          type="button"
          data-tx-row=""
          data-tx-top={top ? '' : undefined}
          data-direction={flow ?? undefined}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-labelledby={`${labelId}-mark ${labelId}-words`}
        />
        <Slot id={`${labelId}-mark`} aria-hidden data-family={familyOf(tx.type)}>
          <TxIcon type={tx.type} />
          {flow ? <DirectionMark flow={flow} badge /> : null}
        </Slot>
        <Lines id={`${labelId}-words`} aria-hidden>
          <SentenceLine>
            {near ? <TxSentence parts={words.parts} quiet /> : words.plain}
          </SentenceLine>
          <WhenLine>
            <When tx={tx} />
          </WhenLine>
          {hint ? <HintLine>{hint}</HintLine> : null}
        </Lines>
        <Slot aria-hidden>
          <ExpandMoreOutlinedIcon data-chevron="" />
        </Slot>
      </Head>
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
          <TxFields fields={words.fields} label={`${words.title} details`} viewId={tx.signature} />
          <TxPeople addresses={words.participants} maker={maker} viewId={tx.signature} />
          <RawResponse
            tx={tx}
            before={
              <>
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
                {/* A public QDN publish: its file, shown here or saved (Simon, 2026-10-17). */}
                <QdnFileButtons tx={tx} />
              </>
            }
          />
        </Box>
      </SmoothReveal>
    </Row>
  );
}

/** Where a run of alike transactions is: one block, or from one to another, with the dates. */
function runSpan(rows: readonly TxRow[]) {
  const heights = rows.map((row) => row.blockHeight ?? 0);
  const times = rows.map((row) => row.timestamp);
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  return {
    oneBlock: low === high,
    low,
    high,
    dates: formatTimeSpan(Math.min(...times), Math.max(...times)),
  };
}

/** Alike transactions as one row: the sentence once, "×6", opening to each of them. */
function TxRunRow({
  rows,
  viewpoint,
  hint = null,
}: {
  rows: TxRow[];
  viewpoint: string | null;
  hint?: string | null;
}) {
  const [open, setOpen] = useViewState(`run:${rows[0].signature}`, false);
  const tx = rows[0];
  const span = runSpan(rows);
  const words = useTxWords(tx, viewpoint);
  const panelId = useId();
  const labelId = useId();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node, '200px');
  const flow = words.direction === 'in' || words.direction === 'out' ? words.direction : null;
  return (
    <Row ref={setNode}>
      <Head data-direction={flow ?? undefined} data-open={open ? '' : undefined}>
        <RowButton
          type="button"
          data-tx-row=""
          data-tx-top=""
          data-direction={flow ?? undefined}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-labelledby={`${labelId}-mark ${labelId}-words`}
        />
        <Slot id={`${labelId}-mark`} aria-hidden data-family={familyOf(tx.type)}>
          <TxIcon type={tx.type} />
          {flow ? <DirectionMark flow={flow} badge /> : null}
        </Slot>
        <Lines id={`${labelId}-words`} aria-hidden>
          <SentenceLine>
            {near ? <TxSentence parts={words.parts} quiet /> : words.plain}
          </SentenceLine>
          <WhenLine>
            <span style={NOWRAP}>{formatCount(rows.length)} times</span> ·{' '}
            {span.oneBlock ? (
              <When tx={tx} />
            ) : (
              <>
                <span style={NOWRAP}>{span.dates}</span> ·{' '}
                <span style={NOWRAP}>
                  blocks {formatCount(span.low)}–{formatCount(span.high)}
                </span>
              </>
            )}
          </WhenLine>
          {hint ? <HintLine>{hint}</HintLine> : null}
        </Lines>
        <Count aria-hidden>×{formatCount(rows.length)}</Count>
        <Slot aria-hidden>
          <ExpandMoreOutlinedIcon data-chevron="" />
        </Slot>
      </Head>
      <SmoothReveal open={open}>
        <Box
          id={panelId}
          sx={{
            pb: 1,
            pl: { xs: 1.25, sm: 6 },
            pr: { xs: 0.5, sm: 1 },
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            minWidth: 0,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            {span.oneBlock
              ? `The same ${words.title.toLowerCase()}, ${formatCount(rows.length)} times in block ${formatCount(span.low)}.`
              : `The same ${words.title.toLowerCase()}, ${formatCount(rows.length)} times between blocks ${formatCount(span.low)} and ${formatCount(span.high)}.`}{' '}
            Each is a transaction of its own:
          </Typography>
          <Box
            component="ul"
            aria-label={`${formatCount(rows.length)} transactions like this`}
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              pl: 1,
              borderLeft: 2,
              borderColor: 'divider',
              '& > li + li': { borderTop: 1, borderColor: 'divider' },
            }}
          >
            {rows.map((row) => (
              <li key={row.signature}>
                <TxListRow tx={row} viewpoint={viewpoint} top={false} />
              </li>
            ))}
          </Box>
        </Box>
      </SmoothReveal>
    </Row>
  );
}

/** Rows as list items: one each, or one for a run of alike transactions. */
export function TxRows({
  rows,
  viewpoint = null,
  hintOf,
}: {
  rows: TxRow[];
  viewpoint?: string | null;
  /** Why a search found a row (shown under its time), if it says. */
  hintOf?: (tx: TxRow) => string | null;
}) {
  const runs = useMemo(() => alikeRuns(rows, viewpoint), [rows, viewpoint]);
  return (
    <>
      {runs.map((run) => (
        <li key={run[0].signature}>
          {run.length > 1 ? (
            <TxRunRow rows={run} viewpoint={viewpoint} hint={hintOf?.(run[0]) ?? null} />
          ) : (
            <TxListRow tx={run[0]} viewpoint={viewpoint} hint={hintOf?.(run[0]) ?? null} />
          )}
        </li>
      ))}
    </>
  );
}

/** A list of transactions, newest first, in a card: a row each, alike ones as one. */
export function TxList({
  rows,
  viewpoint = null,
  label,
  hintOf,
}: {
  rows: TxRow[];
  viewpoint?: string | null;
  label: string;
  /** Why a search found a row (shown under its time), if it says. */
  hintOf?: (tx: TxRow) => string | null;
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
        <TxRows rows={rows} viewpoint={viewpoint} hintOf={hintOf} />
      </Box>
    </Card>
  );
}
