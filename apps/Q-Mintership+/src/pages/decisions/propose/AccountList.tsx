/**
 * A list of accounts to pick from, as Requested to join MINTER Group is for
 * Decline a join request (Simon, 2026-10-18: "when clicking lift a ban I
 * would like to have a list of the banned accounts at the bottom too. The
 * same with cancel approved invite and others"): the members for Remove a
 * member, the Minter Admins for Remove a Minter Admin, the bans in force for
 * Lift a ban, and so on, each page giving its own rows and words.
 *
 * Each row: avatar and name (to their profile), what the list says about
 * them, their level and blocks minted, and the page's button, or why not:
 * a proposal like this one already waits for them (their name crossed out,
 * with a link to it), or something else stops it. Twenty rows at a time,
 * in the page's order; each row's account (and its name, where the list
 * doesn't carry it) is read only once it is shown, six reads at a time
 * (data/accountRows.ts). The search box filters it: a typed address
 * directly, a typed name through its owners (one small name search, cached)
 * and the names the list already has, never by reading every row's name.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, InputAdornment, Link, Skeleton, TextField, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { PersonChip } from '../../../components/common/Person';
import { EmptyState, ErrorState, ListSkeleton } from '../../../components/common/states';
import { effectiveBlocksMinted, isAddress } from '../../../data/accounts';
import { loadAccountRows } from '../../../data/accountRows';
import { getQueryState, peekQuery } from '../../../data/query';
import { READY_PAGE, matchReady } from '../../../data/readyToMint';
import type { AccountInfo } from '../../../data/types';
import { useInView } from '../../../hooks/useInView';
import { decisionPath } from '../../../routes/paths';
import { displayName, formatCount } from '../../../utils/format';
import { readable } from '../../../utils/readable';
import { useJoinRequestSearch, useStoredValue } from '../useJoinRequests';
import { blocksMintedText } from './pickRows';

export interface PickedAccount {
  address: string;
  /** Their name; null when they have none, left out when it isn't known yet (a link's). */
  name?: string | null;
}

export interface AccountRow {
  address: string;
  /** Its name when the list already has it (members, admins); else read once it is shown. */
  name?: string | null;
  /** What this list says about them, under the name. */
  details?: ReactNode;
  /** A proposal like this one already waits for them: its signature. */
  waiting?: string | null;
  /** This device has just proposed it: on its way into a block. */
  proposed?: boolean;
  /** It can't be picked here, and why (instead of the button). */
  blocked?: ReactNode;
}

export interface AccountListProps {
  /** For the heading's id. */
  id: string;
  title: string;
  intro: ReactNode;
  /** The rows in the page's order; undefined while they load. */
  rows: AccountRow[] | undefined;
  /** The rows couldn't be read (shown only when there are none). */
  error?: unknown;
  onRetry?: () => void;
  /** The search box's accessible name: "Search the members, by name or address". */
  searchLabel: string;
  /** A sort picker, when the page offers one. */
  sort?: {
    value: string;
    options: ReadonlyArray<{ key: string; label: string }>;
    onChange: (key: string) => void;
  };
  /** When there is no one at all. */
  empty: { title: string; description?: string };
  /** The button's words ("Remove") and its accessible name for one row ("Remove Kai Target"). */
  pick: { label: string; name: (label: string) => string };
  /** What a row says while a proposal like this one waits for them. */
  waitingText: string;
  onPick: (person: PickedAccount) => void;
  /** Between the search and the rows (Cancel all older, on the invites). */
  actions?: ReactNode;
  /** Under "no one here matches": another way on (Ban's look up anyone). */
  notFound?: (query: string) => ReactNode;
  /** Read each row's name too: the list doesn't carry names. */
  readNames?: boolean;
}

/** A name already read for a row on screen (searching never reads one). */
const knownName = (address: string) => peekQuery<string | null>(`name:${address}`);

