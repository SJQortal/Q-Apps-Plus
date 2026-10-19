/**
 * How this account is linked to other accounts, as evidence: each link a
 * sentence with numbers, a date and a block, opening to the transactions
 * behind it; never a verdict.
 *
 * What was recorded between them as a circle (the default) or a list (Circle
 * and List, kept on this device: ConnectionsCircle; typing a search shows
 * the list), the facts first, then the fixed
 * neutral line and Copy findings:
 * - Recorded between them: minting level moved, reward shares (its
 *   sponsor, minting with another account now, the accounts it sponsored),
 *   names bought or sold, and payments by the other account;
 * - In common: where its first QORT came from, the sponsor it shares with
 *   others, and who got their first QORT payment from it;
 * - In Q-Mintership: nominations, supports and votes between it and others
 *   (MintershipLinks);
 * - "Also checked, nothing found: …", and Core's own report on request.
 * Above them, QORT sent to exchanges or got from them (ExchangeNotice).
 * When the links read stopped at its ceiling (its newest 500 rows), the
 * tab says so, and what those rows didn't show isn't claimed as none.
 * A section shows only when it has something. "Copy findings" copies the
 * lot as text, with the block it was checked at.
 *
 * A small search over the tab (Simon, 2026-10-17; `?q=` in the URL)
 * narrows every list to the rows that show what was typed: a name (also
 * a name its owner holds besides the primary one), an address, an amount,
 * a tag, a date; similar words too, under "Similar to …" after the
 * matches (components/explorer/search, connections/searchEntries.ts). A
 * line under it says how many rows match; lists with none step aside.
 *
 * Reads (all cached per account, none polled; Refresh marks them stale):
 * xlinks, xpay sent and received, xexch, xassets, xonline, xfirst, the sponsor's
 * xlinks (heavy, dropped with this page), payer bands for the accounts on
 * screen, and MINTER's member and admin lists once Payments nears the
 * screen.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Box, Button, Link, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import BubbleChartOutlinedIcon from '@mui/icons-material/BubbleChartOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Section } from '../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { getTip } from '../../../data/chain';
import { coreSponsorKey, getCoreSponsor } from '../../../data/explorer/sponsorship';
import { useQuery } from '../../../hooks/useQuery';
import { peekQuery } from '../../../data/query';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { useInView } from '../../../hooks/useInView';
import { explorerAccountPath, explorerSponseesPath } from '../../../routes/paths';
import {
  emptyLinkChecks,
  fundingParts,
  nothingFoundLine,
  siblingsParts,
  type EmptyCheck,
} from '../../../rules/explorer/connections';
import {
  findingsText,
  linksCoverage,
  type Finding,
  type FindingLine,
} from '../../../rules/explorer/findings';
import { paymentsCoverage } from '../../../rules/explorer/money';
import { appLink, copyText } from '../../../utils/links';
import { formatCount } from '../../../utils/format';
import { EXPLORER_NEUTRAL_LINE } from '../explorerWords';
import { ConnectionRow, ROW_LIST_SX } from './connections/ConnectionRow';
import { CoreReport } from './connections/CoreReport';
import { useLevels, useMinterMarks, type MinterMarks } from './connections/hooks';
import { InCommonSection, type InCommonFound } from './connections/InCommon';
import type { Flow } from '../../../rules/explorer/money';
import type { MintershipLink } from './mintership/links';
import { PaymentsPanel } from './connections/PaymentsPanel';
import { useConnections, useRecorded } from './connections/useConnections';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from './names/useShowMore';
import { useInCommon } from './connections/useInCommon';
import {
  blocksLine,
  cappedNothingLine,
  fundingTag,
  LINKS_CAPPED_NOTE,
  connectionsSearchLine,
  textOf,
  unreadWords,
  whenLine,
} from './connections/words';
import { MintershipLinks } from './MintershipLinks';
import { RewardShareNote } from '../../../components/explorer/RewardShareNote';
import { RowSearchField } from '../../../components/explorer/search/RowSearchField';
import { SimilarHeading } from '../../../components/explorer/search/SimilarHeading';
import { useRowSearch } from '../../../components/explorer/search/useRowSearch';
import { appParam } from '../../../routes/hubLocation';
import type { MatchStrength } from '../../../utils/fuzzySearch';
import { LINK_GROUPS } from './mintership/links';
import { useMintershipLinks } from './mintership/useMintershipLinks';
import {
  findingEntry,
  flowEntry,
  fundingEntry,
  mintershipEntry,
  siblingsEntry,
  splitFound,
  type Found,
} from './connections/searchEntries';
import { ConnectionsCircle } from './connections/ConnectionsCircle';
import { ExchangeNotice } from './connections/ExchangeNotice';
import { useConnectionsView, type ConnectionsView } from './connections/useConnectionsView';
import { useCircleOrder } from './connections/useCircleOrder';
import { ViewScope } from '../../../components/common/ViewScope';
import { useViewState } from '../../../hooks/useViewState';

export interface ConnectionsTabProps {
  address: string;
}

/** Rows of one kind shown before "Show all". */
const ROWS = 20;

