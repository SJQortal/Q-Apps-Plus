/**
 * "Requested to join MINTER Group" (Simon, 2026-10-18: the Ready to mint
 * list, renamed and moved into + Propose → Decline a join request): the
 * people who asked to join MINTER and aren't members, as Decline a join
 * request's person picker, for Minter Admins. Nominators don't pick
 * candidates from it: they choose community members themselves.
 *
 * Each row says who they are (level, blocks minted, when they asked, and
 * whether they were a member before: "Former member: left MINTER on …") and
 * offers Decline, or says why not: a nomination of them is open, or a decline
 * already waits (with a link to it). Twenty rows at a time, in the order the
 * Sort picker gives (the newest request first by default; data/readyToMint.ts
 * → loadReadyOrder reads only what that order needs); each row's details are
 * read only once it is shown. The search box filters it: a typed address
 * directly, a typed name through its owners (one small name search, cached),
 * never by reading every row's name.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, InputAdornment, Link, Skeleton, TextField, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PersonChip } from '../../components/common/Person';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { effectiveBlocksMinted, isAddress } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import { getQueryState, peekQuery } from '../../data/query';
import {
  DEFAULT_READY_SORT,
  READY_PAGE,
  READY_SORTS,
  askedKey,
  formerKey,
  loadReadyDetails,
  loadReadyOrder,
  matchReady,
  readyOrderKey,
  type ReadySort,
} from '../../data/readyToMint';
import type { AccountInfo } from '../../data/types';
import { useNominations } from '../../hooks/useData';
import { useInView } from '../../hooks/useInView';
import { useQuery } from '../../hooks/useQuery';
import { decisionPath } from '../../routes/paths';
import type { FormerMember } from '../../rules/status';
import { formerMemberLine } from '../person/personWords';
import { displayName, formatCount, formatDate } from '../../utils/format';
import { readable } from '../../utils/readable';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import { JOIN_REQUESTS_TITLE } from '../../constants/words';
import { useJoinRequestSearch, useJoinRequests, useStoredValue } from './useJoinRequests';
import { DECLINE_WAITING, useWaitingDeclines } from './waitingDeclines';

/** A name already read for a row on screen (searching never reads one). */
const knownName = (address: string) => peekQuery<string | null>(`name:${address}`);

/** One of a row's reads (account, name, former-member mark) failed last time. */
const readFailed = (address: string) =>
  [`account:${address}`, `name:${address}`, formerKey(address)].some(
    (key) => getQueryState(key).error !== undefined
  );

export interface PickedPerson {
  address: string;
  name: string | null;
}

