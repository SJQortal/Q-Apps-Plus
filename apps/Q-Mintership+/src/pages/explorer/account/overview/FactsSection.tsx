/**
 * The Overview's facts, each on a panel of its own (fieldBlock.ts), two to
 * a row (three on wide screens): its level and
 * how far it is to the next, blocks minted (with Core's adjustment and
 * penalty when it recorded any), its balance, when it was first seen, and
 * its groups (MINTER first, five shown, the rest on request). Each fact
 * loads, fails and retries on its own; none polls.
 */
import { useId, useState, type ReactNode } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { ProgressBar } from '../../../../components/common/ProgressRing';
import { Card, Section, ToneChip } from '../../../../components/common/Section';
import { SmoothReveal } from '../../../../components/common/SmoothReveal';
import { ErrorState } from '../../../../components/common/states';
import { getBalance } from '../../../../data/accounts';
import { MINTER_GROUP_ID } from '../../../../data/constants';
import { getGroupsOf, type FirstSeen, type GroupOf } from '../../../../data/explorer/account';
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
  membersWords,
} from './overviewWords';
import { GroupAvatar } from '../../../../components/common/GroupAvatar';
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';

/** Groups shown before "Show all". */
const GROUPS_SHOWN = 5;

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
  detail,
  wide = false,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Spans the whole row (a list, or an error with Retry). */
  wide?: boolean;
}) {
  return (
    <Box
      sx={{
        ...FIELD_BLOCK_SX,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        ...(wide ? { gridColumn: '1 / -1' } : {}),
      }}
    >
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
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
  return (
    <Fact
      label="Blocks minted"
      value={formatCount(account.blocksMinted)}
      detail={blocksDetail(account.blocksMintedAdjustment, account.blocksMintedPenalty)}
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

function GroupRow({ group, address }: { group: GroupOf; address: string }) {
  const owner = group.owner === address;
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 1,
        rowGap: 0.5,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        minWidth: 0,
      }}
    >
      <GroupAvatar
        groupId={group.groupId}
        groupName={group.groupName}
        ownerName={group.ownerPrimaryName}
        size={32}
      />
      <Typography component="span" sx={{ fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>
        <bdi dir="auto">{group.groupName || `Group #${group.groupId}`}</bdi>
      </Typography>
      {typeof group.memberCount === 'number' ? (
        <Typography component="span" variant="body2" color="text.secondary">
          {membersWords(group.memberCount)}
        </Typography>
      ) : null}
      {owner ? (
        <ToneChip size="small" variant="outlined" label="Owner" sx={{ fontSize: 14 }} />
      ) : null}
      {group.isAdmin ? (
        <ToneChip size="small" variant="outlined" label="Admin" sx={{ fontSize: 14 }} />
      ) : null}
    </Box>
  );
}

const LIST_SX = { listStyle: 'none', m: 0, p: 0 } as const;

function GroupsFact({ address }: { address: string }) {
  const groups = useQuery(`xgroups:${address}`, (force) => getGroupsOf(address, { force }));
  const [all, setAll] = useState(false);
  const moreId = useId();
  if (groups.isError && !groups.data)
    return <FactError label="Groups" what="its groups" query={groups} />;
  if (!groups.data) return <Fact wide label="Groups" value={<Loading />} />;
  // MINTER first, then Core's order.
  const list = [
    ...groups.data.filter((g) => g.groupId === MINTER_GROUP_ID),
    ...groups.data.filter((g) => g.groupId !== MINTER_GROUP_ID),
  ];
  const first = list.slice(0, GROUPS_SHOWN);
  const rest = list.slice(GROUPS_SHOWN);
  return (
    <Fact
      wide
      label="Groups"
      value={groupsWords(list.length)}
      detail={
        list.length ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', color: 'text.primary' }}>
            <Box component="ul" aria-label="Its groups" sx={LIST_SX}>
              {first.map((group) => (
                <GroupRow key={group.groupId} group={group} address={address} />
              ))}
            </Box>
            {rest.length ? (
              <>
                <SmoothReveal open={all}>
                  <Box component="ul" id={moreId} aria-label="More of its groups" sx={LIST_SX}>
                    {rest.map((group) => (
                      <GroupRow key={group.groupId} group={group} address={address} />
                    ))}
                  </Box>
                </SmoothReveal>
                <Button
                  onClick={() => setAll((open) => !open)}
                  aria-expanded={all}
                  aria-controls={all ? moreId : undefined}
                  sx={{ alignSelf: 'flex-start', minHeight: 44 }}
                >
                  {all ? 'Show fewer' : `Show all ${formatCount(list.length)}`}
                </Button>
              </>
            ) : null}
          </Box>
        ) : null
      }
    />
  );
}

export function FactsSection({
  address,
  account,
  firstSeen,
}: {
  address: string;
  account: AccountInfo;
  firstSeen: UseQueryResult<FirstSeen>;
}) {
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
        </Box>
      </Card>
    </Section>
  );
}
