/**
 * The accounts one sponsor sponsored (`/explorer/sponsees/:address`): the
 * accounts it made reward shares to, from its own links search, each with
 * when and at what percent, whether the share was removed, where it stands
 * in MINTER now, whether it mints now, and its level and any minting
 * penalty. A summary line counts them, every count with its denominator.
 * Pick up to 4 to compare; two checks across the set run on request.
 *
 * Reads: the sponsor's links (xlinks:<a>, heavy, dropped when the page
 * closes), MINTER's member list and bans (shared with the rest of the
 * app), who mints now (xonline), and each row's account once it nears the
 * screen. Nothing polls. Read-only.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { EXPLORER_PERSON_LINKS, PersonLinkContext } from '../../components/common/personLinks';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { isAddress } from '../../data/accounts';
import { getOnline } from '../../data/explorer/account';
import { getLinks } from '../../data/explorer/links';
import { joinSponsees } from '../../data/explorer/sets';
import { getBans, getMembers } from '../../data/group';
import type { AccountInfo } from '../../data/types';
import { usePrimaryName } from '../../hooks/useData';
import { useHeavyScope } from '../../hooks/useHeavyScope';
import { useQuery } from '../../hooks/useQuery';
import { explorerComparePath, explorerSponseesPath, PATHS } from '../../routes/paths';
import { monthRange, sponseesOf } from '../../rules/explorer/connections';
import { visibleName } from '../../rules/explorer/nameNotes';
import { COMPARE_MAX } from '../../state/explorer';
import { formatCount, plural, shortAddress } from '../../utils/format';
import { useStoreValues } from './account/connections/hooks';
import { useFocusNewRows } from './account/names/useShowMore';
import { INVALID_ADDRESS } from './explorerWords';
import { SetChecks } from './sets/SetChecks';
import { SET_LIST_SX, SponseeRowItem } from './sets/SponseeRows';
import { withMarkedName } from '../../components/common/markedText';
import { ExplorerHeaderSearch } from '../../components/explorer/ExplorerHeaderSearch';

/** Rows shown before "Show more" (each looks up a name and, near the screen, its account). */
const ROWS = 20;

