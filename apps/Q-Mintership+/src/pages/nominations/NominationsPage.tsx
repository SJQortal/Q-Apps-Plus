/**
 * Nominations: everyone who is up for MINTER right now, newest first, with
 * filters by state and a search by name or address. Level 5+ members and
 * Minter Admins nominate from here (a floating button on phones, a header
 * button elsewhere) and add their support to open nominations; the nominee
 * sees their own nomination first, with Accept or Join now. Recently decided
 * ones sit in a collapsed section below, with "Nominate again" where a round
 * ran out of time.
 */
import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Fab,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ExpandLessOutlinedIcon from '@mui/icons-material/ExpandLessOutlined';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { FeeNote } from '../../components/common/FeeNote';
import { Card, Section } from '../../components/common/Section';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { BOTTOM_NAV_HEIGHT } from '../../components/layout/BottomNav';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { NominationCard } from '../../components/nomination/NominationCard';
import { NomineeAction } from '../../components/nomination/NomineeAction';
import { nomineeStep } from '../../components/nomination/nomineeStep';
import { SupportDialog } from '../../components/nomination/SupportDialog';
import { successText } from '../../components/nomination/tone';
import type { ChainNow } from '../../data/chain';
import type { Nomination } from '../../data/nominations';
import { peekQuery } from '../../data/query';
import { useMyStatus, useNominations } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { PATHS, decisionPath, nominatePath, personPath } from '../../routes/paths';
import type { MyStatus } from '../../rules/status';
import { signIn, signerOf, useSession, type Session } from '../../state/session';
import { displayName, formatCount } from '../../utils/format';
import { useLandscapeFrame, useShortFrame } from '../../utils/hubFrame';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import {
  FILTERS,
  canNominateAgain,
  countByFilter,
  isStillOpenForSupport,
  matchesFilter,
  matchesSearch,
  parseFilter,
  recentlyDecided,
  type NominationFilter,
} from './filters';

const DECIDED_PAGE = 10;
/** The floating button (48 px, 16 px above the bar) plus a margin. */
const FAB_CLEARANCE = 80;

const nameOf = (address: string) => peekQuery<string | null>(`name:${address}`);

