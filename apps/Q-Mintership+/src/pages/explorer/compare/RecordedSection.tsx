/**
 * Compare → Recorded between them, pair by pair: only the pairs where
 * something was found get a block (an anchor the pair grid jumps to), each
 * finding a sentence with its blocks or dates and what stands behind it;
 * then what was checked and found nothing for that pair, and one line for
 * the pairs with nothing at all. While reads are out, it says which; the
 * reads that failed are one line with one Retry.
 */
import { Box, Typography } from '@mui/material';
import { Section } from '../../../components/common/Section';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { checkedNoneLine, PAIR_CHECK_WORDS, type PairCheck } from '../../../rules/explorer/compare';
import { PAIR_ANCHOR_SX, pairAnchorId } from './compareView';
import { FindingRow } from './FindingRow';
import { LetterBadge } from './letters';
import { FailedReads, LIST_SX, Note, SubHeading, Waiting } from './parts';
import type { CompareData, PairData } from './useCompareData';

/** What a pair's reads are still out for, in words. */
function pendingWords(pending: readonly PairCheck[]): string {
  return pending.map((check) => PAIR_CHECK_WORDS[check]).join(', ');
}

/** The checks that were read, but where the read failed. */
function failedReads(
  data: CompareData,
  pair: PairData
): Array<{ what: string; retry: () => void }> {
  const out: Array<{ what: string; retry: () => void }> = [];
  const { i, j } = pair.pair;
  if (pair.xy.isError || pair.yx.isError)
    out.push({
      what: `the payments between ${pair.pair.label.replace('–', ' and ')}`,
      retry: () => {
        if (pair.xy.isError) void pair.xy.refetch();
        if (pair.yx.isError) void pair.yx.refetch();
      },
    });
  return [
    ...out,
    ...[i, j].flatMap((k) => {
      const letter = data.sides[k].letter;
      const failed = [
        data.links[k].isError
          ? { what: 'reward shares, level moves and name sales', q: data.links[k] }
          : null,
        data.assets[k].isError ? { what: 'asset transfers', q: data.assets[k] } : null,
        data.made[k].isError ? { what: 'Q-Mintership records', q: data.made[k] } : null,
        data.trades[k].isError ? { what: 'trade portal sales', q: data.trades[k] } : null,
      ].filter((f): f is NonNullable<typeof f> => f !== null);
      return failed.map((f) => ({
        what: `${letter}’s ${f.what}`,
        retry: () => void f.q.refetch(),
      }));
    }),
  ];
}

/** A read for this pair is still out (not failed). */
function inFlight(data: CompareData, pair: PairData): boolean {
  const { i, j } = pair.pair;
  return [
    pair.xy,
    pair.yx,
    ...[i, j].flatMap((k) => [data.links[k], data.assets[k], data.made[k], data.trades[k]]),
  ].some((q) => q.isLoading);
}

function PairBlock({
  data,
  pair,
  accents,
}: {
  data: CompareData;
  pair: PairData;
  accents: readonly string[];
}) {
  const { i, j } = pair.pair;
  const x = useDisplayName(pair.x).label;
  const y = useDisplayName(pair.y).label;
  const { findings, empty, pending } = pair.result;
  const none = checkedNoneLine(empty);
  const privs = {
    ...(data.links[i].data?.privs ?? {}),
    ...(data.links[j].data?.privs ?? {}),
  };
  return (
    <Box
      id={pairAnchorId(pair.pair.id)}
      tabIndex={-1}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, ...PAIR_ANCHOR_SX }}
    >
      <SubHeading>
        {/* The letters are said once, by the hidden "A–B:" after them. */}
        <Box
          component="span"
          aria-hidden
          sx={{ display: 'inline-flex', gap: 0.5, verticalAlign: 'middle', mr: 1 }}
        >
          <LetterBadge letter={data.sides[i].letter} accent={accents[i]} size={24} />
          <LetterBadge letter={data.sides[j].letter} accent={accents[j]} size={24} />
        </Box>
        <Box component="span" className="qmp-visually-hidden">
          {pair.pair.label}:{' '}
        </Box>
        <bdi dir="auto">{x}</bdi> and <bdi dir="auto">{y}</bdi>
      </SubHeading>
      <Box component="ul" aria-label={`Recorded between ${pair.pair.label}`} sx={LIST_SX}>
        {findings.map((finding) => (
          <FindingRow key={finding.key} finding={finding} viewpoint={finding.actor} privs={privs} />
        ))}
      </Box>
      {none ? <Note>{none}</Note> : null}
      {pending.length && inFlight(data, pair) ? (
        <Note>Still reading: {pendingWords(pending)}.</Note>
      ) : null}
    </Box>
  );
}

export function RecordedSection({
  data,
  accents,
}: {
  data: CompareData;
  accents: readonly string[];
}) {
  const pairs = data.pairData;
  const found = pairs.filter((p) => p.result.findings.length > 0);
  const nothing = pairs.filter((p) => !p.result.findings.length && !p.result.pending.length);
  const reading = pairs.filter((p) => p.result.pending.length && inFlight(data, p));
  const waiting = reading.filter((p) => !p.result.findings.length);
  const failures = pairs.flatMap((p) => failedReads(data, p));
  // Each failed read once, even when two pairs share it; all of them in one line.
  const seen = new Set<string>();
  const errors = failures.filter((f) => (seen.has(f.what) ? false : (seen.add(f.what), true)));
  const allChecks = new Set(nothing.flatMap((p) => p.result.empty));
  const emptyLine = nothing.length
    ? `${nothing.map((p) => p.pair.label).join(', ')}: ${
        checkedNoneLine([...allChecks] as PairCheck[])?.replace(/^Checked/, 'checked') ?? ''
      }`
    : null;
  if (!pairs.length) return null;
  return (
    // The pair grid jumps here for a pair whose reads failed (the Retry is here).
    <Box id="compare-recorded" tabIndex={-1} sx={PAIR_ANCHOR_SX}>
      <Section title="Recorded between them" id="compare-recorded-section">
        <Note>
          Payments between each pair are read both ways (up to the newest 100 each way). Asset
          transfers, reward shares, level moves, name sales, Q-Mintership records and trade portal
          sales come from each account’s own newest ones.
        </Note>
        {found.map((pair) => (
          <PairBlock key={pair.pair.id} data={data} pair={pair} accents={accents} />
        ))}
        {waiting.length ? (
          <Waiting announce="Reading what was recorded between them…">
            Reading what was recorded between {waiting.map((p) => p.pair.label).join(', ')}:{' '}
            {pendingWords([...new Set(waiting.flatMap((p) => p.result.pending))])}…
          </Waiting>
        ) : null}
        <FailedReads
          what={errors.map((e) => e.what)}
          onRetry={() => errors.forEach((e) => e.retry())}
          retryLabel="Retry Recorded between them"
          announce="Recorded between them: some reads failed."
        />
        {emptyLine ? (
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {emptyLine}
          </Typography>
        ) : null}
      </Section>
    </Box>
  );
}