export default function SponseesPage() {
  const address = (useParams().address ?? '').trim();
  const valid = isAddress(address);
  const navigate = useNavigate();
  useHeavyScope(valid ? address : null);
  const name = usePrimaryName(valid ? address : null).data ?? null;
  const label = name ? visibleName(name) : shortAddress(address);

  const links = useQuery(valid ? `xlinks:${address}` : null, (force) =>
    getLinks(address, { force })
  );
  const members = useQuery(valid ? 'group:members' : null, (force) => getMembers({ force }));
  const bans = useQuery(valid ? 'group:bans' : null, (force) => getBans({ force }));
  const online = useQuery(valid ? 'xonline' : null, () => getOnline());

  const sponsees = useMemo(
    () => (links.data ? sponseesOf(links.data.rows, address) : null),
    [links.data, address]
  );
  const rows = useMemo(
    () =>
      joinSponsees(sponsees ?? [], {
        members: members.data?.members,
        online: online.data,
        bans: bans.data,
      }),
    [sponsees, members.data, online.data, bans.data]
  );
  const accounts = useStoreValues<AccountInfo>(rows.map((row) => `account:${row.address}`));

  const [limit, setLimit] = useState(ROWS);
  const { listRef, focusFrom } = useFocusNewRows();
  const [picks, setPicks] = useState<string[]>([]);
  const pick = (who: string, on: boolean) =>
    setPicks((list) =>
      on
        ? list.includes(who) || list.length >= COMPARE_MAX
          ? list
          : [...list, who]
        : list.filter((a) => a !== who)
    );

  const title = valid ? `Accounts ${label} sponsored` : 'Sponsored accounts';
  let summary = '';
  if (sponsees?.length) {
    const starts = sponsees.map((s) => s.start.timestamp);
    const head = `${plural(sponsees.length, 'account')} sponsored, ${monthRange(
      Math.min(...starts),
      Math.max(...starts)
    )}`;
    const read = accounts.filter((a) => a !== undefined) as AccountInfo[];
    const penalties = read.filter((a) => a.blocksMintedPenalty !== 0).length;
    const parts = [
      members.data ? `${formatCount(rows.filter((r) => r.member).length)} in MINTER now` : null,
      online.data ? `${formatCount(rows.filter((r) => r.mintingNow).length)} minting now` : null,
      read.length === rows.length
        ? `${formatCount(penalties)} with a minting penalty`
        : read.length
          ? `${formatCount(penalties)} with a minting penalty among the ${formatCount(read.length)} read so far`
          : null,
    ].filter(Boolean);
    summary = parts.length ? `${head}: ${parts.join(', ')}.` : `${head}.`;
  }

  let body: React.ReactNode;
  if (!valid)
    body = <EmptyState title={INVALID_ADDRESS} description={<bdi dir="auto">{address}</bdi>} />;
  else if (links.isError && !links.data)
    body = (
      <ErrorState
        title="Couldn’t read its reward shares."
        error={links.error}
        onRetry={() => void links.refetch()}
      />
    );
  else if (!sponsees) body = <ListSkeleton count={3} label="Loading the accounts it sponsored" />;
  else if (!sponsees.length)
    body = (
      <EmptyState
        title={withMarkedName(`${label} made no reward shares to other accounts.`, name, label)}
        description={
          links.data?.truncated
            ? 'Its newest 500 reward shares, level moves and name sales were read.'
            : undefined
        }
      />
    );
  else
    body = (
      <>
        {/* Not a live region: its counts change as each row's account is read. */}
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{summary}</Typography>
        {links.data?.truncated ? (
          <Typography variant="body2" color="text.secondary">
            From its newest 500 reward shares, level moves and name sales: there may be older ones.
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          Before Oct 2024 most new accounts started minting through another account’s reward share
          (a sponsor). Since then MINTER membership is what counts.
        </Typography>
        <Section
          title="Sponsored"
          id="sponsees-list"
          count={rows.length}
          action={
            <Button
              variant="contained"
              disabled={picks.length < 2}
              onClick={() => navigate(explorerComparePath(picks))}
              sx={{ minHeight: 44 }}
            >
              Compare {picks.length || ''}
            </Button>
          }
        >
          <Typography variant="body2" color="text.secondary">
            Pick 2 to {COMPARE_MAX} accounts to compare them side by side.
          </Typography>
          <Box
            component="ul"
            ref={listRef}
            aria-label={`Accounts ${label} sponsored`}
            sx={SET_LIST_SX}
          >
            {rows.slice(0, limit).map((row) => (
              <SponseeRowItem
                key={row.address}
                row={row}
                // "Not in MINTER" only from the whole member list.
                membersKnown={members.data !== undefined && !members.data.truncated}
                picked={picks.includes(row.address)}
                full={picks.length >= COMPARE_MAX}
                onPick={pick}
              />
            ))}
          </Box>
          {rows.length > limit ? (
            <Button
              onClick={() => {
                focusFrom(limit);
                setLimit((n) => n + ROWS);
              }}
              sx={{ alignSelf: 'flex-start', minHeight: 44 }}
            >
              Show more ({formatCount(rows.length - limit)} more)
            </Button>
          ) : null}
        </Section>
        <SetChecks accounts={rows.map((row) => row.address)} scope={address} />
      </>
    );

  return (
    <PersonLinkContext value={EXPLORER_PERSON_LINKS}>
      <PageHeader
        title={title}
        heading={withMarkedName(title, name, label)}
        back={PATHS.explorer}
        actions={
          <>
            <ExplorerHeaderSearch />
            {valid ? (
              <CopyLinkButton path={explorerSponseesPath(address)} what="this list" />
            ) : undefined}
          </>
        }
      />
      <PageBody $maxWidth={WIDE_PAGE}>{body}</PageBody>
    </PersonLinkContext>
  );
}