export default function NominationsPage() {
  const session = useSession();
  const me = session.status === 'ready' ? session.address : '';
  const { status } = useMyStatus();
  const nominations = useNominations();
  const data = nominations.data;
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const shortFrame = useShortFrame();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = parseFilter(params.get('show'));
  const [search, setSearch] = useState('');
  const [decidedShown, setDecidedShown] = useState(0);
  const [support, setSupport] = useState<{
    nominee: string;
    name: string | null;
    open: boolean;
  } | null>(null);

  const signer = signerOf(session);
  const publishName = status?.name ?? signer?.name ?? null;
  const publishSigner = signer && publishName ? { ...signer, name: publishName } : null;
  const canNominate = Boolean(me && status?.canNominate);
  const isAdmin = Boolean(me && status?.isAdmin);
  // Phones get a floating button above the bottom bar; it steps aside for the keyboard.
  const fab = canNominate && phone && !landscape;

  const own = data && me ? (data.open.find((n) => n.nominee === me) ?? null) : null;
  const step =
    me && status
      ? nomineeStep({
          isMember: status.isMember,
          activeBan: Boolean(status.activeBan),
          hasJoinRequest: status.hasJoinRequest || Boolean(own?.hasJoinRequest),
          storedInvite: Boolean(status.storedInvite) || Boolean(own?.hasStoredInvite),
          state: own?.state ?? null,
        })
      : null;
  const showOwn = Boolean(own) || step === 'join';

  const others = useMemo(() => (data ? data.open.filter((n) => n.nominee !== me) : []), [data, me]);
  const counts = useMemo(() => countByFilter(others), [others]);
  const shown = others.filter((n) => matchesFilter(n, filter) && matchesSearch(n, search, nameOf));
  const decided = useMemo(
    () => (data ? recentlyDecided(data.all, data.decisions.now, data.decisions.group) : []),
    [data]
  ).filter((d) => matchesSearch(d.nomination, search, nameOf));

  const setFilter = (key: NominationFilter) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === 'all') next.delete('show');
        else next.set('show', key);
        return next;
      },
      { replace: true }
    );

  const openSupport = (n: Nomination) =>
    setSupport({ nominee: n.nominee, name: n.nomineeName, open: true });

  return (
    <>
      <PageHeader
        title="Nominations"
        subtitle="Who is up for MINTER right now."
        actions={
          <>
            <IconButton
              aria-label="Refresh nominations"
              onClick={() => void nominations.refetch()}
              disabled={nominations.fetching}
              sx={{ width: 44, height: 44 }}
            >
              <RefreshOutlinedIcon />
            </IconButton>
            {canNominate && !fab ? (
              <Button
                variant="contained"
                startIcon={<PersonAddAlt1OutlinedIcon />}
                onClick={() => navigate(PATHS.nominate)}
                sx={{ minHeight: 44 }}
              >
                Nominate someone
              </Button>
            ) : null}
          </>
        }
      />
      <PageBody>
        <NominateNote session={session} status={status} hidden={showOwn} />

        {showOwn && data ? (
          <Section title="Your nomination" id="mine">
            {own ? (
              <NominationCard
                nomination={own}
                now={data.decisions.now}
                actions={<NomineeAction step={step} signer={signer} />}
              />
            ) : (
              <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography sx={{ fontWeight: 700 }}>You were approved for MINTER</Typography>
                <Typography variant="body2" color="text.secondary">
                  One step left: join to become a member.
                </Typography>
                <Box>
                  <NomineeAction step={step} signer={signer} />
                </Box>
              </Card>
            )}
            {step === 'accept' ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                Accept now, so that once enough Minter Admins sign you become a member at once. It
                sends a join request (<FeeNote txType="JOIN_GROUP" prefix="fee" />
                ).
              </Typography>
            ) : null}
          </Section>
        ) : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            type="search"
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
            aria-label="Show nominations"
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
                        <Box component="span" sx={{ ml: 0.75, fontWeight: 700 }}>
                          {formatCount(counts[f.key])}
                        </Box>
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
                  ? 'Know someone who should mint? Nominate them, and the Minter Admins take it from there.'
                  : 'When a level 5+ minter or a Minter Admin nominates someone, it shows up here.'
              }
              actionLabel={canNominate ? 'Nominate someone' : undefined}
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
                    actions={
                      <CardActions
                        n={n}
                        me={me}
                        canSupport={canNominate && Boolean(publishSigner)}
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

        {data && decided.length ? (
          <RecentlyDecided
            decided={decided}
            now={data.decisions.now}
            shown={decidedShown}
            onShow={setDecidedShown}
            canNominate={canNominate}
            me={me}
          />
        ) : null}
        {/* Room under the last card, so the floating button never covers it. */}
        {fab ? <Box aria-hidden sx={{ height: FAB_CLEARANCE, flexShrink: 0 }} /> : null}
      </PageBody>

      {fab && !shortFrame ? (
        <Fab
          variant="extended"
          color="primary"
          onClick={() => navigate(PATHS.nominate)}
          sx={{
            position: 'fixed',
            right: 16,
            bottom: `calc(${BOTTOM_NAV_HEIGHT + 16}px + var(--qp-safe-bottom))`,
            zIndex: (theme) => theme.zIndex.speedDial,
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          <PersonAddAlt1OutlinedIcon aria-hidden sx={{ mr: 1 }} />
          Nominate
        </Fab>
      ) : null}

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

/** Why there is no Nominate button, said politely (nothing for those who can, or for nominees). */
function NominateNote({
  session,
  status,
  hidden,
}: {
  session: Session;
  status: MyStatus | undefined;
  hidden: boolean;
}) {
  if (hidden) return null;
  if (session.status === 'outside') {
    return (
      <Alert severity="info" variant="outlined">
        Open Q-Mintership+ in Qortal Hub or GO to nominate someone or add your support.
      </Alert>
    );
  }
  if (session.status === 'signedOut' || session.status === 'error') {
    return (
      <Alert
        severity="info"
        variant="outlined"
        action={
          <Button color="inherit" onClick={() => void signIn()} sx={{ minHeight: 44 }}>
            Sign in
          </Button>
        }
      >
        Sign in to nominate someone or add your support.
      </Alert>
    );
  }
  if (!status || status.canNominate || status.kind === 'nominated') return null;
  const toLevel5 = status.isMember && status.level < 5 ? status.progress.blocksToTarget : 0;
  return (
    <Alert severity="info" variant="outlined">
      {status.nominateBlock}
      {toLevel5 > 0 ? ` ${formatCount(toLevel5)} more blocks minted to reach level 5.` : ''}
    </Alert>
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
  const nominatedByMe = Boolean(me) && n.nomination?.publisher.address === me;
  const supportedByMe = Boolean(me) && n.supporters.some((s) => s.publisher.address === me);
  const collecting = n.state === 'waiting' || n.state === 'signing';
  const inFlight = Boolean(pending && pending.status !== 'failed');
  let mine = null;
  if (nominatedByMe) mine = 'You nominated them';
  else if (supportedByMe) mine = 'You support this';
  else if (inFlight)
    mine = pending?.status === 'sending' ? 'Sending…' : 'Support sent ✓ (confirming…)';

  return (
    <>
      {mine ? (
        <Typography
          variant="body2"
          role={inFlight ? 'status' : undefined}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: successText }}
        >
          <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
          {mine}
        </Typography>
      ) : null}
      <Button
        component={RouterLink}
        to={personPath(n.nominee)}
        variant="text"
        aria-label={`Details about ${displayName(n.nomineeName, n.nominee)}`}
        sx={{ minHeight: 44 }}
      >
        Details
      </Button>
      {isAdmin && collecting ? (
        <Button
          component={RouterLink}
          to={n.decision ? decisionPath(n.decision.signature) : PATHS.decisions}
          variant="outlined"
          sx={{ minHeight: 44 }}
        >
          Open in Decisions
        </Button>
      ) : null}
      {!mine && canSupport && isStillOpenForSupport(n) && n.nominee !== me ? (
        <Button variant="contained" onClick={onSupport} sx={{ minHeight: 44 }}>
          Add your support
        </Button>
      ) : null}
    </>
  );
}

function RecentlyDecided({
  decided,
  now,
  shown,
  onShow,
  canNominate,
  me,
}: {
  decided: ReturnType<typeof recentlyDecided>;
  now: ChainNow;
  shown: number;
  onShow: (count: number) => void;
  canNominate: boolean;
  me: string;
}) {
  const navigate = useNavigate();
  const open = shown > 0;
  const visible = decided.slice(0, shown);
  return (
    <Section
      title="Recently decided"
      id="decided"
      action={
        <Button
          onClick={() => onShow(open ? 0 : DECIDED_PAGE)}
          aria-expanded={open}
          aria-controls="decided-list"
          endIcon={open ? <ExpandLessOutlinedIcon /> : <ExpandMoreOutlinedIcon />}
          sx={{ minHeight: 44 }}
        >
          {open ? 'Hide' : `Show ${formatCount(decided.length)}`}
        </Button>
      }
    >
      <Box
        id="decided-list"
        sx={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 1.5 }}
      >
        {open ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              Joined, expired or closed in the last 30 days. An expired nomination can simply be
              made again.
            </Typography>
            <Box
              component="ul"
              aria-label="Recently decided nominations"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {visible.map(({ nomination: n, endedAt }) => (
                <li key={n.nominee}>
                  <NominationCard
                    nomination={n}
                    now={now}
                    compact
                    endedAt={endedAt}
                    actions={
                      canNominate && canNominateAgain(n) && n.nominee !== me ? (
                        <Button
                          variant="outlined"
                          onClick={() => navigate(nominatePath(n.nominee))}
                          sx={{ minHeight: 44 }}
                        >
                          Nominate again
                        </Button>
                      ) : null
                    }
                  />
                </li>
              ))}
            </Box>
            {decided.length > visible.length ? (
              <Button
                variant="outlined"
                onClick={() => onShow(shown + DECIDED_PAGE)}
                sx={{ minHeight: 44, alignSelf: 'center' }}
              >
                Show more
              </Button>
            ) : null}
          </>
        ) : null}
      </Box>
    </Section>
  );
}
