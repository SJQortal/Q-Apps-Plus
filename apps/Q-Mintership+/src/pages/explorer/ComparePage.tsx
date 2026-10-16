/**
 * Compare: `/explorer/compare/<a>/<b>[/<c>/<d>]`, two to four accounts side
 * by side, lettered A–D. Evidence only, under the Explorer's fixed line
 * about what links mean:
 *
 * 1. the accounts (identity cards with Remove, and Add);
 * 2. for three or four, every pair at a glance;
 * 3. Recorded between them, pair by pair;
 * 4. Timeline together;
 * 5. In common;
 * 6. Side by side (a table from 900 px, blocks on phones);
 * 7. Copy findings.
 *
 * The link is the comparison: Add and Remove go to a new link, an address
 * that isn't one (or is there twice) is left out and said so, and the
 * accounts picked to compare (state/explorer.ts) follow the page. Reads are
 * in compare/useCompareData.ts; the heavy ones go when the page closes.
 * Read-only: nothing here writes.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSetAtom } from 'jotai';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { EmptyState } from '../../components/common/states';
import { getTip } from '../../data/chain';
import type { PaymentCaps } from '../../data/explorer/money';
import { peekQuery } from '../../data/query';
import { useHeavyScope } from '../../hooks/useHeavyScope';
import { useInView } from '../../hooks/useInView';
import { explorerAccountPath, explorerComparePath, PATHS } from '../../routes/paths';
import {
  bandWords,
  checkedNoneLine,
  compareText,
  COMPARE_LIMIT,
  counterpartyCounts,
  counterpartyParts,
  droppedNote,
  groupsLead,
  groupWords,
  leftOutLine,
  letterOf,
  LETTERS,
  listWords,
  PAIR_CHECK_WORDS,
  parseComparePath,
  sameFirstPayerParts,
  sameSponsorParts,
  timelineLine,
  gapWords,
  type CompareLine,
  type Letter,
  type PairCheck,
} from '../../rules/explorer/compare';
import { visibleName } from '../../rules/explorer/nameNotes';
import { COMPARE_FULL, comparePicksAtom } from '../../state/explorer';
import { appLink } from '../../utils/links';
import { AccountCards } from './compare/AccountCards';
import {
  coverageLines,
  inCommonState,
  pairPending,
  sideFailed,
  sideFailures,
  useLetterAccents,
} from './compare/compareView';
import { InCommonSection } from './compare/InCommonSection';
import { PairGrid, type PairGridRow } from './compare/PairGrid';
import { CopyFindingsButton } from './compare/parts';
import { RecordedSection } from './compare/RecordedSection';
import { SideBySide } from './compare/SideBySide';
import { cellText, sameForAll, sideRows, type SideFacts } from './compare/sideRows';
import { TimelineSection } from './compare/TimelineSection';
import { COMPARE_SCOPE, useCompareData, type CompareData } from './compare/useCompareData';
import { EXPLORER_NEUTRAL_LINE } from './explorerWords';

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const nameOf = (address: string) => {
  const name = peekQuery<string | null>(`name:${address}`);
  return name ? visibleName(name) : name;
};

/**
 * Each pair's counts for the grid: recorded, in common, and whether its
 * reads are all in, still out, or some failed (with nothing left out).
 */
function pairGridRows(data: CompareData): PairGridRow[] {
  return data.pairData.map(({ pair, result, xy, yx }) => {
    const a = letterOf(pair.i);
    const b = letterOf(pair.j);
    const both = (letters: readonly Letter[]) => letters.includes(a) && letters.includes(b);
    const inCommon =
      data.sponsors.filter((s) => both(s.letters)).length +
      data.firstPayers.filter((p) => both(p.accounts.map((x) => x.letter))).length +
      data.counterparties.rows.filter((r) => both(r.counts.map((c) => c.letter))).length +
      data.groupsShared.filter((g) => both(g.letters)).length;
    const sides = [pair.i, pair.j];
    const recordedReads = [
      xy,
      yx,
      ...sides.flatMap((k) => [data.links[k], data.assets[k], data.made[k], data.trades[k]]),
    ];
    const commonReads = sides.flatMap((k) => [
      data.first[k],
      data.groups[k],
      data.sent[k],
      data.recv[k],
      data.assets[k],
      data.links[k],
    ]);
    // A failed read is not a read: the pair can't say "none found" on it.
    const commonIn = commonReads.every((q) => q.data !== undefined);
    const settled = !result.pending.length && commonIn;
    const out = [...recordedReads, ...commonReads].some((q) => q.isLoading);
    const recordedFailed = recordedReads.some((q) => q.isError);
    const commonFailed = commonReads.some((q) => q.isError);
    return {
      label: pair.label,
      id: pair.id,
      i: pair.i,
      j: pair.j,
      recorded: result.findings.length,
      inCommon,
      state: settled ? 'done' : !out && (recordedFailed || commonFailed) ? 'failed' : 'checking',
      retryAt: recordedFailed ? 'compare-recorded' : commonFailed ? 'compare-common' : undefined,
    };
  });
}

