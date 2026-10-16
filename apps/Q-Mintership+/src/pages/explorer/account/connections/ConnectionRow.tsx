/**
 * One connection: the other account (its name links to its account in the
 * Explorer, with its MINTER mark and other plain tags), what happened in a
 * sentence, and when. Beside it, two separate 44 px controls: the evidence
 * toggle ("4 payments") that opens the transactions behind it, each a
 * sentence with its date and block linking to the transaction, and Compare,
 * which picks both accounts and opens them side by side.
 *
 * The sentence is plain text (the name above is the link), and the
 * expanding part sits outside the toggle, so no control holds another.
 */
import { useId, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, IconButton, Link, Tooltip, Typography } from '@mui/material';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import { ExpandChevron } from '../../../../components/common/ExpandChevron';
import { PersonChip } from '../../../../components/common/Person';
import { SmoothReveal } from '../../../../components/common/SmoothReveal';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import { getTx } from '../../../../data/explorer/account';
import type { TxRow } from '../../../../data/types';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { useQuery } from '../../../../hooks/useQuery';
import { explorerAccountPath, explorerComparePath, explorerTxPath } from '../../../../routes/paths';
import { describeTx, type TxPart } from '../../../../rules/explorer/txWords';
import { addPick } from '../../../../state/explorer';
import { formatCount, formatDate, shortAddress } from '../../../../utils/format';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from '../names/useShowMore';

/** Evidence lines shown before "Show all". */
const EVIDENCE_ROWS = 20;

export const ROW_LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
} as const;

function EvidenceLine({
  tx,
  viewpoint,
  privsRecipient,
}: {
  tx: TxRow;
  viewpoint: string;
  privsRecipient?: string | null;
}) {
  const words = describeTx(tx, { viewpoint, privsRecipient });
  const height = tx.blockHeight;
  return (
    <Box component="li" tabIndex={-1} sx={{ minWidth: 0, ...FOCUSABLE_ROW_SX }}>
      {/* A div: the people in the sentence are chips. */}
      <Typography component="div" variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        <TxSentence parts={words.parts} />
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 0.75 }}
      >
        <span>{formatDate(tx.timestamp)}</span>
        <span aria-hidden>·</span>
        <Link
          component={RouterLink}
          to={explorerTxPath(tx.signature)}
          aria-label={`Open transaction ${tx.signature.slice(0, 8)}${
            typeof height === 'number' ? `, block ${formatCount(height)}` : ''
          }`}
          sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
        >
          {typeof height === 'number' ? `block ${formatCount(height)}` : 'waiting'}
        </Link>
      </Typography>
    </Box>
  );
}

/** The transactions behind a connection, newest first. */
export function EvidenceList({
  txs,
  viewpoint,
  privs,
}: {
  txs: readonly TxRow[];
  viewpoint: string;
  privs?: Readonly<Record<string, string | null>>;
}) {
  const [all, setAll] = useState(false);
  const { listRef, focusFrom } = useFocusNewRows();
  const shown = all ? txs : txs.slice(0, EVIDENCE_ROWS);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        mt: 0.5,
        pl: 1.5,
        borderLeft: 2,
        borderColor: 'divider',
      }}
    >
      <Box component="ul" ref={listRef} sx={{ ...ROW_LIST_SX, gap: 0.5 }}>
        {shown.map((tx) => (
          <EvidenceLine
            key={tx.signature}
            tx={tx}
            viewpoint={viewpoint}
            privsRecipient={privs?.[tx.signature]}
          />
        ))}
      </Box>
      {txs.length > shown.length ? (
        <Button
          onClick={() => {
            focusFrom(EVIDENCE_ROWS);
            setAll(true);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show all {formatCount(txs.length)}
        </Button>
      ) : null}
    </Box>
  );
}