export function JoinRequestPicker({
  me,
  onPick,
}: {
  /** The signed-in Minter Admin. */
  me: string;
  /** Decline was pressed on a row. */
  onPick: (person: PickedPerson) => void;
}) {
  const nominations = useNominations();
  const ready = useJoinRequests(nominations.data?.loadedAt);
  // Each person's open nomination; if they can't be read, Decline still shows (its guard checks).
  const open = useMemo(
    () =>
      nominations.data
        ? new Map(nominations.data.open.map((n) => [n.nominee, n]))
        : nominations.isError
          ? new Map<string, Nomination>()
          : null,
    [nominations.data, nominations.isError]
  );
  const declines = useWaitingDeclines();
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [sort, setSort] = useState<ReadySort>(DEFAULT_READY_SORT);
  const [shown, setShown] = useState(READY_PAGE);
  const listRef = useRef<HTMLUListElement | null>(null);
  const focusRow = useRef<number | null>(null);
  const find = useJoinRequestSearch(search);
  const query = find.query;
  const all = ready.data?.people;
  const order = useQuery(all && sort !== 'node' ? readyOrderKey(all, sort) : null, () =>
    loadReadyOrder(all as string[], sort)
  );
  // Your node's order while a failed order can't be read (with a note saying so).
  const sorted = !all
    ? undefined
    : sort === 'node'
      ? all
      : (order.data ?? (order.isError ? all : undefined));
  const sorting = Boolean(all && !sorted);
  const people = useMemo(
    () => (sorted && query ? matchReady(sorted, query, find.owners, knownName) : sorted),
    [sorted, query, find.owners]
  );
  // A new search or order starts again at the first page.
  const [shownFor, setShownFor] = useState(`${query}|${sort}`);
  if (shownFor !== `${query}|${sort}`) {
    setShownFor(`${query}|${sort}`);
    setShown(READY_PAGE);
  }
  const visible = people ? people.slice(0, shown) : [];
  // Rows that have come near the screen: only theirs are read.
  const [near, setNear] = useState<ReadonlySet<string>>(() => new Set());
  const onNear = useCallback(
    (address: string) =>
      setNear((current) => (current.has(address) ? current : new Set(current).add(address))),
    []
  );
  const visibleKey = visible.filter((address) => near.has(address)).join(',');

  // Only the rows on screen are read, six reads at a time; leaving stops new reads.
  // Each refresh of the list (when the nominations refresh) reads again the rows whose
  // read failed or is older than 10 minutes; the rest are cached and cost nothing.
  // A row whose read failed waits for that refresh: another row coming near doesn't
  // read it again.
  const listUpdatedAt = ready.updatedAt;
  const tried = useRef<{ at: number; rows: Set<string> }>({ at: -1, rows: new Set() });
  useEffect(() => {
    if (!visibleKey) return;
    if (tried.current.at !== listUpdatedAt) tried.current = { at: listUpdatedAt, rows: new Set() };
    const { rows } = tried.current;
    const toRead = visibleKey
      .split(',')
      .filter((address) => !rows.has(address) || !readFailed(address));
    for (const address of toRead) rows.add(address);
    if (!toRead.length) return;
    const controller = new AbortController();
    void loadReadyDetails(toRead, { signal: controller.signal });
    return () => controller.abort();
  }, [visibleKey, listUpdatedAt]);

  // After "Show more", focus moves to the first new row.
  useEffect(() => {
    if (focusRow.current === null) return;
    listRef.current?.children[focusRow.current]?.querySelector<HTMLElement>('a, button')?.focus();
    focusRow.current = null;
  }, [shown]);

  const clearSearch = () => {
    setSearch('');
    // The button goes with the empty state: keep focus on the search box.
    searchRef.current?.focus();
  };

  // No match is said here too: the empty state below mounts already filled,
  // which screen readers don't reliably read out.
  const found =
    !query || !all?.length || !people
      ? ''
      : find.looking
        ? 'Looking up names…'
        : people.length === 0
          ? `None of ${formatCount(all.length)} match “${query}”.`
          : `${formatCount(people.length)} of ${formatCount(all.length)} ${people.length === 1 ? 'matches' : 'match'} “${query}”.${find.failed ? ' Names couldn’t be looked up just now, so only addresses and names already shown count.' : ''}`;

  let body: ReactNode;
  if (!people && ready.isError) {
    body = (
      <ErrorState
        title="Couldn’t load who asked to join MINTER."
        error={ready.error}
        onRetry={() => void ready.refetch()}
      />
    );
  } else if (sorting) {
    body = (
      <ListSkeleton
        count={3}
        label={`Sorting: ${READY_SORTS.find((s) => s.key === sort)?.label ?? ''}`}
      />
    );
  } else if (!people) {
    body = <ListSkeleton count={3} label="Loading who asked to join MINTER" />;
  } else if (all?.length === 0) {
    body = (
      <EmptyState
        title="No one has asked to join right now"
        description="A join request shows up here until a nomination makes them a member, or the Minter Admins decline it."
      />
    );
  } else if (people.length === 0 && find.looking) {
    body = <ListSkeleton count={1} label="Looking up names" />;
  } else if (people.length === 0) {
    body = (
      <EmptyState
        title={`No one on this list matches “${query}”`}
        description={
          isAddress(query)
            ? 'This address hasn’t asked to join MINTER, or is a member already.'
            : find.failed
              ? 'Couldn’t look up names on your node just now. Try again, or search by their address.'
              : 'Try their full registered name, or their address.'
        }
        actionLabel="Clear the search"
        onAction={clearSearch}
      />
    );
  } else {
    const left = people.length - visible.length;
    body = (
      <>
        <Box
          component="ul"
          ref={listRef}
          aria-label={JOIN_REQUESTS_TITLE}
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
          }}
        >
          {visible.map((address) => (
            <JoinRequestRow
              key={address}
              address={address}
              nomination={open ? (open.get(address) ?? null) : undefined}
              me={me}
              onNear={onNear}
              declineWaiting={declines.waiting.get(address) ?? null}
              onPick={onPick}
            />
          ))}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {formatCount(visible.length)} of {formatCount(people.length)} shown
          </Typography>
          {left > 0 ? (
            <Button
              variant="outlined"
              onClick={() => {
                focusRow.current = visible.length;
                setShown(shown + READY_PAGE);
              }}
              sx={{ minHeight: 44 }}
            >
              Show {formatCount(Math.min(READY_PAGE, left))} more
            </Button>
          ) : null}
        </Box>
        {sort !== 'node' && order.isError && !order.data ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" role="note">
              Couldn’t read everyone’s details to sort just now, so this is your node’s order.
            </Typography>
            <Button size="small" onClick={() => void order.refetch()} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          </Box>
        ) : null}
        {ready.data?.truncated ? (
          <Typography variant="body2" color="text.secondary" role="note">
            The member list was too long to read in full, so someone here may already be a member.
          </Typography>
        ) : null}
      </>
    );
  }

  return (
    <Box
      component="section"
      aria-labelledby="join-requests-title"
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}
    >
      <Typography id="join-requests-title" component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {JOIN_REQUESTS_TITLE}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        People who asked to join MINTER and aren’t members. Pick whose request to decline.
      </Typography>
      <TextField
        type="search"
        inputRef={searchRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or address"
        size="small"
        fullWidth
        slotProps={{
          htmlInput: {
            'aria-label': 'Search who asked to join MINTER, by name or address',
            enterKeyHint: 'search',
            autoCapitalize: 'none',
            spellCheck: false,
          },
          input: {
            sx: { minHeight: 44 },
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlinedIcon aria-hidden />
              </InputAdornment>
            ),
          },
        }}
      />
      {all?.length ? (
        <TextField
          select
          label="Sort"
          size="small"
          value={sort}
          onChange={(e) => setSort(e.target.value as ReadySort)}
          slotProps={{ select: { native: true } }}
          sx={{
            alignSelf: 'flex-start',
            width: { xs: '100%', sm: 260 },
            '& .MuiInputBase-root': { minHeight: 44 },
          }}
        >
          {READY_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </TextField>
      ) : null}
      {/* What the search found, read out as it changes; shown above the rows only
          (the skeleton or the empty state already says the rest on screen). */}
      <Typography
        variant="body2"
        color="text.secondary"
        role="status"
        className={found && people?.length ? undefined : 'qmp-visually-hidden'}
      >
        {found}
      </Typography>
      {body}
    </Box>
  );
}