/** A row's account read failed last time. */
const readFailed = (address: string) =>
  [`account:${address}`, `name:${address}`].some((key) => getQueryState(key).error !== undefined);

export function AccountList({
  id,
  title,
  intro,
  rows,
  error,
  onRetry,
  searchLabel,
  sort,
  empty,
  pick,
  waitingText,
  onPick,
  actions,
  notFound,
  readNames = false,
}: AccountListProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [shown, setShown] = useState(READY_PAGE);
  const listRef = useRef<HTMLUListElement | null>(null);
  const focusRow = useRef<number | null>(null);
  const find = useJoinRequestSearch(search);
  const query = find.query;
  const byAddress = useMemo(() => new Map((rows ?? []).map((r) => [r.address, r])), [rows]);
  const people = useMemo(() => {
    if (!rows) return undefined;
    const addresses = rows.map((r) => r.address);
    if (!query) return addresses;
    const nameOf = (address: string) => byAddress.get(address)?.name ?? knownName(address);
    return matchReady(addresses, query, find.owners, nameOf);
  }, [rows, byAddress, query, find.owners]);
  // A new search or order starts again at the first page.
  const orderKey = `${query}|${sort?.value ?? ''}`;
  const [shownFor, setShownFor] = useState(orderKey);
  if (shownFor !== orderKey) {
    setShownFor(orderKey);
    setShown(READY_PAGE);
  }
  const visible = people ? people.slice(0, shown) : [];

  // Rows that have come near the screen: only theirs are read, six reads at a time.
  const [near, setNear] = useState<ReadonlySet<string>>(() => new Set());
  const onNear = useCallback(
    (address: string) =>
      setNear((current) => (current.has(address) ? current : new Set(current).add(address))),
    []
  );
  const visibleKey = visible.filter((address) => near.has(address)).join(',');
  // Cached reads cost nothing, and one cut short by a quick scroll is read again; a read
  // that failed isn't tried again on every scroll (its row says so).
  const tried = useRef(new Set<string>());
  useEffect(() => {
    if (!visibleKey) return;
    const toRead = visibleKey
      .split(',')
      .filter((address) => !tried.current.has(address) || !readFailed(address));
    for (const address of toRead) tried.current.add(address);
    if (!toRead.length) return;
    const controller = new AbortController();
    void loadAccountRows(toRead, { names: readNames, signal: controller.signal });
    return () => controller.abort();
  }, [visibleKey, readNames]);

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

  const all = rows?.length ?? 0;
  // No match is said here too: the empty state below mounts already filled,
  // which screen readers don't reliably read out.
  const found =
    !query || !all || !people
      ? ''
      : find.looking
        ? 'Looking up names…'
        : people.length === 0
          ? `None of ${formatCount(all)} match “${query}”.`
          : `${formatCount(people.length)} of ${formatCount(all)} ${people.length === 1 ? 'matches' : 'match'} “${query}”.${find.failed ? ' Names couldn’t be looked up just now, so only addresses and names already shown count.' : ''}`;

  let body: ReactNode;
  if (!rows && error) {
    body = (
      <ErrorState title={`Couldn’t load ${title.toLowerCase()}.`} error={error} onRetry={onRetry} />
    );
  } else if (!people) {
    body = <ListSkeleton count={3} label={`Loading ${title.toLowerCase()}`} />;
  } else if (all === 0) {
    body = <EmptyState title={empty.title} description={empty.description} />;
  } else if (people.length === 0 && find.looking) {
    body = <ListSkeleton count={1} label="Looking up names" />;
  } else if (people.length === 0) {
    body = (
      <>
        <EmptyState
          title={`No one on this list matches “${query}”`}
          description={
            isAddress(query)
              ? 'This address isn’t on this list.'
              : find.failed
                ? 'Couldn’t look up names on your node just now. Try again, or search by their address.'
                : 'Try their full registered name, or their address.'
          }
          actionLabel="Clear the search"
          onAction={clearSearch}
        />
        {notFound ? notFound(query) : null}
      </>
    );
  } else {
    const left = people.length - visible.length;
    body = (
      <>
        <Box
          component="ul"
          ref={listRef}
          aria-label={title}
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
            <Row
              key={address}
              row={byAddress.get(address) ?? { address }}
              onNear={onNear}
              pick={pick}
              waitingText={waitingText}
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
      </>
    );
  }

  return (
    <Box
      component="section"
      aria-labelledby={`${id}-title`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}
    >
      <Typography id={`${id}-title`} component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {intro}
      </Typography>
      {all ? (
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
              'aria-label': searchLabel,
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
      ) : null}
      {sort && all > 1 ? (
        <TextField
          select
          label="Sort"
          size="small"
          value={sort.value}
          onChange={(e) => sort.onChange(e.target.value)}
          slotProps={{ select: { native: true } }}
          sx={{
            alignSelf: 'flex-start',
            width: { xs: '100%', sm: 260 },
            '& .MuiInputBase-root': { minHeight: 44 },
          }}
        >
          {sort.options.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </TextField>
      ) : null}
      {actions}
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

/** One account: avatar, name (to their profile), what the list says, level and blocks minted, and the button. */
function Row({
  row,
  onNear,
  pick,
  waitingText,
  onPick,
}: {
  row: AccountRow;
  /** Called once the row comes near the screen, so its account (and name) are read. */
  onNear: (address: string) => void;
  pick: AccountListProps['pick'];
  waitingText: string;
  onPick: (person: PickedAccount) => void;
}) {
  const { address } = row;
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const isNear = useInView(node);
  useEffect(() => {
    if (isNear) onNear(address);
  }, [isNear, onNear, address]);
  const account = useStoredValue<AccountInfo>(`account:${address}`);
  const stored = useStoredValue<string | null>(`name:${address}`);
  // Never undefined: PersonChip would look the name up itself, outside the six-at-a-time reads.
  const name = row.name !== undefined ? row.name : (stored.data ?? null);
  const label = displayName(name, address);

  const level = account.data ? (
    `Level ${account.data.level} · ${blocksMintedText(effectiveBlocksMinted(account.data))}`
  ) : account.status === 'error' ? (
    'Level not available right now'
  ) : (
    <Skeleton variant="text" width={180} aria-hidden />
  );
  const secondary = (
    <>
      {row.details ? (
        <Box component="span" sx={{ display: 'block' }}>
          {row.details}
        </Box>
      ) : null}
      <Box component="span" sx={{ display: 'block' }}>
        {level}
      </Box>
    </>
  );

  let action: ReactNode;
  if (row.proposed) {
    action = (
      <Typography
        variant="body2"
        role="status"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: readable('success') }}
      >
        <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
        Proposed ✓ (confirming…)
      </Typography>
    );
  } else if (row.waiting) {
    action = (
      <Link
        component={RouterLink}
        to={decisionPath(row.waiting)}
        variant="body2"
        aria-label={`${waitingText}: open the decision about ${label}`}
        sx={{ display: 'inline-flex', alignItems: 'center', minHeight: 44 }}
      >
        {waitingText}
      </Link>
    );
  } else if (row.blocked) {
    action = (
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {row.blocked}
      </Typography>
    );
  } else {
    action = (
      <Button
        variant="outlined"
        onClick={() => onPick({ address, name })}
        aria-label={pick.name(label)}
        sx={{ minHeight: 44 }}
      >
        {pick.label}
      </Button>
    );
  }

  return (
    <Box
      ref={setNode}
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
        <PersonChip
          address={address}
          name={name}
          size={40}
          secondary={secondary}
          struck={Boolean(row.waiting)}
        />
      </Box>
      <Box sx={{ ml: 'auto', maxWidth: '100%' }}>{action}</Box>
    </Box>
  );
}