const SUBHEAD_SX = { fontSize: 16, fontWeight: 700, lineHeight: 1.3, mt: 1 } as const;

/** A part of the list under its heading; what is opened in it is its own (ViewScope). */
function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Typography component="h3" sx={SUBHEAD_SX}>
        {title}
      </Typography>
      <ViewScope name={title}>{children}</ViewScope>
    </Box>
  );
}

/** A list of rows, the first 20 and then "Show all" (the focus goes to the first row added). */
function Rows({ label, rows }: { label: string; rows: ReactNode[] }) {
  const [all, setAll] = useViewState(`rows:${label}`, false);
  const { listRef, focusFrom } = useFocusNewRows();
  return (
    <>
      <Box component="ul" ref={listRef} aria-label={label} sx={ROW_LIST_SX}>
        {all ? rows : rows.slice(0, ROWS)}
      </Box>
      {rows.length > ROWS && !all ? (
        <Button
          onClick={() => {
            focusFrom(ROWS);
            setAll(true);
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show all {formatCount(rows.length)}
        </Button>
      ) : null}
    </>
  );
}

/** Rows a search found: the matches, then those only similar under their heading. */
function FoundRows<T>({
  label,
  found,
  render,
  typed,
}: {
  label: string;
  found: Found<T>;
  render: (item: T) => ReactNode;
  typed: string;
}) {
  return (
    <>
      {found.match.length ? <Rows label={label} rows={found.match.map(render)} /> : null}
      {found.similar.length ? (
        <>
          <SimilarHeading typed={typed} />
          <Rows label={`${label}, similar to “${typed}”`} rows={found.similar.map(render)} />
        </>
      ) : null}
    </>
  );
}

function FindingRow({
  address,
  accountLabel,
  finding,
  marks,
  privs,
  tags = [],
}: {
  address: string;
  accountLabel: string;
  finding: Finding;
  marks: MinterMarks;
  privs?: Record<string, string | null>;
  /** More plain tags under the name ("Core counts it as the sponsor"). */
  tags?: readonly string[];
}) {
  if (!finding.other)
    return (
      <Box component="li" tabIndex={-1} sx={FOCUSABLE_ROW_SX}>
        <Typography sx={{ overflowWrap: 'anywhere' }}>{textOf(finding.parts)}</Typography>
        <Typography variant="body2" color="text.secondary">
          {whenLine(finding)}
        </Typography>
      </Box>
    );
  return (
    <ConnectionRow
      address={address}
      accountLabel={accountLabel}
      other={finding.other}
      parts={finding.parts}
      when={whenLine(finding)}
      tags={[marks.markOf(finding.other), marks.devOf(finding.other), ...tags]}
      evidence={{ words: finding.evidenceWords, txs: finding.evidence }}
      privs={privs}
      flow={finding.kind === 'paidBy' ? 'in' : finding.kind === 'paidTo' ? 'out' : undefined}
    />
  );
}

/** Copies the findings as text; says once whether it worked. */
function CopyFindingsButton({ build }: { build: () => Promise<string> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <>
      <Button
        variant="outlined"
        startIcon={state === 'copied' ? <CheckOutlinedIcon /> : <ContentCopyOutlinedIcon />}
        onClick={async () => {
          setState('idle');
          const ok = await copyText(await build());
          setState(ok ? 'copied' : 'failed');
        }}
        sx={{ minHeight: 44 }}
      >
        {state === 'copied' ? 'Findings copied' : 'Copy findings'}
      </Button>
      <span role="status" className="qmp-visually-hidden">
        {state === 'copied'
          ? 'Findings copied'
          : state === 'failed'
            ? 'Couldn’t copy the findings'
            : ''}
      </span>
    </>
  );
}

const LINK_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  minHeight: 44,
  fontWeight: 600,
  overflowWrap: 'anywhere',
} as const;

/** On the sponsor Core counts, when more than one account sponsored it. */
export const CORE_SPONSOR_TAG = 'the sponsor Core counts';

export default function ConnectionsTab({ address }: ConnectionsTabProps) {
  const accountLabel = useDisplayName(address).label;
  const data = useConnections(address);
  const { parsed } = data;
  const fromOthers = (parsed?.levelMoves ?? [])
    .filter((move) => move.direction === 'from' && move.other)
    .map((move) => move.other as string);
  const levels = useLevels(fromOthers);
  const recorded = useRecorded(data, levels);

  const [view, setView] = useConnectionsView();
  const [circleOrder, setCircleOrder] = useCircleOrder();
  // ---- the search (Simon, 2026-10-17) -----------------------------------------------------
  const [params, setParams] = useSearchParams();
  const searchText = appParam(params, 'q') ?? '';
  // Typing in the search shows the list (Simon, 2026-10-17: "when … user
  // starts typing in search, please switch to the list"), for this visit;
  // clearing it brings the circle back if the search had put it away.
  const [circleForSearch, setCircleForSearch] = useState(false);
  const setSearch = (next: string) => {
    if (next.trim() && view === 'circle') {
      setView('list', false);
      setCircleForSearch(true);
    } else if (!next.trim() && circleForSearch) {
      setView('circle', false);
      setCircleForSearch(false);
    }
    setSearchParam(next);
  };
  const setSearchParam = (next: string) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next.trim()) out.set('q', next.trim());
        else out.delete('q');
        return out;
      },
      { replace: true }
    );
  const typing = searchText.trim() !== '';
  const [paymentsNode, setPaymentsNode] = useState<HTMLElement | null>(null);
  // MINTER's lists for the marks: once Payments nears the screen, or a search is typed (its tags count).
  const paymentsNear = useInView(paymentsNode);
  const marks = useMinterMarks(paymentsNear || typing);
  const [commonNode, setCommonNode] = useState<HTMLElement | null>(null);
  // In common and In Q-Mintership read once they near the screen.
  const commonNear = useInView(commonNode);
  // Searched too once a search is typed, as when it nears the screen.
  const common = useInCommon(address, parsed, commonNear || typing);

  const of = (kind: Finding['kind']) => recorded.filter((f) => f.kind === kind);
  const levelMoves = of('levelMove');
  const sponsors = of('sponsor');
  const mintingWith = of('mintingWith');
  const sponsees = of('sponsees')[0] ?? null;
  // More than one account sponsored it: which one Core counts (about a second, read once).
  const coreSponsor = useQuery(sponsors.length > 1 ? coreSponsorKey(address) : null, (force) =>
    getCoreSponsor(address, { force })
  );
  const names = of('nameDeal');
  const linkFindings = levelMoves.length + sponsors.length + mintingWith.length + names.length;
  const sharesShown = sponsors.length + mintingWith.length > 0 || sponsees !== null;

  const paymentsPending =
    data.sent.isLoading || data.recv.isLoading || data.sent.isError || data.recv.isError;
  const paymentsAny = Boolean(data.flowsSent?.length || data.flowsReceived?.length);
  const assetsFailed = data.failed.includes('assets');
  const showPaymentsAll = paymentsPending || paymentsAny || assetsFailed;

  const funding = common.first.data?.funding ?? null;
  const sponsor = common.sponsor;
  const relationOf = (other: string) =>
    [
      other === sponsor ? 'its sponsor' : null,
      funding && funding.from === other ? fundingTag(funding) : null,
    ].filter((tag): tag is string => tag !== null);

  // ---- the search (Simon, 2026-10-17): what it finds ---------------------------------------
  // In Q-Mintership's rows count too: read once a search is typed, as when they near the screen.
  const mintership = useMintershipLinks(address, commonNear || typing);
  const searchAccounts = useMemo(
    () =>
      [
        ...recorded.map((finding) => finding.other),
        ...(data.flowsSent ?? []).map((flow) => flow.address),
        ...(data.flowsReceived ?? []).map((flow) => flow.address),
        funding?.from,
        sponsor,
        ...(mintership.links ?? []).map((link) => link.other),
      ].filter((other): other is string => typeof other === 'string'),
    [recorded, data.flowsSent, data.flowsReceived, funding, sponsor, mintership.links]
  );
  const search = useRowSearch(searchText, searchAccounts);
  const searching = search.query !== null;
  const typed = search.query?.text ?? '';
  const tagsFor = (other: string | null) =>
    other ? [marks.markOf(other), marks.devOf(other), ...relationOf(other)] : [];
  // Each row's text is built only while searching; with no search every row is found.
  const findFinding = (finding: Finding): MatchStrength | null =>
    searching ? search.test(findingEntry(finding, search.names, tagsFor(finding.other))) : 'match';
  const findFlow = (flow: Flow, direction: 'sent' | 'received'): MatchStrength | null =>
    searching
      ? search.test(flowEntry(flow, direction, search.names, tagsFor(flow.address)))
      : 'match';
  const findLink = (link: MintershipLink): MatchStrength | null =>
    searching
      ? search.test(
          mintershipEntry(
            link,
            LINK_GROUPS.find((group) => group.kind === link.kind)?.heading ?? ''
          )
        )
      : 'match';
  const levelFound = splitFound(levelMoves, findFinding);
  const sharesFound = splitFound([...sponsors, ...mintingWith], findFinding);
  const sponseesFound: MatchStrength | null = sponsees ? findFinding(sponsees) : null;
  const namesFound = splitFound(names, findFinding);
  const sentFound = splitFound(data.flowsSent ?? [], (flow) => findFlow(flow, 'sent'));
  const receivedFound = splitFound(data.flowsReceived ?? [], (flow) => findFlow(flow, 'received'));
  const sentAny = (data.sent.data?.rows.length ?? 0) > 0;
  const inCommonFound: InCommonFound = {
    funding:
      funding && searching
        ? search.test(fundingEntry(funding, common.band, search.names, tagsFor(funding.from)))
        : null,
    siblings:
      sponsor && common.siblings && searching
        ? search.test(
            siblingsEntry(
              sponsor,
              common.siblings,
              common.siblingsSpan,
              search.names,
              tagsFor(sponsor)
            )
          )
        : null,
    funded:
      sentAny && searching
        ? search.test({
            text: 'Who got their first QORT payment from this account',
            accounts: [],
          })
        : null,
  };
  const mintershipFound = splitFound(mintership.links ?? [], findLink);
  const tiers = [
    levelFound,
    sharesFound,
    namesFound,
    sentFound,
    receivedFound,
    mintershipFound,
  ] as Array<Found<unknown>>;
  const single = [
    sponseesFound,
    inCommonFound.funding,
    inCommonFound.siblings,
    inCommonFound.funded,
  ];
  const matchCount =
    tiers.reduce((sum, found) => sum + found.match.length, 0) +
    single.filter((found) => found === 'match').length;
  const similarCount =
    tiers.reduce((sum, found) => sum + found.similar.length, 0) +
    single.filter((found) => found === 'similar').length;
  // While searching, a part with nothing found steps aside.
  const paymentsFound = sentFound.all.length + receivedFound.all.length;
  const showPayments = showPaymentsAll && (!searching || paymentsFound > 0);
  const linkFindingsFound = searching
    ? levelFound.all.length + sharesFound.all.length + namesFound.all.length
    : linkFindings;
  const sponseesShown = sponsees !== null && (!searching || sponseesFound !== null);
  const showRecorded =
    (!searching && (data.links.isLoading || (data.links.isError && !data.links.data))) ||
    (searching && data.links.isLoading) ||
    linkFindingsFound > 0 ||
    sponseesShown ||
    showPayments;

  // Its newest 500 links rows only: level moves are read in full, the rest may be older.
  const capped = data.links.data?.truncated === true;
  const pairedOnline = data.online.data?.some(
    (share) =>
      share.minterAddress !== share.recipientAddress &&
      (share.minterAddress === address || share.recipientAddress === address)
  );
  const empty: EmptyCheck[] = [];
  const cappedEmpty: EmptyCheck[] = [];
  if (parsed)
    for (const check of emptyLinkChecks(parsed, data.online.data ? data.mintingWith : null)) {
      if (!capped || check === 'levelMoves') empty.push(check);
      // Who mints with it now is in the online list itself.
      else if (check === 'mintingWith') {
        if (!pairedOnline) empty.push(check);
      } else cappedEmpty.push(check);
    }
  if (
    data.flowsSent &&
    data.flowsReceived &&
    data.assets.data !== undefined &&
    !data.flowsSent.length &&
    !data.flowsReceived.length
  )
    empty.push('payments');
  if (common.first.data && !funding) empty.push('firstQort');
  const noneLine = nothingFoundLine(empty);
  const cappedLine = cappedNothingLine(nothingFoundLine(cappedEmpty));

  const build = async () => {
    const tip = await getTip().catch(() => null);
    const coverage: string[] = [];
    if (data.links.data) coverage.push(linksCoverage(data.links.data));
    if (data.sent.data && data.recv.data)
      coverage.push(
        paymentsCoverage(
          { count: data.sent.data.rows.length, done: data.sent.data.done },
          { count: data.recv.data.rows.length, done: data.recv.data.done },
          data.assets.data
            ? { count: data.assets.data.rows.length, truncated: data.assets.data.truncated }
            : undefined
        )
      );
    // What isn't above was not read: never "none found".
    if (data.failed.length) coverage.push(`Couldn’t read ${unreadWords(data.failed)}.`);
    const commonLines: FindingLine[] = [];
    if (funding)
      commonLines.push({
        parts: fundingParts(funding, common.band),
        height: funding.height,
        signature: funding.signature,
      });
    if (sponsor && common.siblings)
      commonLines.push({ parts: siblingsParts(sponsor, common.siblings) });
    return findingsText({
      address,
      name: peekQuery<string | null>(`name:${address}`) ?? null,
      checkedAt: tip?.height ?? null,
      neutralLine: EXPLORER_NEUTRAL_LINE,
      coverage,
      recorded,
      common: commonLines,
      noneFound: [noneLine, cappedLine].filter(Boolean).join('\n\n') || null,
      link: appLink(explorerAccountPath(address, 'connections')),
      nameOf: (other) => peekQuery<string | null>(`name:${other}`),
    });
  };

  const row = (finding: Finding) => (
    <FindingRow
      key={finding.key}
      address={address}
      accountLabel={accountLabel}
      finding={finding}
      marks={marks}
      privs={data.links.data?.privs}
      tags={[
        finding.kind === 'sponsor' && coreSponsor.data && finding.other === coreSponsor.data
          ? CORE_SPONSOR_TAG
          : null,
        search.heldNameTag(finding.other),
      ].filter((tag): tag is string => tag !== null)}
    />
  );

  return (
    <>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
        <RowSearchField
          value={searchText}
          onChange={setSearch}
          placeholder="Search these connections"
          label="Search this account’s connections: a name, an address, an amount, a tag…"
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_, value: ConnectionsView | null) => {
            if (!value) return;
            setView(value);
            // Picked by hand: clearing the search leaves it.
            setCircleForSearch(false);
          }}
          aria-label="Show what was recorded between them as"
        >
          <ToggleButton value="list" sx={{ minHeight: 44, px: 1.5, gap: 0.75 }}>
            <ViewListOutlinedIcon fontSize="small" />
            List
          </ToggleButton>
          <ToggleButton value="circle" sx={{ minHeight: 44, px: 1.5, gap: 0.75 }}>
            <BubbleChartOutlinedIcon fontSize="small" />
            Circle
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Typography
        role="status"
        variant="body2"
        color="text.secondary"
        sx={{ overflowWrap: 'anywhere', mt: searching ? 0 : -2 }}
      >
        {searching
          ? `${connectionsSearchLine(typed, matchCount, similarCount, search.reading)}${
              search.reading && matchCount + similarCount > 0
                ? ' Reading the names of the accounts in them…'
                : ''
            }`
          : ''}
      </Typography>

      {/* QORT sent to exchanges, or got from them (Simon, 2026-10-17). */}
      {!searching ? <ExchangeNotice address={address} recorded={recorded} /> : null}

      {view === 'circle' && showRecorded ? (
        <Section title="Connections circle" id="connections-circle">
          {data.settled ? (
            <ConnectionsCircle
              address={address}
              recorded={
                searching ? recorded.filter((finding) => findFinding(finding) !== null) : recorded
              }
              order={circleOrder}
              onOrder={setCircleOrder}
            />
          ) : (
            <ListSkeleton count={2} label="Reading its links" />
          )}
        </Section>
      ) : null}

      {view === 'list' && showRecorded ? (
        <Section title="Recorded between them" id="connections-recorded">
          {data.links.isError && !data.links.data ? (
            <ErrorState
              compact
              title="Couldn’t read its reward shares, level moves and name sales."
              error={data.links.error}
              onRetry={() => void data.links.refetch()}
            />
          ) : !data.links.data ? (
            <ListSkeleton count={2} label="Loading its links" />
          ) : capped ? (
            <Typography variant="body2" color="text.secondary">
              {LINKS_CAPPED_NOTE} Every level move was read.
            </Typography>
          ) : null}
          {levelFound.all.length ? (
            <Part title="Minting level">
              <FoundRows
                label="Minting level moved"
                found={levelFound}
                render={row}
                typed={typed}
              />
            </Part>
          ) : null}
          {searching ? (
            sharesFound.all.length > 0 || sponseesShown
          ) : sharesShown ? (
            <Part title="Reward shares">
              {sharesFound.all.length ? (
                <FoundRows label="Reward shares" found={sharesFound} render={row} typed={typed} />
              ) : null}
              {sponsees && sponseesShown ? (
                <Box>
                  <Link component={RouterLink} to={explorerSponseesPath(address)} sx={LINK_SX}>
                    {textOf(sponsees.parts)}
                    <ChevronRightOutlinedIcon fontSize="small" aria-hidden />
                  </Link>
                  <Typography variant="body2" color="text.secondary">
                    {/* The months are in the link already. */}
                    First shares in{' '}
                    {blocksLine(sponsees.firstHeight ?? sponsees.height, sponsees.height)}
                  </Typography>
                </Box>
              ) : null}
              <RewardShareNote />
            </Part>
          ) : null}
          {namesFound.all.length ? (
            <Part title="Names">
              <FoundRows
                label="Names bought or sold"
                found={namesFound}
                render={row}
                typed={typed}
              />
            </Part>
          ) : null}
          {showPayments ? (
            <Box ref={setPaymentsNode}>
              <Part title="Payments">
                <PaymentsPanel
                  address={address}
                  accountLabel={accountLabel}
                  data={data}
                  marks={marks}
                  relationOf={relationOf}
                  // The circle by QORT: the list starts with the most QORT too.
                  initialSort={circleOrder === 'qort' ? 'total' : 'count'}
                  found={
                    searching
                      ? {
                          sent: sentFound,
                          received: receivedFound,
                          typed,
                          tagOf: search.heldNameTag,
                        }
                      : null
                  }
                />
              </Part>
            </Box>
          ) : null}
        </Section>
      ) : null}

      <Box ref={setCommonNode} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ViewScope name="in-common">
          <InCommonSection
            address={address}
            accountLabel={accountLabel}
            data={common}
            marks={marks}
            sentAny={sentAny}
            found={searching ? inCommonFound : null}
            typed={typed}
            tagOf={search.heldNameTag}
          />
        </ViewScope>
        <ViewScope name="mintership">
          <MintershipLinks
            address={address}
            enabled={commonNear || typing}
            find={searching ? findLink : null}
            typed={typed}
            tagOf={search.heldNameTag}
          />
        </ViewScope>
      </Box>

      {noneLine && !searching ? (
        <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {noneLine}
        </Typography>
      ) : null}
      {cappedLine && !searching ? (
        <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {cappedLine}
        </Typography>
      ) : null}

      <CoreReport address={address} />

      {/* What these facts are and aren't, and Copy findings, after the facts (Simon, 2026-10-16). */}
      <Typography role="note" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {EXPLORER_NEUTRAL_LINE}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <CopyFindingsButton build={build} />
      </Box>
    </>
  );
}
