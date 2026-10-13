/**
 * Ready to mint (`/nominations?show=ready`): the people who asked to join
 * MINTER, for everyone to see, so nominators can find them. Level 5+ members
 * and Minter Admins get Propose nomination on each row, or Add your support where an
 * open nomination already exists. Twenty rows at a time, in Core's order;
 * each row's level, blocks minted, name and whether they were a member
 * before ("Former member: left MINTER on …", "… ban lifted on …") are read
 * only once it is shown.
 * The page's search box filters it: a typed address directly, a typed name
 * through its owners (one small name search, cached), never by reading
 * every row's name.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { PersonChip } from '../../components/common/Person';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { effectiveBlocksMinted, isAddress } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import { getQueryState, peekQuery } from '../../data/query';
import {
  READY_PAGE,
  formerKey,
  loadReadyDetails,
  matchReady,
  type ReadyToMint,
} from '../../data/readyToMint';
import type { AccountInfo } from '../../data/types';
import { useInView } from '../../hooks/useInView';
import type { UseQueryResult } from '../../hooks/useQuery';
import { PROPOSE_NOMINATION, proposeNominationFor } from '../../constants/words';
import { nominatePath } from '../../routes/paths';
import type { FormerMember } from '../../rules/status';
import { formerMemberLine } from '../person/personWords';
import { displayName, formatCount } from '../../utils/format';
import { readable } from '../../utils/readable';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import { isStillOpenForSupport, myPart } from './filters';
import { useReadySearch, useStoredValue } from './useReadyToMint';

/** A name already read for a row on screen (searching never reads one). */
const knownName = (address: string) => peekQuery<string | null>(`name:${address}`);

/** One of a row's reads (account, name, former-member mark) failed last time. */
const readFailed = (address: string) =>
  [`account:${address}`, `name:${address}`, formerKey(address)].some(
    (key) => getQueryState(key).error !== undefined
  );

export interface ReadyToMintSectionProps {
  ready: UseQueryResult<ReadyToMint>;
  /** Open nominations by nominee; null until they load (no actions until then). */
  open: Map<string, Nomination> | null;
  me: string;
  canNominate: boolean;
  /** Can publish a support record (eligible, with a name). */
  canSupport: boolean;
  onSupport: (n: Nomination) => void;
  /** The page's search box, as typed: a name or an address. */
  search: string;
  onClearSearch: () => void;
}

export function ReadyToMintSection({
  ready,
  open,
  me,
  canNominate,
  canSupport,
  onSupport,
  search,
  onClearSearch,
}: ReadyToMintSectionProps) {
  const [shown, setShown] = useState(READY_PAGE);
  const listRef = useRef<HTMLUListElement | null>(null);
  const focusRow = useRef<number | null>(null);
  const find = useReadySearch(search);
  const query = find.query;
  const all = ready.data?.people;
  const people = useMemo(
    () => (all && query ? matchReady(all, query, find.owners, knownName) : all),
    [all, query, find.owners]
  );
  // A new search starts again at the first page.
  const [shownFor, setShownFor] = useState(query);
  if (shownFor !== query) {
    setShownFor(query);
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
  // Each refresh of the list (every minute, or Refresh) reads again the rows whose
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
        title="Couldn’t load the people ready to mint."
        error={ready.error}
        onRetry={() => void ready.refetch()}
      />
    );
  } else if (!people) {
    body = <ListSkeleton count={3} label="Loading the people ready to mint" />;
  } else if (all?.length === 0) {
    body = (
      <EmptyState
        title="No one has asked to join right now"
        description="When someone sends MINTER a join request, they show up here, ready for a nomination."
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
        onAction={onClearSearch}
      />
    );
  } else {
    const left = people.length - visible.length;
    body = (
      <>
        <Box
          component="ul"
          ref={listRef}
          aria-label="Ready to mint"
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
            <ReadyRow
              key={address}
              address={address}
              nomination={open ? (open.get(address) ?? null) : undefined}
              me={me}
              canNominate={canNominate}
              canSupport={canSupport}
              onSupport={onSupport}
              onNear={onNear}
            />
          ))}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            // On phones it starts at the left, clear of the floating Propose nomination button
            // when a short (searched) list leaves it in that button's band.
            justifyContent: { xs: 'flex-start', sm: 'center' },
            flexWrap: 'wrap',
            gap: 1.5,
            px: { xs: 0.5, sm: 0 },
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
        {ready.data?.truncated ? (
          <Typography variant="body2" color="text.secondary" role="note" sx={{ px: 0.5 }}>
            The member list was too long to read in full, so someone here may already be a member.
          </Typography>
        ) : null}
      </>
    );
  }

  return (
    <Section title="Ready to mint" id="ready">
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        People who asked to join MINTER. They need a nomination from a level 5+ minter or a Minter
        Admin. Join requests carry no date, so this is the order your node lists them in.
      </Typography>
      {/* What the search found, read out as it changes; shown above the rows only
          (the skeleton or the empty state already says the rest on screen). */}
      <Typography
        variant="body2"
        color="text.secondary"
        role="status"
        className={found && people?.length ? undefined : 'qmp-visually-hidden'}
        sx={{ px: 0.5 }}
      >
        {found}
      </Typography>
      {body}
    </Section>
  );
}