/** "payments both ways, reward shares". */
const checkWords = (checks: readonly PairCheck[]) =>
  checks.map((check) => PAIR_CHECK_WORDS[check]).join(', ');

/**
 * Everything on the page as plain text, with the block it was checked at,
 * as far as the reads got: what is still being read and what couldn't be
 * read is said, as on the page, never left out as if nothing were there.
 */
async function buildText(
  data: CompareData,
  sideFacts: SideFacts[],
  timelineReading: boolean
): Promise<string> {
  const tip = await getTip().catch(() => null);
  const total = data.liveSides.length;
  // How far each read went, from the reads themselves (and whether this node has payments/between).
  const coverage = coverageLines(data, peekQuery<PaymentCaps>('xcaps'));
  const pairs = data.pairData
    .filter((p) => p.result.findings.length || p.result.pending.length)
    .map((p) => {
      const { reading, failed } = pairPending(data, p);
      return {
        label: p.pair.label,
        // A trade's sentence has its dates already.
        lines: p.result.findings.map((f) => (f.kind === 'trade' ? { parts: f.parts } : f)),
        noneFound: checkedNoneLine(p.result.empty),
        status: [
          ...(reading.length ? [`Still reading: ${checkWords(reading)}.`] : []),
          ...(failed.length ? [`Couldn’t read: ${checkWords(failed)}.`] : []),
        ],
      };
    });
  const nothing = data.pairData.filter(
    (p) => !p.result.findings.length && !p.result.pending.length
  );
  const emptyChecks = [...new Set(nothing.flatMap((p) => p.result.empty))] as PairCheck[];
  const emptyPairs = nothing.length
    ? `${nothing.map((p) => p.pair.label).join(', ')}: ${(checkedNoneLine(emptyChecks) ?? '').replace(/^Checked/, 'checked')}`
    : null;
  const common: CompareLine[] = [
    ...data.sponsors.map((s) => ({ parts: sameSponsorParts(s, total) })),
    ...data.firstPayers.map((p) => ({ parts: sameFirstPayerParts(p, total, data.bands[p.from]) })),
    ...data.counterparties.rows.map((r) => {
      // The busy mark the page shows next to it, too.
      const busy = bandWords(data.bands[r.address]);
      return {
        parts: [
          ...counterpartyParts(r, total),
          {
            kind: 'text' as const,
            text: ` (${counterpartyCounts(r)}${busy ? ` · it ${busy}` : ''})`,
          },
        ],
      };
    }),
  ];
  const left = leftOutLine(data.counterparties);
  const commonNotes = [
    ...(left ? [left] : []),
    ...(data.groupsShared.length
      ? [
          `${groupsLead(data.groupsShared, total)}: ${data.groupsShared
            .map(
              (g) =>
                `${groupWords(g)}${g.letters.length < total ? ` [${g.letters.join(', ')}]` : ''}`
            )
            .join(', ')}.`,
        ]
      : []),
    ...data.timing.map((t) => t.text),
  ];
  const state = inCommonState(data);
  const commonStatus = [
    ...(state.empty.length ? [`Checked, none found: ${state.empty.join(', ')}.`] : []),
    ...(state.checking.length ? [`Still checking for ${listWords(state.checking)}.`] : []),
    ...(state.failed.length ? [`Couldn’t finish checking for ${listWords(state.failed)}.`] : []),
  ];
  const timelineStatus = timelineReading
    ? 'Still reading first transactions, self-shares, names and MINTER history for the timeline: it may be missing lines.'
    : null;
  const timeline = data.timeline.map((event, i) =>
    i === 0
      ? timelineLine(event, nameOf)
      : `${gapWords(data.timeline[i - 1], event)} · ${timelineLine(event, nameOf)}`
  );
  const rows = sideRows(sideFacts);
  const columns = data.liveSides.map((s) => s.letter);
  const side = rows.map((row) => {
    const same = sameForAll(row.cells);
    if (same) return `${row.label}: same for all, ${cellText(same, nameOf)}`;
    return `${row.label}: ${row.cells
      .map(
        (cell, i) =>
          `${columns[i]} ${cell ? (cell.failed ? lowerFirst(cellText(cell)) : cellText(cell, nameOf)) : 'not read'}`
      )
      .join('; ')}`;
  });
  return compareText({
    accounts: data.addresses.map((address, i) => ({
      letter: letterOf(i),
      address,
      name: nameOf(address) ?? null,
    })),
    checkedAt: tip?.height ?? null,
    neutralLine: EXPLORER_NEUTRAL_LINE,
    coverage,
    pairs,
    emptyPairs,
    common,
    commonNotes,
    commonStatus,
    timeline,
    timelineStatus,
    side,
    link: appLink(explorerComparePath([...data.addresses])),
    nameOf,
  });
}

