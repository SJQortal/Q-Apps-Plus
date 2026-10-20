/**
 * One connection: the other account (its name links to its account in the
 * Explorer, with its MINTER mark and other plain tags), what happened in a
 * sentence, and when. On the right, two separate 44 px controls: Compare,
 * beside the name, which picks both accounts and opens them side by side
 * (when Compare has no room for both, it says so and picks neither), and,
 * on the line of when, the evidence toggle ("4 payments") that opens the
 * transactions behind it, each a sentence with its date and block linking
 * to the transaction.
 *
 * The sentence is plain text (the name above is the link), and the
 * expanding part sits outside the toggle, so no control holds another.
 */
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { AnchoredNote } from '../../../../components/common/AnchoredNote';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import { ExpandChevron } from '../../../../components/common/ExpandChevron';
import { PersonChip } from '../../../../components/common/Person';
import { SmoothReveal } from '../../../../components/common/SmoothReveal';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { TxListRow } from '../../../../components/explorer/TxListRow';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import { getTx } from '../../../../data/explorer/account';
import { peekQuery, setQueryData } from '../../../../data/query';
import type { TxRow } from '../../../../data/types';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { useQuery } from '../../../../hooks/useQuery';
import { explorerAccountPath, explorerComparePath } from '../../../../routes/paths';
import type { TxPart } from '../../../../rules/explorer/txWords';
import { addPick, COMPARE_FULL, COMPARE_MAX, useComparePicks } from '../../../../state/explorer';
import { formatCount, shortAddress } from '../../../../utils/format';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from '../names/useShowMore';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { StatusChip } from '../../../../components/explorer/StatusChip';
import { DirectionMark } from '../../../../components/explorer/DirectionMark';
import { directionRules, type Flow } from '../../../../components/explorer/directionTone';
import { statusKindOf } from '../../../../components/explorer/statusKinds';
import { useViewState } from '../../../../hooks/useViewState';

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

/**
 * The transactions behind a connection, newest first, each a transaction
 * row of the Explorer's lists (TxListRow: its details, the accounts in it,
 * Open transaction, its raw response; Simon, 2026-10-20: "when expanded I
 * want to see more details like the transactions details and buttons to
 * open the transaction"). One alone opens to its details at once. What the
 * links read already says about a minting level's recipient (`privs`) is
 * kept where the rows look it up, so they read nothing more.
 */