function blocksMintedText(blocks: number): string {
  if (blocks <= 0) return 'no blocks minted yet';
  return `${formatCount(blocks)} ${blocks === 1 ? 'block' : 'blocks'} minted`;
}

/** One person: avatar, name or short address (to their profile), level and blocks minted, Decline. */
function JoinRequestRow({
  address,
  nomination,
  me,
  onNear,
  declineWaiting,
  onPick,
}: {
  address: string;
  /** Their open nomination, null for none, undefined while the nominations load. */
  nomination: Nomination | null | undefined;
  me: string;
  /** Called once the row comes near the screen, so its account and name are read. */
  onNear: (address: string) => void;
  /** The waiting decline of their join request (its signature), if any. */
  declineWaiting: string | null;
  onPick: (person: PickedPerson) => void;
}) {
  const [row, setRow] = useState<HTMLLIElement | null>(null);
  const near = useInView(row);
  useEffect(() => {
    if (near) onNear(address);
  }, [near, onNear, address]);
  const account = useStoredValue<AccountInfo>(`account:${address}`);
  const name = useStoredValue<string | null>(`name:${address}`);
  const former = useStoredValue<FormerMember | null>(formerKey(address)).data ?? null;
  const asked = useStoredValue<number | null>(askedKey(address)).data ?? null;
  const declinePending = usePendingWrite(writeKeys.propose('kick', address));
  // Never undefined: PersonChip would look the name up itself, outside the six-at-a-time reads.
  const shownName = name.data ?? null;
  const label = displayName(shownName, address);

  const level = account.data ? (
    `Level ${account.data.level} · ${blocksMintedText(effectiveBlocksMinted(account.data))}${asked ? ` · asked ${formatDate(asked)}` : ''}`
  ) : account.status === 'error' ? (
    'Level not available right now'
  ) : (
    <Skeleton variant="text" width={180} aria-hidden />
  );
  const secondary = former ? (
    <>
      {level}
      <Box component="span" sx={{ display: 'block' }}>
        {formerMemberLine(former)}
      </Box>
    </>
  ) : (
    level
  );

  // Declining: one on its way, one waiting, a nomination open, or Decline.
  let action: ReactNode = null;
  if (declinePending && declinePending.status !== 'failed') {
    action = (
      <Typography
        variant="body2"
        role="status"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: readable('success') }}
      >
        <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
        {declinePending.status === 'sending' ? 'Sending…' : 'Decline sent ✓ (confirming…)'}
      </Typography>
    );
  } else if (declineWaiting) {
    action = (
      <Link
        component={RouterLink}
        to={decisionPath(declineWaiting)}
        variant="body2"
        aria-label={`${DECLINE_WAITING}: open the decision about ${label}`}
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
      >
        {DECLINE_WAITING}
      </Link>
    );
  } else if (nomination) {
    action = (
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {nomination.state === 'approved' ? 'Approved' : 'Nominated'}
      </Typography>
    );
  } else if (address !== me) {
    action = (
      <Button
        variant="outlined"
        onClick={() => onPick({ address, name: shownName })}
        aria-label={`Decline ${label}’s join request`}
        sx={{ minHeight: 44 }}
      >
        Decline
      </Button>
    );
  }

  return (
    <Box
      ref={setRow}
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 2,
        rowGap: 1,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        minHeight: 64,
        '& + &': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
        <PersonChip address={address} name={shownName} size={40} secondary={secondary} />
      </Box>
      {action ? <Box sx={{ ml: 'auto' }}>{action}</Box> : null}
    </Box>
  );
}
