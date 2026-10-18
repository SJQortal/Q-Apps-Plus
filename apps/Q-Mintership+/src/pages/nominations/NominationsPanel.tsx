/**
 * Decisions → Nominations (pages/decisions/decisionsViews.ts): everyone who
 * is up for MINTER right now, newest first, with filters by state
 * (`?state=`) and a search by name or address. Level 5+ members and Minter
 * Admins add their support to open nominations; Minter Admins open the ones
 * collecting approvals in Decisions. How a nomination ended is in History
 * (Invites), and on the nomination's own page.
 */
import { useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Chip, InputAdornment, TextField, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { Section } from '../../components/common/Section';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { NominationCard } from '../../components/nomination/NominationCard';
import { SupportDialog } from '../../components/nomination/SupportDialog';
import { PROPOSE_NOMINATION } from '../../constants/words';
import type { Nomination, NominationsData } from '../../data/nominations';
import { peekQuery } from '../../data/query';
import { useDisplayName } from '../../hooks/useDisplayName';
import type { UseQueryResult } from '../../hooks/useQuery';
import { appParam } from '../../routes/hubLocation';
import { PATHS, decisionPath, nominationPath } from '../../routes/paths';
import type { MyStatus } from '../../rules/status';
import type { Session } from '../../state/session';
import { formatCount } from '../../utils/format';
import { readable } from '../../utils/readable';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import type { Signer } from '../../writes/runner';
import {
  FILTERS,
  countByFilter,
  isStillOpenForSupport,
  matchesFilter,
  matchesSearch,
  myPart,
  parseFilter,
  type NominationFilter,
} from './filters';
import { NominateNote } from './OwnNomination';

const nameOf = (address: string) => peekQuery<string | null>(`name:${address}`);

export function NominationsPanel({
  nominations,
  me,
  isAdmin,
  canNominate,
  publishSigner,
  ownShown,
  session,
  status,
}: {
  nominations: UseQueryResult<NominationsData>;
  me: string;
  isAdmin: boolean;
  canNominate: boolean;
  /** Who publishes a support record: the signed-in account with its name. */
  publishSigner: (Signer & { name: string }) | null;
  /** The nominee's own nomination is on top of the page: no note about nominating. */
  ownShown: boolean;
  session: Session;
  status: MyStatus | undefined;
}) {
  const data = nominations.data;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(appParam(params, 'state'));
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [support, setSupport] = useState<{
    nominee: string;
    name: string | null;
    open: boolean;
  } | null>(null);

  const others = useMemo(() => (data ? data.open.filter((n) => n.nominee !== me) : []), [data, me]);
  const counts = useMemo(() => countByFilter(others), [others]);
  const shown = others.filter((n) => matchesFilter(n, filter) && matchesSearch(n, search, nameOf));

  const setFilter = (key: NominationFilter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('show', 'nominations');
        if (key === 'all') next.delete('state');
        else next.set('state', key);
        return next;
      },
      { replace: true }
    );
  const openSupport = (n: Nomination) =>
    setSupport({ nominee: n.nominee, name: n.nomineeName, open: true });
  const canSupport = canNominate && Boolean(publishSigner);

  return (
    <>
      <NominateNote session={session} status={status} hidden={ownShown} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
              'aria-label': 'Search nominations by name or address',
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
        <Box
          role="group"
          aria-label="Show nominations by state"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Chip
                key={f.key}
                clickable
                aria-pressed={active}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                onClick={() => setFilter(f.key)}
                label={
                  <>
                    {f.label}
                    {data ? (
                      <>
                        {' '}
                        <Box component="span" sx={{ ml: 0.5, fontWeight: 700 }}>
                          {formatCount(counts[f.key])}
                        </Box>
                      </>
                    ) : null}
                  </>
                }
                sx={{ height: { xs: 44, sm: 40 }, borderRadius: 999, px: 0.5 }}
              />
            );
          })}
        </Box>
      </Box>

      <Section title="Open nominations" id="open">
        {!data && nominations.isError ? (
          <ErrorState
            title="Couldn’t load the nominations."
            error={nominations.error}
            onRetry={() => void nominations.refetch()}
          />
        ) : !data ? (
          <ListSkeleton count={3} ring label="Loading nominations" />
        ) : others.length === 0 ? (
          <EmptyState
            title="No open nominations right now"
            description={
              canNominate
                ? 'Know someone who should mint? Propose a nomination, and the Minter Admins take it from there.'
                : 'When a level 5+ minter or a Minter Admin proposes a nomination, it shows up here.'
            }
            actionLabel={canNominate ? PROPOSE_NOMINATION : undefined}
            onAction={canNominate ? () => navigate(PATHS.nominate) : undefined}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title="No nominations match"
            description={
              search.trim()
                ? `Nothing here matches “${search.trim()}”.`
                : 'None in this view right now.'
            }
            actionLabel="Show all"
            onAction={() => {
              setSearch('');
              setFilter('all');
              searchRef.current?.focus();
            }}
          />
        ) : (
          <Box
            component="ul"
            aria-label="Open nominations"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            {shown.map((n) => (
              <li key={n.nominee}>
                <NominationCard
                  nomination={n}
                  now={data.decisions.now}
                  compact
                  comments
                  actions={
                    <CardActions
                      n={n}
                      me={me}
                      canSupport={canSupport}
                      isAdmin={isAdmin}
                      onSupport={() => openSupport(n)}
                    />
                  }
                />
              </li>
            ))}
          </Box>
        )}
        {data?.truncated ? <TruncatedNote what="the nominations" /> : null}
      </Section>

      {support ? (
        <SupportDialog
          key={support.nominee}
          open={support.open}
          nominee={support.nominee}
          nomineeName={support.name}
          signer={publishSigner}
          onClose={() => setSupport((s) => (s ? { ...s, open: false } : s))}
        />
      ) : null}
    </>
  );
}

function CardActions({
  n,
  me,
  canSupport,
  isAdmin,
  onSupport,
}: {
  n: Nomination;
  me: string;
  canSupport: boolean;
  isAdmin: boolean;
  onSupport: () => void;
}) {
  const pending = usePendingWrite(writeKeys.support(n.nominee));
  const collecting = n.state === 'waiting' || n.state === 'signing';
  const part = myPart(n, me, pending);
  const mine = part?.label ?? null;
  // Every card has these buttons: their names say whose card they are on (as the card shows it).
  const who = useDisplayName(n.nominee, n.nomineeName ?? undefined).label;

  return (
    <>
      {mine ? (
        <Typography
          variant="body2"
          role={part?.inFlight ? 'status' : undefined}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: readable('success'),
          }}
        >
          <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
          {mine}
        </Typography>
      ) : null}
      <Button
        component={RouterLink}
        to={nominationPath(n.nominee)}
        variant="text"
        aria-label={`Details about ${who}`}
        sx={{ minHeight: 44 }}
      >
        Details
      </Button>
      {isAdmin && collecting ? (
        <Button
          component={RouterLink}
          to={n.decision ? decisionPath(n.decision.signature) : PATHS.decisions}
          variant="outlined"
          aria-label={`Open in Decisions: ${who}`}
          sx={{ minHeight: 44 }}
        >
          Open in Decisions
        </Button>
      ) : null}
      {!mine && canSupport && isStillOpenForSupport(n) && n.nominee !== me ? (
        <Button
          variant="contained"
          onClick={onSupport}
          aria-label={`Add your support for ${who}`}
          sx={{ minHeight: 44 }}
        >
          Add your support
        </Button>
      ) : null}
    </>
  );
}