/** One transaction read by its signature (a first payment, shown on request). */
function EvidenceBySignature({ signature, viewpoint }: { signature: string; viewpoint: string }) {
  const tx = useQuery(`xtxsig:${signature}`, (force) => getTx(signature, { force }));
  if (tx.isError && tx.data === undefined)
    return (
      <ErrorState
        compact
        title="Couldn’t load this transaction."
        error={tx.error}
        onRetry={() => void tx.refetch()}
      />
    );
  if (tx.data === undefined) return <ListSkeleton count={1} label="Loading the transaction" />;
  return <EvidenceList txs={tx.data ? [tx.data] : []} viewpoint={viewpoint} />;
}

/** "Compare" for a pair: both picked, then both side by side. */
export function CompareButton({
  address,
  accountLabel,
  other,
  otherLabel,
}: {
  address: string;
  accountLabel: string;
  other: string;
  otherLabel: string;
}) {
  const navigate = useNavigate();
  const label = `Compare ${accountLabel} with ${otherLabel}`;
  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={() => {
          addPick(address);
          addPick(other);
          navigate(explorerComparePath([address, other]));
        }}
        sx={{ width: 44, height: 44, flexShrink: 0 }}
      >
        <CompareArrowsOutlinedIcon />
      </IconButton>
    </Tooltip>
  );
}

/** An AT address as a link to its own page (no name, not a person). */
export function AtLink({ address }: { address: string }) {
  return (
    <Link
      component={RouterLink}
      to={explorerAccountPath(address)}
      state={{ via: 'explorer' }}
      aria-label={`AT ${shortAddress(address)}: explore this automated contract`}
      sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontWeight: 600 }}
    >
      AT (automated contract) {shortAddress(address)}
    </Link>
  );
}

export interface ConnectionRowProps {
  /** The account whose page this is. */
  address: string;
  accountLabel: string;
  /** The other account (an AT's address is shown as an AT). */
  other: string;
  /** What happened, with the other account in it. */
  parts: TxPart[];
  /** "12 Mar 2025 · block 1,371,641". */
  when: string;
  /** Plain tags under the name: "MINTER member", "its sponsor", "has sent 500+ payments". */
  tags?: ReadonlyArray<string | null | false | undefined>;
  /** The transactions behind it, or the signature of the one to read. */
  evidence?: { words: string; txs?: readonly TxRow[]; signature?: string };
  privs?: Readonly<Record<string, string | null>>;
  /** Something more under the sentence (a link). */
  extra?: ReactNode;
}

export function ConnectionRow({
  address,
  accountLabel,
  other,
  parts,
  when,
  tags,
  evidence,
  privs,
  extra,
}: ConnectionRowProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const isAt = other.startsWith('A');
  const otherLabel = useDisplayName(other, isAt ? null : undefined).label;
  const shownTags = (tags ?? []).filter((tag): tag is string => Boolean(tag));
  const secondary = shownTags.length ? shownTags.join(' · ') : undefined;
  return (
    <Box component="li" tabIndex={-1} sx={{ minWidth: 0, ...FOCUSABLE_ROW_SX }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {isAt ? (
            <AtLink address={other} />
          ) : (
            <PersonChip address={other} size={32} secondary={secondary} />
          )}
          <Typography sx={{ overflowWrap: 'anywhere' }}>
            <TxSentence parts={parts} plain />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {when}
          </Typography>
          {extra}
          {evidence && evidence.words ? (
            <Button
              size="small"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={id}
              aria-label={`Show the ${evidence.words} with ${otherLabel}`}
              endIcon={<ExpandChevron open={open} />}
              sx={{ alignSelf: 'flex-start', minHeight: 44, fontSize: 14, px: 1, ml: -1 }}
            >
              {evidence.words}
            </Button>
          ) : null}
        </Box>
        {isAt ? null : (
          <CompareButton
            address={address}
            accountLabel={accountLabel}
            other={other}
            otherLabel={otherLabel}
          />
        )}
      </Box>
      {evidence ? (
        <Box id={id}>
          <SmoothReveal open={open}>
            {evidence.txs ? (
              <EvidenceList txs={evidence.txs} viewpoint={address} privs={privs} />
            ) : evidence.signature ? (
              <EvidenceBySignature signature={evidence.signature} viewpoint={address} />
            ) : null}
          </SmoothReveal>
        </Box>
      ) : null}
    </Box>
  );
}
