/**
 * One person's nomination (/nominations/<address>): its unique, shareable
 * link. Their current or latest nomination in full (who nominated, who
 * supports, the reason and links, where it stands), then every round: each
 * MINTER invite for them, with how it ended and a link to its decision. A
 * name in place of the address opens that name's owner.
 *
 * Reads: the same cached reads as their person page's nomination (records
 * that name them, their MINTER history, the queue), plus the group's
 * settings and the tip. Nothing about the whole group.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Box, Button, Typography, type ChipProps } from '@mui/material';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { PersonChip, PersonInline } from '../../components/common/Person';
import { Section, ToneChip } from '../../components/common/Section';
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { NominationCard } from '../../components/nomination/NominationCard';
import { NomineeAction } from '../../components/nomination/NomineeAction';
import { nomineeStep } from '../../components/nomination/nomineeStep';
import { getNameOwner, isAddress } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import {
  useAddressHistory,
  useChainNow,
  useGroupInfo,
  useMyStatus,
  useNominationsFor,
} from '../../hooks/useData';
import { useDisplayName } from '../../hooks/useDisplayName';
import { useQuery } from '../../hooks/useQuery';
import { PROPOSE_NOMINATION } from '../../constants/words';
import { PATHS, decisionPath, nominatePath, nominationPath, personPath } from '../../routes/paths';
import { isOpenState } from '../../rules/nomination';
import { OUTCOME_LABEL, outcomeSentence, type DecisionOutcome } from '../../rules/outcome';
import { nominationRounds, type NominationRound } from '../../rules/rounds';
import type { MyStatus } from '../../rules/status';
import { signerOf, useSession } from '../../state/session';
import { formatBlock, formatDate } from '../../utils/format';
import { ListCard } from '../history/parts/TimelineList';

export default function NominationPage() {
  const { address: param = '' } = useParams();
  const value = param.trim();
  if (isAddress(value)) return <NominationView key={value} address={value} />;
  return <NameLookup key={value} name={value} />;
}

function Shell({
  subtitle,
  address,
  children,
}: {
  subtitle: string;
  address?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Nomination"
        subtitle={subtitle}
        back={PATHS.nominations}
        actions={
          address ? <CopyLinkButton path={nominationPath(address)} what="this nomination" /> : null
        }
      />
      <PageBody $maxWidth={WIDE_PAGE}>{children}</PageBody>
    </>
  );
}

/** /nominations/<name>: open the name's owner's nomination, or say no one has it. */
function NameLookup({ name }: { name: string }) {
  const owner = useQuery(name ? `nameowner:${name}` : null, () => getNameOwner(name));
  if (owner.data) return <Navigate to={nominationPath(owner.data)} replace />;
  return (
    <Shell subtitle="One person’s nomination">
      {name && owner.isLoading ? (
        <CardSkeleton lines={3} />
      ) : owner.isError ? (
        <ErrorState
          title={`Couldn’t look up “${name}” on your node.`}
          error={owner.error}
          onRetry={() => void owner.refetch()}
        />
      ) : (
        <EmptyState
          title="No one found."
          description={
            name
              ? `“${name}” isn’t a Qortal address, and no account has that name.`
              : 'This link has no address in it.'
          }
        />
      )}
    </Shell>
  );
}

function NominationView({ address }: { address: string }) {
  const nominations = useNominationsFor(address);
  const history = useAddressHistory(address);
  const chain = useChainNow();
  const group = useGroupInfo();
  const viewer = useMyStatus();
  const who = useDisplayName(address);
  const navigate = useNavigate();

  const list = nominations.data ?? [];
  const current = list.find((n) => isOpenState(n.state)) ?? list[0] ?? null;
  const rounds =
    history.data && group.data
      ? nominationRounds(
          history.data.rows,
          address,
          group.data.maximumBlockDelay,
          current?.decision?.tx ?? null
        )
      : null;

  if (nominations.isError && !nominations.data) {
    return (
      <Shell subtitle={who.label} address={address}>
        <ErrorState
          title="Couldn’t load this nomination."
          error={nominations.error}
          onRetry={() => void nominations.refetch()}
        />
      </Shell>
    );
  }
  if (!nominations.data || !chain.data) {
    return (
      <Shell subtitle={who.label} address={address}>
        <CardSkeleton lines={4} ring />
        <ListSkeleton count={2} label="Loading the rounds" />
      </Shell>
    );
  }

  const nothing = !current && rounds !== null && rounds.length === 0;
  return (
    <Shell subtitle={who.label} address={address}>
      <PersonChip address={address} size={40} secondary="Nominee" />

      {nothing ? (
        <EmptyState
          title="No nomination for this person"
          description="Nobody has nominated them yet, and no Minter Admin has invited them."
          actionLabel={viewer.status?.canNominate ? PROPOSE_NOMINATION : undefined}
          onAction={() => navigate(nominatePath(address))}
        />
      ) : null}

      {current ? (
        <Section
          title={isOpenState(current.state) ? 'Nomination' : 'Latest nomination'}
          id="nomination-current"
        >
          <NominationCard
            nomination={current}
            now={chain.data}
            hideNominee
            copyLink={false}
            comments="open"
            forNominee={viewer.status?.address === current.nominee}
            actions={<CurrentActions nomination={current} viewer={viewer.status} />}
          />
        </Section>
      ) : null}

      <Section title="Rounds" id="nomination-rounds">
        {history.isError && !history.data ? (
          <ErrorState
            compact
            title="Couldn’t load their MINTER history."
            error={history.error}
            onRetry={() => void history.refetch()}
          />
        ) : !rounds ? (
          <ListSkeleton count={2} label="Loading the rounds" />
        ) : rounds.length ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              A round starts with a Minter Admin’s first approval, and ends when enough of them
              approve, as many reject it, or the time runs out.
            </Typography>
            <RoundsList rounds={rounds} msPerBlock={chain.data.msPerBlock} />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            No round yet: a round starts when a Minter Admin gives the first approval.
          </Typography>
        )}
        {history.data?.truncated ? <TruncatedNote what="their history" /> : null}
      </Section>

      <Box>
        <Button component={RouterLink} to={personPath(address)} sx={{ minHeight: 44 }}>
          Their MINTER profile and history
        </Button>
      </Box>
    </Shell>
  );
}

