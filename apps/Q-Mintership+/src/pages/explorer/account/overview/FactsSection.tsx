/**
 * The Overview's facts, each on a panel of its own (fieldBlock.ts), two to
 * a row (three on wide screens): its level and
 * how far it is to the next, blocks minted (with how much of the time its
 * node was online, and Core's adjustment and penalty when it recorded any), its balance, when it was first seen, how
 * many groups it is in (GroupsSection lists them), how many QDN
 * transactions it made, and QORT minted, purchased / sold and received /
 * sent (qortSummaries.tsx), those three only for viewers who see the
 * Explorer's detailed parts (`full`; rules/explorer/access.ts: nothing about
 * them is read for anyone else). Each fact loads, fails and retries on its
 * own; none polls.
 */
import type { ReactNode } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { ProgressBar } from '../../../../components/common/ProgressRing';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState } from '../../../../components/common/states';
import { getBalance } from '../../../../data/accounts';
import { getGroupsOf, type FirstSeen } from '../../../../data/explorer/account';
import { accountTxKey, getAccountTx } from '../../../../data/explorer/accountTx';
import { familyOf } from '../../../../rules/explorer/txFamilies';
import type { AccountInfo } from '../../../../data/types';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import { effectiveBlocksMinted, levelProgress } from '../../../../rules/levels';
import { formatBlock, formatCount, formatDate } from '../../../../utils/format';
import { levelFraction } from '../../../home/homeData';
import {
  balanceWords,
  blocksDetail,
  groupsWords,
  levelNextWords,
  qdnTxWords,
} from './overviewWords';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { NodeOnlineValue } from '../../../../components/explorer/NodeOnline';
import { useQortSummaries } from './qortSummaries';
import { FactLabel } from '../../../../components/explorer/FactLabel';

const VALUE_SX = {
  m: 0,
  fontWeight: 700,
  fontSize: 18,
  fontVariantNumeric: 'tabular-nums',
  overflowWrap: 'anywhere',
} as const;

function Fact({
  label,
  value,
  info,
  detail,
  wide = false,
  wideOnPhone = false,
}: {
  label: string;
  value: ReactNode;
  /** Its ⓘ, beside the label (FactLabel). */
  info?: string | null;
  detail?: ReactNode;
  /** Spans the whole row (a list, or an error with Retry). */
  wide?: boolean;
  /** Spans the whole row on phones only (a pair of amounts). */
  wideOnPhone?: boolean;
}) {
  return (
    <Box
      sx={{
        ...FIELD_BLOCK_SX,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        ...(wide ? { gridColumn: '1 / -1' } : {}),
        ...(wideOnPhone && !wide ? { gridColumn: { xs: '1 / -1', md: 'auto' } } : {}),
      }}
    >
      <FactLabel label={label} info={info} />
      <Typography component="dd" sx={VALUE_SX}>
        {value}
      </Typography>
      {detail ? (
        <Typography
          component="dd"
          variant="body2"
          color="text.secondary"
          sx={{ m: 0, overflowWrap: 'anywhere' }}
        >
          {detail}
        </Typography>
      ) : null}
    </Box>
  );
}

/** A value still loading: a line of skeleton, read out as "Loading". */
function Loading() {
  return (
    <>
      <Skeleton variant="text" width="60%" aria-hidden sx={{ fontSize: 18 }} />
      <Box component="span" sx={visuallyHidden}>
        Loading
      </Box>
    </>
  );
}

/** A fact that couldn't load: what failed, and Retry, across the row. */
function FactError({
  label,
  what,
  query,
}: {
  label: string;
  what: string;
  query: Pick<UseQueryResult<unknown>, 'error' | 'refetch'>;
}) {
  return (
    <Fact
      wide
      label={label}
      value={
        <Box sx={{ fontWeight: 400, fontSize: 16 }}>
          <ErrorState
            compact
            title={`Couldn't load ${what}.`}
            error={query.error}
            onRetry={() => void query.refetch()}
          />
        </Box>
      }
    />
  );
}

function LevelFact({ account }: { account: AccountInfo }) {
  const blocks = effectiveBlocksMinted(account);
  const progress = levelProgress(account.level, blocks);
  const fraction = levelFraction(account.level, blocks);
  const next = levelNextWords(account.level, progress.blocksToNextLevel);
  return (
    <Fact
      label="Level"
      value={account.level}
      detail={
        progress.nextLevelAt === null ? (
          next
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <ProgressBar
              value={fraction}
              label={`Progress to level ${account.level + 1}: ${Math.round(fraction * 100)}%`}
            />
            <span>{next}</span>
          </Box>
        )
      }
    />
  );
}

function BlocksFact({ account }: { account: AccountInfo }) {
  const adjusted = blocksDetail(account.blocksMintedAdjustment, account.blocksMintedPenalty);
  return (
    <Fact
      label="Blocks minted"
      value={formatCount(account.blocksMinted)}
      detail={
        <>
          {/* How much of the time its node was online (Simon, 2026-10-17). */}
          <Box component="span" sx={{ display: 'block' }}>
            Node online:{' '}
            <NodeOnlineValue
              address={account.address}
              blocksMinted={account.blocksMinted}
              loading="…"
            />
          </Box>
          {adjusted ? (
            <Box component="span" sx={{ display: 'block' }}>
              {adjusted}
            </Box>
          ) : null}
        </>
      }
    />
  );
}