export function EvidenceList({
  txs,
  viewpoint,
  privs,
}: {
  txs: readonly TxRow[];
  viewpoint: string;
  privs?: Readonly<Record<string, string | null>>;
}) {
  useMemo(() => {
    for (const [signature, recipient] of Object.entries(privs ?? {}))
      if (peekQuery(`xprivs:${signature}`) === undefined)
        setQueryData(`xprivs:${signature}`, recipient);
  }, [privs]);
  // Kept for Back (useViewState), by the newest transaction listed.
  const [all, setAll] = useViewState(`evidence:${txs[0]?.signature ?? ''}`, false);
  const { listRef, focusFrom } = useFocusNewRows();
  const shown = all ? txs : txs.slice(0, EVIDENCE_ROWS);
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        mt: 0.5,
        borderLeft: 2,
        borderColor: 'divider',
      }}
    >
      <Box
        component="ul"
        ref={listRef}
        sx={{ ...ROW_LIST_SX, gap: 0, '& > li + li': { borderTop: 1, borderColor: 'divider' } }}
      >
        {shown.map((tx) => (
          <Box component="li" key={tx.signature} tabIndex={-1} sx={FOCUSABLE_ROW_SX}>
            <TxListRow tx={tx} viewpoint={viewpoint} initiallyOpen={txs.length === 1} />
          </Box>
        ))}
      </Box>
      {txs.length > shown.length ? (
        <Button
          onClick={() => {
            focusFrom(EVIDENCE_ROWS);
            setAll(true);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44, ml: 1 }}
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

/**
 * "Compare" for a pair: both picked, then both side by side. Both or
 * neither: when Compare has no room for both, a message says so.
 */
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
  const picks = useComparePicks();
  const [full, setFull] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const label = `Compare ${accountLabel} with ${otherLabel}`;
  const compare = () => {
    const missing = [address, other].filter((who) => !picks.includes(who));
    if (picks.length + missing.length > COMPARE_MAX) {
      setFull(true);
      return;
    }
    for (const who of missing) addPick(who);
    navigate(explorerComparePath([address, other]));
  };
  return (
    <>
      <Tooltip title={label}>
        <IconButton
          ref={setAnchor}
          aria-label={label}
          onClick={compare}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <CompareArrowsOutlinedIcon />
        </IconButton>
      </Tooltip>
      <AnchoredNote anchor={anchor} open={full} onClose={() => setFull(false)}>
        {COMPARE_FULL}
      </AnchoredNote>
    </>
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
  /** Payments one way: incoming (received from it) green, outgoing (sent to it) red. */
  flow?: Flow;
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
  flow,
}: ConnectionRowProps) {
  // Kept for Back (useViewState): one per account and what links them.
  const [open, setOpen] = useViewState(
    `connection:${other}:${flow ?? ''}:${evidence?.txs?.[0]?.signature ?? ''}`,
    false
  );
  const id = useId();
  const isAt = other.startsWith('A');
  const otherLabel = useDisplayName(other, isAt ? null : undefined).label;
  const shownTags = (tags ?? []).filter((tag): tag is string => Boolean(tag));
  // MINTER marks as status chips (in colour); the other tags as words after them.
  const marks = shownTags.filter((tag) => statusKindOf(tag) !== 'plain');
  const words = shownTags.filter((tag) => statusKindOf(tag) === 'plain');
  const secondary = shownTags.length ? (
    <Box
      component="span"
      sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.25 }}
    >
      {marks.map((mark) => (
        <StatusChip key={mark} label={mark} />
      ))}
      {words.length ? <span>{words.join(' · ')}</span> : null}
    </Box>
  ) : undefined;
  return (
    // Each connection on a panel of its own (fieldBlock.ts).
    <Box component="li" tabIndex={-1} sx={{ ...FIELD_BLOCK_SX, ...FOCUSABLE_ROW_SX }}>
      {/*
       * Two columns: who on the left with Compare beside it; under them what
       * happened, with when right after it (Simon, 2026-10-20: "the block
       * number can be moved to the right of the payment text so the view is
       * more compressed"), and the evidence toggle at its right (Simon,
       * 2026-10-20: "this expand button could be to the right of the list").
       * Compare comes last in the reading order, as before.
       */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          columnGap: 1,
          rowGap: 0.25,
          alignItems: 'center',
        }}
      >
        <Box sx={{ gridColumn: 1, gridRow: 1, alignSelf: 'start', minWidth: 0 }}>
          {isAt ? (
            <AtLink address={other} />
          ) : (
            <PersonChip address={other} size={32} secondary={secondary} />
          )}
        </Box>
        <Typography
          data-direction={flow}
          sx={(theme) => ({
            gridColumn: 1,
            gridRow: 2,
            minWidth: 0,
            overflowWrap: 'anywhere',
            ...directionRules(theme),
          })}
        >
          {flow ? <DirectionMark flow={flow} /> : null}
          {/* Its accounts and names open on a press, and from the keyboard too. */}
          <TxSentence parts={parts} quiet tabbable />
          {when ? (
            <Box
              component="span"
              // One piece with its dot: it moves to the next line whole, never leaving "·" behind.
              sx={{
                display: 'inline-block',
                maxWidth: '100%',
                typography: 'body2',
                color: 'text.secondary',
                ml: 0.75,
              }}
            >
              <span aria-hidden>· </span>
              {/* "block 1,364,165" never breaks between the word and its number. */}
              {when.replace(/\b(blocks?) /g, '$1\u00a0')}
            </Box>
          ) : null}
        </Typography>
        {evidence && evidence.words ? (
          <Button
            size="small"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={id}
            aria-label={`Show the ${evidence.words} with ${otherLabel}`}
            endIcon={<ExpandChevron open={open} />}
            sx={{
              gridColumn: 2,
              gridRow: 2,
              justifySelf: 'end',
              minHeight: 44,
              fontSize: 14,
              px: 1,
              mr: -0.5,
              whiteSpace: 'nowrap',
            }}
          >
            {evidence.words}
          </Button>
        ) : null}
        {extra ? <Box sx={{ gridColumn: '1 / -1', gridRow: 3, minWidth: 0 }}>{extra}</Box> : null}
        {isAt ? null : (
          <Box sx={{ gridColumn: 2, gridRow: 1, alignSelf: 'start', justifySelf: 'end' }}>
            <CompareButton
              address={address}
              accountLabel={accountLabel}
              other={other}
              otherLabel={otherLabel}
            />
          </Box>
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
