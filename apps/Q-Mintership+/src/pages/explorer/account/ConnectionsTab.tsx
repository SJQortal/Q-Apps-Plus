/**
 * How this account is linked to other accounts, as evidence: each link a
 * sentence with numbers, a date and a block, opening to the transactions
 * behind it; never a verdict.
 *
 * What was recorded between them as a list or as a circle (List and Circle,
 * kept on this device: ConnectionsCircle), the facts first, then the fixed
 * neutral line and Copy findings:
 * - Recorded between them: minting level moved, reward shares (its
 *   sponsor, minting with another account now, the accounts it sponsored),
 *   names bought or sold, and payments by the other account;
 * - In common: where its first QORT came from, the sponsor it shares with
 *   others, and who got their first QORT payment from it;
 * - In Q-Mintership: nominations, supports and votes between it and others
 *   (MintershipLinks);
 * - "Also checked, nothing found: …", and Core's own report on request.
 * When the links read stopped at its ceiling (its newest 500 rows), the
 * tab says so, and what those rows didn't show isn't claimed as none.
 * A section shows only when it has something. "Copy findings" copies the
 * lot as text, with the block it was checked at.
 *
 * Reads (all cached per account, none polled; Refresh marks them stale):
 * xlinks, xpay sent and received, xassets, xonline, xfirst, the sponsor's
 * xlinks (heavy, dropped with this page), payer bands for the accounts on
 * screen, and MINTER's member and admin lists once Payments nears the
 * screen.
 */
import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import BubbleChartOutlinedIcon from '@mui/icons-material/BubbleChartOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { Section } from '../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../components/common/states';
import { getTip } from '../../../data/chain';
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
import { InCommonSection } from './connections/InCommon';
import { PaymentsPanel } from './connections/PaymentsPanel';
import { useConnections, useRecorded } from './connections/useConnections';
import { FOCUSABLE_ROW_SX, useFocusNewRows } from './names/useShowMore';
import { useInCommon } from './connections/useInCommon';
import {
  blocksLine,
  cappedNothingLine,
  fundingTag,
  LINKS_CAPPED_NOTE,
  textOf,
  unreadWords,
  whenLine,
} from './connections/words';
import { MintershipLinks } from './MintershipLinks';
import { RewardShareNote } from '../../../components/explorer/RewardShareNote';
import { ConnectionsCircle } from './connections/ConnectionsCircle';
import { useConnectionsView, type ConnectionsView } from './connections/useConnectionsView';

export interface ConnectionsTabProps {
  address: string;
}

/** Rows of one kind shown before "Show all". */
const ROWS = 20;

const SUBHEAD_SX = { fontSize: 16, fontWeight: 700, lineHeight: 1.3, mt: 1 } as const;

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Typography component="h3" sx={SUBHEAD_SX}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** A list of rows, the first 20 and then "Show all" (the focus goes to the first row added). */
function Rows({ label, rows }: { label: string; rows: ReactNode[] }) {
  const [all, setAll] = useState(false);
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

function FindingRow({
  address,
  accountLabel,
  finding,
  marks,
  privs,
}: {
  address: string;
  accountLabel: string;
  finding: Finding;
  marks: MinterMarks;
  privs?: Record<string, string | null>;
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
      tags={[marks.markOf(finding.other)]}
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
  const [paymentsNode, setPaymentsNode] = useState<HTMLElement | null>(null);
  const marks = useMinterMarks(useInView(paymentsNode));
  const [commonNode, setCommonNode] = useState<HTMLElement | null>(null);
  // In common and In Q-Mintership read once they near the screen.
  const commonNear = useInView(commonNode);
  const common = useInCommon(address, parsed, commonNear);

  const of = (kind: Finding['kind']) => recorded.filter((f) => f.kind === kind);
  const levelMoves = of('levelMove');
  const sponsors = of('sponsor');
  const mintingWith = of('mintingWith');
  const sponsees = of('sponsees')[0] ?? null;
  const names = of('nameDeal');
  const linkFindings = levelMoves.length + sponsors.length + mintingWith.length + names.length;
  const sharesShown = sponsors.length + mintingWith.length > 0 || sponsees !== null;

  const paymentsPending =
    data.sent.isLoading || data.recv.isLoading || data.sent.isError || data.recv.isError;
  const paymentsAny = Boolean(data.flowsSent?.length || data.flowsReceived?.length);
  const assetsFailed = data.failed.includes('assets');
  const showPayments = paymentsPending || paymentsAny || assetsFailed;
  const showRecorded =
    data.links.isLoading ||
    (data.links.isError && !data.links.data) ||
    linkFindings > 0 ||
    sponsees !== null ||
    showPayments;

  const funding = common.first.data?.funding ?? null;
  const sponsor = common.sponsor;
  const relationOf = (other: string) =>
    [
      other === sponsor ? 'its sponsor' : null,
      funding && funding.from === other ? fundingTag(funding) : null,
    ].filter((tag): tag is string => tag !== null);

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
    />
  );

  return (
    <>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        onChange={(_, value: ConnectionsView | null) => {
          if (value) setView(value);
        }}
        aria-label="Show what was recorded between them as"
        sx={{ alignSelf: 'flex-start' }}
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

      {view === 'circle' && showRecorded ? (
        <Section title="Connections circle" id="connections-circle">
          {data.settled ? (
            <ConnectionsCircle
              address={address}
              recorded={recorded}
              onShowList={() => setView('list')}
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
          {levelMoves.length ? (
            <Part title="Minting level">
              <Rows label="Minting level moved" rows={levelMoves.map(row)} />
            </Part>
          ) : null}
          {sharesShown ? (
            <Part title="Reward shares">
              {sponsors.length + mintingWith.length ? (
                <Rows label="Reward shares" rows={[...sponsors, ...mintingWith].map(row)} />
              ) : null}
              {sponsees ? (
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
          {names.length ? (
            <Part title="Names">
              <Rows label="Names bought or sold" rows={names.map(row)} />
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
                />
              </Part>
            </Box>
          ) : null}
        </Section>
      ) : null}

      <Box ref={setCommonNode} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <InCommonSection
          address={address}
          accountLabel={accountLabel}
          data={common}
          marks={marks}
          sentAny={(data.sent.data?.rows.length ?? 0) > 0}
        />
        <MintershipLinks address={address} enabled={commonNear} />
      </Box>

      {noneLine ? (
        <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {noneLine}
        </Typography>
      ) : null}
      {cappedLine ? (
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