/** The viewer's part: their own next step, support, or the decision to sign. */
function CurrentActions({
  nomination: n,
  viewer,
}: {
  nomination: Nomination;
  viewer: MyStatus | undefined;
}) {
  const session = useSession();
  const self = Boolean(viewer && viewer.address === n.nominee);
  if (self && viewer) {
    const step = nomineeStep({
      isMember: viewer.isMember,
      activeBan: Boolean(viewer.activeBan),
      hasJoinRequest: viewer.hasJoinRequest || n.hasJoinRequest,
      storedInvite: Boolean(viewer.storedInvite) || n.hasStoredInvite,
      state: isOpenState(n.state) ? n.state : null,
      rejectedEnd: n.decision?.phase === 'rejectedMet',
    });
    return step ? (
      <NomineeAction
        step={step}
        signer={signerOf(session)}
        needed={n.decision?.tally?.needed ?? null}
        askWho={n.nomination?.publisher.name ?? null}
      />
    ) : null;
  }
  const mine =
    viewer?.address &&
    (n.nomination?.publisher.address === viewer.address ||
      n.supporters.some((s) => s.publisher.address === viewer.address));
  return (
    <>
      {n.decision ? (
        <Button
          component={RouterLink}
          to={decisionPath(n.decision.signature)}
          variant="outlined"
          sx={{ minHeight: 44 }}
        >
          Open the decision
        </Button>
      ) : null}
      {viewer?.isAdmin && n.state === 'waiting' ? (
        <Button
          component={RouterLink}
          to={PATHS.decisions}
          variant="outlined"
          sx={{ minHeight: 44 }}
        >
          First approval in Decisions
        </Button>
      ) : null}
      {viewer?.canNominate && n.state === 'waiting' && !mine ? (
        <Button
          component={RouterLink}
          to={nominatePath(n.nominee)}
          variant="contained"
          sx={{ minHeight: 44 }}
        >
          Add your support
        </Button>
      ) : null}
    </>
  );
}

const ROUND_CHIP: Record<
  DecisionOutcome,
  { color: ChipProps['color']; variant: ChipProps['variant'] }
> = {
  pending: { color: 'primary', variant: 'filled' },
  approved: { color: 'success', variant: 'filled' },
  applied: { color: 'success', variant: 'outlined' },
  rejected: { color: 'error', variant: 'outlined' },
  expired: { color: 'default', variant: 'outlined' },
  invalid: { color: 'warning', variant: 'outlined' },
};

function RoundsList({ rounds, msPerBlock }: { rounds: NominationRound[]; msPerBlock: number }) {
  return (
    <ListCard>
      <Box component="ol" aria-label="Rounds, newest first" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {rounds.map((round) => (
          <RoundItem key={round.signature} round={round} msPerBlock={msPerBlock} />
        ))}
      </Box>
    </ListCard>
  );
}

function RoundItem({ round, msPerBlock }: { round: NominationRound; msPerBlock: number }) {
  const chip = ROUND_CHIP[round.outcome];
  const decidedAt =
    round.decidedHeight !== null && round.startedHeight !== null
      ? round.startedAt + (round.decidedHeight - round.startedHeight) * msPerBlock
      : null;
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        py: 1.5,
        px: { xs: 1.5, sm: 2 },
        '& + &': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
          Round {round.number}
        </Typography>
        <ToneChip
          size="small"
          label={OUTCOME_LABEL[round.outcome]}
          color={chip.color}
          variant={chip.variant}
        />
      </Box>
      <Typography component="div" variant="body2" color="text.secondary">
        Started {formatDate(round.startedAt)}
        {round.startedHeight !== null ? ` (${formatBlock(round.startedHeight)})` : ''}
        {round.firstSigner ? (
          <>
            , first approval by <PersonInline address={round.firstSigner} />
          </>
        ) : null}
        .
      </Typography>
      {/* A round still collecting approvals has its chip; its decision page has the clock. */}
      {round.outcome === 'pending' ? null : (
        <Typography variant="body2">
          {outcomeSentence(round.outcome, 'invite')}
          {decidedAt !== null && round.outcome !== 'applied'
            ? ` ${round.outcome === 'expired' ? 'Expired' : 'Decided'} ${formatDate(decidedAt)}.`
            : ''}
        </Typography>
      )}
      <Box>
        <Button
          component={RouterLink}
          to={decisionPath(round.signature)}
          size="small"
          aria-label={`Open the decision of round ${round.number}`}
          sx={{ minHeight: 44, ml: -1 }}
        >
          Open the decision
        </Button>
      </Box>
    </Box>
  );
}