function blocksMintedText(blocks: number): string {
  if (blocks <= 0) return 'no blocks minted yet';
  return `${formatCount(blocks)} ${blocks === 1 ? 'block' : 'blocks'} minted`;
}

/** One person: avatar, name or short address (to their page), level and blocks minted, the action. */
function ReadyRow({
  address,
  nomination,
  me,
  canNominate,
  canSupport,
  onSupport,
  onNear,
}: {
  address: string;
  /** Called once the row comes near the screen, so its account and name are read. */
  onNear: (address: string) => void;
  /** Their open nomination, null for none, undefined while the nominations load. */
  nomination: Nomination | null | undefined;
  me: string;
  canNominate: boolean;
  canSupport: boolean;
  onSupport: (n: Nomination) => void;
}) {
  const navigate = useNavigate();
  const [row, setRow] = useState<HTMLLIElement | null>(null);
  const near = useInView(row);
  useEffect(() => {
    if (near) onNear(address);
  }, [near, onNear, address]);
  const account = useStoredValue<AccountInfo>(`account:${address}`);
  const name = useStoredValue<string | null>(`name:${address}`);
  const former = useStoredValue<FormerMember | null>(formerKey(address)).data ?? null;
  const supportPending = usePendingWrite(nomination ? writeKeys.support(address) : null);
  const nominatePending = usePendingWrite(writeKeys.nominate(address));
  // Never undefined: PersonChip would look the name up itself, outside the six-at-a-time reads.
  const shownName = name.data ?? null;
  const label = displayName(shownName, address);

  const level = account.data ? (
    `Level ${account.data.level} · ${blocksMintedText(effectiveBlocksMinted(account.data))}`
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

  // `mine`: something the signed-in member did (green, with a tick); otherwise a plain fact.
  let done: { label: string; live: boolean; mine: boolean } | null = null;
  let action: ReactNode = null;
  if (address === me) {
    done = { label: 'That’s you', live: false, mine: false };
  } else if (nomination) {
    const part = myPart(nomination, me, supportPending);
    if (part) done = { label: part.label, live: part.inFlight, mine: true };
    else {
      done = {
        label: nomination.state === 'approved' ? 'Approved' : 'Nominated',
        live: false,
        mine: false,
      };
      if (canSupport && isStillOpenForSupport(nomination)) {
        action = (
          <Button
            variant="outlined"
            onClick={() => onSupport(nomination)}
            aria-label={`Add your support for ${label}`}
            sx={{ minHeight: 44 }}
          >
            Add your support
          </Button>
        );
      }
    }
  } else if (nominatePending && nominatePending.status !== 'failed') {
    done = {
      label: nominatePending.status === 'sending' ? 'Sending…' : 'Nomination sent ✓ (confirming…)',
      live: true,
      mine: true,
    };
  } else if (nomination === null && canNominate) {
    action = (
      <Button
        variant="outlined"
        onClick={() => navigate(nominatePath(address))}
        aria-label={proposeNominationFor(label)}
        sx={{ minHeight: 44 }}
      >
        {PROPOSE_NOMINATION}
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
      {done || action ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 1,
            ml: 'auto',
          }}
        >
          {done ? (
            <Typography
              variant="body2"
              role={done.live ? 'status' : undefined}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: done.mine ? readable('success') : 'text.secondary',
                fontWeight: done.mine ? 400 : 600,
              }}
            >
              {done.mine ? (
                <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
              ) : null}
              {done.label}
            </Typography>
          ) : null}
          {action}
        </Box>
      ) : null}
    </Box>
  );
}
