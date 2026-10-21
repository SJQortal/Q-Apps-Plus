/**
 * The member view under the hero, for those who can nominate (level 5+
 * members and every Minter Admin): their minting progress, the nominations
 * they made or support with where each stands, and open nominations they
 * could support.
 */
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { NominationCard } from '../../components/nomination/NominationCard';
import { PersonChip } from '../../components/common/Person';
import { ProgressBar } from '../../components/common/ProgressRing';
import { Card, LevelBadge, NominationStateChip, Section } from '../../components/common/Section';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { NOMINATOR_MIN_LEVEL } from '../../data/constants';
import { useChainNow, useNominations } from '../../hooks/useData';
import { PROPOSE_NOMINATION } from '../../constants/words';
import {
  PATHS,
  decisionPath,
  decisionsViewPath,
  nominatePath,
  nominationPath,
} from '../../routes/paths';
import type { Nomination } from '../../data/nominations';
import { useDisplayName } from '../../hooks/useDisplayName';
import type { MyStatus } from '../../rules/status';
import { formatCount } from '../../utils/format';
import { Num } from './Hero';
import { levelFraction, myNominations, supportable } from './homeData';
import { withMarkedName } from '../../components/common/markedText';

const MINE_MAX = 3;
const SUPPORT_MAX = 3;

function MintingCard({ status }: { status: MyStatus }) {
  const { nextLevelAt, blocksToNextLevel, blocksToTarget } = status.progress;
  const fraction = levelFraction(status.level, status.blocksMinted);
  return (
    <Section title="Your minting" id="home-minting">
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <LevelBadge level={status.level} />
          <Typography>
            <Num>{formatCount(status.blocksMinted)}</Num> blocks minted
          </Typography>
        </Box>
        {nextLevelAt !== null && blocksToNextLevel !== null ? (
          <>
            <ProgressBar
              value={fraction}
              label={`Progress to level ${status.level + 1}: ${Math.round(fraction * 100)}%`}
            />
            <Typography variant="body2" color="text.secondary">
              <Num>{formatCount(blocksToNextLevel)}</Num> blocks to level {status.level + 1} (at{' '}
              {formatCount(nextLevelAt)})
              {status.level < NOMINATOR_MIN_LEVEL &&
              blocksToTarget > 0 &&
              status.level + 1 < NOMINATOR_MIN_LEVEL
                ? `, ${formatCount(blocksToTarget)} to level ${NOMINATOR_MIN_LEVEL}`
                : ''}
              .
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            You&rsquo;re at the top level.
          </Typography>
        )}
      </Card>
    </Section>
  );
}

export function MemberSection({ status }: { status: MyStatus }) {
  const nominations = useNominations(true);
  const now = useChainNow();
  const navigate = useNavigate();
  const data = nominations.data;
  const chainNow = now.data;
  const mine = data ? myNominations(data.all, status.address) : [];
  const toSupport = data ? supportable(data.open, status.address) : [];

  const loadingOrError = !data ? (
    nominations.isError ? (
      <ErrorState
        compact
        title="Couldn't load the nominations."
        error={nominations.error}
        onRetry={() => void nominations.refetch()}
      />
    ) : (
      <ListSkeleton count={2} label="Loading the nominations" />
    )
  ) : null;

  return (
    <>
      <MintingCard status={status} />

      <Section
        title="Your nominations"
        id="home-mine"
        action={
          status.canNominate ? (
            <Button component={RouterLink} to={nominatePath()} sx={{ minHeight: 44 }}>
              {PROPOSE_NOMINATION}
            </Button>
          ) : undefined
        }
      >
        {loadingOrError ??
          (mine.length && chainNow ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {mine.slice(0, MINE_MAX).map((n) => (
                <NominationCard
                  key={n.nominee}
                  nomination={n}
                  now={chainNow}
                  compact
                  actions={<YourNominationActions n={n} />}
                />
              ))}
              {mine.length > MINE_MAX ? (
                <Button
                  component={RouterLink}
                  to={decisionsViewPath('nominations')}
                  sx={{ alignSelf: 'flex-start', minHeight: 44 }}
                >
                  Open nominations in Decisions
                </Button>
              ) : null}
            </Box>
          ) : mine.length ? (
            <ListSkeleton count={Math.min(mine.length, MINE_MAX)} label="Loading" />
          ) : (
            <EmptyState
              title="You haven't nominated anyone yet"
              description="Know someone who runs a node and should mint? Propose a nomination, with a short reason."
              actionLabel={status.canNominate ? PROPOSE_NOMINATION : undefined}
              onAction={() => navigate(nominatePath())}
            />
          ))}
      </Section>

      <Section title="Open nominations you could support" id="home-support">
        {loadingOrError ??
          (toSupport.length ? (
            <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {toSupport.slice(0, SUPPORT_MAX).map((n) => {
                const by = n.nomination?.publisher;
                return (
                  <Box
                    key={n.nominee}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                  >
                    <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                      <PersonChip
                        address={n.nominee}
                        name={n.nomineeName ?? undefined}
                        secondary={
                          by
                            ? withMarkedName(`Nominated by ${by.name}`, by.name)
                            : 'Proposed on chain'
                        }
                      />
                    </Box>
                    <NominationStateChip state={n.state} />
                    {/* The nomination itself, as its words say (their name opens their profile). */}
                    <Button
                      component={RouterLink}
                      to={nominationPath(n.nominee)}
                      variant="outlined"
                      aria-label={`Details about ${n.nomineeName ?? n.nominee}`}
                      sx={{ minHeight: 44 }}
                    >
                      Details
                    </Button>
                  </Box>
                );
              })}
              <Button
                component={RouterLink}
                to={decisionsViewPath('nominations')}
                sx={{ alignSelf: 'flex-start', minHeight: 44 }}
              >
                See all open nominations
              </Button>
            </Card>
          ) : (
            <EmptyState
              title="Nothing to support right now"
              description={
                data && data.open.length
                  ? 'Every open nomination already has your name on it.'
                  : 'There are no open nominations at the moment.'
              }
            />
          ))}
        {data?.truncated ? <TruncatedNote what="the nominations" /> : null}
      </Section>
    </>
  );
}

/**
 * On a nomination you made: Details (its own page) and Open in Decisions
 * (its decision, or the Decisions page while it waits for a first
 * approval). A nomination that closed with no approval has no decision to
 * open. The buttons' names say whose card they are on.
 */
function YourNominationActions({ n }: { n: Nomination }) {
  const who = useDisplayName(n.nominee, n.nomineeName ?? undefined).label;
  const decisionLink = n.decision
    ? decisionPath(n.decision.signature)
    : n.state === 'waiting'
      ? PATHS.decisions
      : null;
  return (
    <>
      <Button
        component={RouterLink}
        to={nominationPath(n.nominee)}
        variant="text"
        aria-label={`Details about ${who}`}
        sx={{ minHeight: 44 }}
      >
        Details
      </Button>
      {decisionLink ? (
        <Button
          component={RouterLink}
          to={decisionLink}
          variant="outlined"
          aria-label={`Open in Decisions: ${who}`}
          sx={{ minHeight: 44 }}
        >
          Open in Decisions
        </Button>
      ) : null}
    </>
  );
}