function BalanceFact({ address }: { address: string }) {
  // The same key as useBalance, without its polling.
  const balance = useQuery(`balance:${address}`, (force) => getBalance(address, { force }));
  if (balance.isError && balance.data === undefined)
    return <FactError label="Balance" what="its balance" query={balance} />;
  if (balance.data === undefined) return <Fact label="Balance" value={<Loading />} />;
  const { short, full } = balanceWords(balance.data);
  return (
    <Fact
      label="Balance"
      value={
        <span title={`${full} QORT`}>
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {short}
          </Box>{' '}
          QORT
        </span>
      }
      detail={short !== full ? `Exactly ${full} QORT` : null}
    />
  );
}

function FirstSeenFact({ query }: { query: UseQueryResult<FirstSeen> }) {
  if (query.isError && !query.data)
    return <FactError label="First seen" what="when it was first seen" query={query} />;
  if (!query.data) return <Fact label="First seen" value={<Loading />} />;
  const seen = query.data.firstSeen;
  if (!seen) return <Fact label="First seen" value="No record found" />;
  return (
    <Fact
      label="First seen"
      value={formatDate(seen.timestamp)}
      detail={`At ${formatBlock(seen.height)}`}
    />
  );
}

/** How many groups it is in; Overview's Groups section lists them. */
function GroupsFact({ address }: { address: string }) {
  const groups = useQuery(`xgroups:${address}`, (force) => getGroupsOf(address, { force }));
  if (groups.isError && !groups.data)
    return <FactError label="Groups" what="its groups" query={groups} />;
  if (!groups.data) return <Fact label="Groups" value={<Loading />} />;
  return <Fact label="Groups" value={groupsWords(groups.data.length)} />;
}

/**
 * How many transactions it made, and how many of them on QDN (Simon,
 * 2026-10-17: "QDN Transactions which will show the total nr of Tx the
 * user made", every transaction the main number, QDN below): counted in
 * its own transaction list (QDN data as Activity's chip counts it), the list Latest transactions and Activity read
 * anyway (`xtx:<address>:all`; its first page is read here when nothing
 * has yet). Exact once that list reaches its first transaction; until then
 * a floor, "860+", counted in what was read. Nothing more is read for it
 * (Simon: "keep it light … show like over 1000 tx"): Activity's own Read
 * further back makes it exact, and the floor points there for a viewer who
 * has Activity (`full`).
 */
function QdnFact({ address, full }: { address: string; full: boolean }) {
  const list = useQuery(accountTxKey(address, []), (force) => getAccountTx(address, [], { force }));
  // Simon, 2026-10-17: it "should just say "Transactions"".
  const label = 'Transactions';
  if (list.isError && !list.data)
    return <FactError label={label} what="its transactions" query={list} />;
  if (!list.data) return <Fact label={label} value={<Loading />} />;
  const { rows, done } = list.data;
  const qdn = rows.filter((tx) => familyOf(tx.type) === 'qdn').length;
  const { value, detail } = qdnTxWords(qdn, rows.length, done, full);
  return <Fact label={label} value={value} detail={detail} />;
}

interface FactsProps {
  address: string;
  account: AccountInfo;
  firstSeen: UseQueryResult<FirstSeen>;
  /** The viewer sees the QORT facts (rules/explorer/access.ts): nothing about them is read otherwise. */
  full: boolean;
}

export function FactsSection({ address, account, firstSeen, full }: FactsProps) {
  // QORT minted, purchased / sold, received / sent (Simon, 2026-10-17: moved here from the Minter Profile).
  const qort = useQortSummaries(
    address,
    account.blocksMinted === 0 && !account.blocksMintedAdjustment,
    { enabled: full }
  );
  return (
    <Section title="At a glance" id="overview-facts">
      <Card>
        <Box
          component="dl"
          sx={{
            m: 0,
            display: 'grid',
            gap: 1,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
          }}
        >
          <LevelFact account={account} />
          <BlocksFact account={account} />
          <BalanceFact address={address} />
          <FirstSeenFact query={firstSeen} />
          <GroupsFact address={address} />
          <QdnFact address={address} full={full} />
          {full ? (
            <>
              <Fact label="QORT minted" value={qort.minted} info={qort.infos.minted} />
              <Fact
                label="QORT purchased / sold"
                value={qort.trades}
                info={qort.infos.trades}
                wideOnPhone
              />
              <Fact
                label="QORT received / sent"
                value={qort.flows}
                info={qort.infos.flows}
                wideOnPhone
              />
            </>
          ) : null}
        </Box>
        {full && qort.notice ? <Box sx={{ mt: 1 }}>{qort.notice}</Box> : null}
      </Card>
    </Section>
  );
}