export default function ComparePage() {
  const params = useParams();
  const rest = params['*'];
  const { addresses, dropped } = useMemo(() => parseComparePath(rest), [rest]);
  const navigate = useNavigate();
  const theme = useTheme();
  // Asked once for the page: Side by side is a table from 900 px.
  const table = useMediaQuery(theme.breakpoints.up('md'));
  const accents = useLetterAccents();
  const [message, setMessage] = useState<string | null>(null);

  // The accounts picked to compare follow the page.
  const setPicks = useSetAtom(comparePicksAtom);
  const joined = addresses.join('/');
  useEffect(() => {
    setPicks(joined ? joined.split('/') : []);
    setMessage(null);
  }, [joined, setPicks]);
  useHeavyScope(COMPARE_SCOPE);

  const [belowNode, setBelowNode] = useState<HTMLElement | null>(null);
  const below = useInView(belowNode);
  const [sideNode, setSideNode] = useState<HTMLElement | null>(null);
  const sideNear = useInView(sideNode);
  const data = useCompareData(addresses, { below, side: sideNear });

  const remove = (address: string) => {
    const left = addresses.filter((a) => a !== address);
    if (left.length >= 2) navigate(explorerComparePath(left));
    else if (left.length === 1)
      navigate(explorerAccountPath(left[0]), { state: { via: 'explorer' } });
    else navigate(PATHS.explorer);
  };
  const add = (address: string) => {
    const at = addresses.indexOf(address);
    if (at >= 0) setMessage(`Already in this comparison, as ${letterOf(at)}.`);
    else if (addresses.length >= COMPARE_LIMIT) setMessage(COMPARE_FULL);
    else navigate(explorerComparePath([...addresses, address]));
  };

  const live = data.liveSides;
  const sideFacts: SideFacts[] = data.addresses.flatMap((_, i) => {
    const account = data.accounts[i];
    if (!account) return [];
    const links = data.links[i].data;
    return [
      {
        account,
        // A failed read stays unread (`failed` says so), never "no primary name".
        primary: data.primary[i].data,
        names: data.names[i].data,
        first: data.first[i].data,
        balance: data.balance[i].data,
        status: data.status[i].data,
        sponsor: links ? data.sponsorOf[i] : undefined,
        sponsees: data.parsedSponsees[i],
        sponseesCapped: links?.truncated,
        mintingNow: data.mintingNow[i],
        lastSent: data.lastSent[i].data,
        groups: data.groups[i].data,
        qdn: data.qdn[i].data,
        failed: sideFailed(data, i),
      },
    ];
  });
  const sideFailedReads = sideFailures(data);
  const columns = data.addresses
    .map((address, i) => ({ address, letter: letterOf(i), accent: accents[i] }))
    .filter((_, i) => data.accounts[i]);
  const grid = live.length >= 3 ? pairGridRows(data) : [];
  const common = inCommonState(data);
  const timelineReading =
    !below ||
    data.status.some((q, i) => data.live[i] && q.isLoading) ||
    data.first.some((q, i) => data.live[i] && q.isLoading) ||
    data.links.some((q, i) => data.live[i] && q.isLoading) ||
    data.nominations.some((q, i) => data.live[i] && q.isLoading) ||
    data.asked.some((q, i) => data.live[i] && q.isLoading) ||
    data.members.isLoading;
  const note = droppedNote(dropped);

  return (
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <PageHeader
        title="Compare accounts"
        back={PATHS.explorer}
        actions={
          addresses.length ? (
            <CopyLinkButton path={explorerComparePath([...addresses])} what="this comparison" />
          ) : null
        }
      />
      <PageBody $maxWidth={WIDE_PAGE}>
        <Typography role="note" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {EXPLORER_NEUTRAL_LINE}
        </Typography>
        {note ? (
          <Typography role="status" sx={{ overflowWrap: 'anywhere' }}>
            {note}
          </Typography>
        ) : null}
        {addresses.length === 0 ? (
          <EmptyState
            title="No accounts to compare."
            description="Find two to four accounts by name or address to see them side by side."
          />
        ) : null}
        <AccountCards
          data={data}
          accents={accents}
          onRemove={remove}
          onAdd={add}
          message={message}
        />
        {addresses.length === 1 ? (
          <Typography color="text.secondary">Add another account to compare it with.</Typography>
        ) : null}
        {grid.length ? <PairGrid rows={grid} letters={LETTERS} accents={accents} /> : null}
        {live.length >= 2 ? (
          <>
            <RecordedSection data={data} accents={accents} />
            <Box ref={setBelowNode} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TimelineSection data={data} accents={accents} reading={timelineReading} />
              {common.any || common.reading || common.empty.length || common.failed.length ? (
                <InCommonSection data={data} />
              ) : null}
            </Box>
            <Box ref={setSideNode}>
              <SideBySide
                columns={columns}
                rows={sideRows(sideFacts)}
                table={table}
                failed={sideFailedReads.what}
                onRetry={() => sideFailedReads.reads.forEach((q) => void q.refetch())}
              />
            </Box>
            <Box>
              <CopyFindingsButton build={() => buildText(data, sideFacts, timelineReading)} />
            </Box>
          </>
        ) : null}
      </PageBody>
    </PersonLinkContext>
  );
}
