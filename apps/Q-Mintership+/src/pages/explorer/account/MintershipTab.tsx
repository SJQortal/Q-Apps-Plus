/**
 * An account's MINTER story and what it did in Q-Mintership+ and in the
 * original app, read-only. Actions (nominate, support, decide) live on its
 * MINTER profile, linked at the top.
 *
 * - "MINTER status": where it stands, in the person page's own words, and its
 *   facts; "Nomination": its rounds and the latest one's outcome.
 * - "MINTER timeline": what happened to it, people linking into the Explorer.
 * - "In Q-Mintership+, under any of their names": the records it published
 *   (data/explorer/madeBy.ts), read as the section nears the screen.
 * - "As a Minter Admin": proposals, Activity's figures when already read,
 *   and its answers on request.
 * - "From the original app" (cards about it) and "In the original app,
 *   under any of their names" (what it posted, poll votes on request).
 *
 * An account with nothing in any of these gets one line instead. Every read
 * shares its key with the person page or is the Explorer's own (`x…`); none
 * polls.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { Section } from '../../../components/common/Section';
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  TruncatedNote,
} from '../../../components/common/states';
import { loadLegacyBy } from '../../../data/explorer/legacyBy';
import { loadMadeBy } from '../../../data/explorer/madeBy';
import { LEGACY_SCAN_FIRST, loadLegacyFor } from '../../../data/legacy';
import { useQuery } from '../../../hooks/useQuery';
import { personPath } from '../../../routes/paths';
import { TimelineList } from '../../history/parts/TimelineList';
import { PersonLegacy } from '../../person/PersonLegacy';
import { AdminSection } from './mintership/AdminSection';
import { MadeSection } from './mintership/MadeSection';
import { NOTHING_IN_MINTER, PROFILE_HINT, nothingChecked } from './mintership/mintershipWords';
import { OriginalPosted, PollVotesPanel } from './mintership/OriginalPosted';
import { NominationSummary, StandingSection } from './mintership/StandingSection';
import { useMinterStory, type MinterStory } from './mintership/useMinterStory';

export interface MintershipTabProps {
  address: string;
}

function ProfileLink({ address }: { address: string }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5 }}>
      <Button
        component={RouterLink}
        to={personPath(address)}
        variant="outlined"
        endIcon={<ChevronRightOutlinedIcon />}
        sx={{ minHeight: 44 }}
      >
        MINTER profile
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        {PROFILE_HINT}
      </Typography>
    </Box>
  );
}

function Timeline({ story }: { story: MinterStory }) {
  const { history, about, chain } = story;
  return (
    <Section title="MINTER timeline" id="explorer-mintership-timeline">
      {history.isError && !history.data ? (
        <ErrorState
          compact
          title="Couldn't load their MINTER history."
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      ) : !about ? (
        <ListSkeleton count={2} label="Loading their MINTER history" />
      ) : about.length ? (
        <TimelineList
          groupAlike
          events={about}
          nowMs={chain.data?.timestamp ?? Date.now()}
          label="Their MINTER events, newest first"
        />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          No MINTER transactions about them on chain yet.
        </Typography>
      )}
      {history.data?.truncated ? <TruncatedNote what="their history" /> : null}
    </Section>
  );
}

/**
 * Nothing in MINTER and no nomination: whether they made or posted anything
 * (and whether the newest original-app cards are about them) decides
 * between the one line and the full tab. Read at once, since the tab is short.
 */
function useNothingAnywhere(address: string, quiet: boolean, name: string | null) {
  const made = useQuery(`xmade:${address}`, (force) => loadMadeBy(address, { force }), {
    enabled: quiet,
  });
  const posted = useQuery(`xlegacyby:${address}`, (force) => loadLegacyBy(address, { force }), {
    enabled: quiet,
  });
  const about = useQuery(
    `legacy:for:${address}:${LEGACY_SCAN_FIRST}`,
    (force) => loadLegacyFor({ address, name }, LEGACY_SCAN_FIRST, { force }),
    { enabled: quiet }
  );
  if (!quiet) return { nothing: false, checking: false, scanned: null };
  const m = made.data;
  const p = posted.data;
  const a = about.data;
  // A read that fails shows the full tab, where each section says so.
  if (made.isError || posted.isError || about.isError)
    return { nothing: false, checking: false, scanned: null };
  if (!m || !p || !a) return { nothing: false, checking: true, scanned: null };
  const madeNothing =
    !m.nominations.length &&
    !m.supports.length &&
    !m.votes.length &&
    !m.comments.length &&
    !m.considering.length &&
    !m.adminRecords;
  const postedNothing =
    !p.cards.length &&
    !p.minterComments.comments &&
    !p.arComments.comments &&
    !p.adminCards &&
    !p.adminComments;
  return {
    nothing: madeNothing && postedNothing && !a.cards.length,
    checking: false,
    scanned: { scanned: a.scanned, total: a.total },
  };
}

export default function MintershipTab({ address }: MintershipTabProps) {
  const story = useMinterStory(address);
  const person = story.status.data;
  const about = story.about;
  const proposals = story.proposals;
  const ready = Boolean(person && about && proposals && story.nominations.data && story.rounds);
  const wasAdmin = Boolean(about?.some((e) => e.kind === 'addAdmin' && e.outcome === 'done'));
  const quiet =
    ready &&
    !person?.isMember &&
    !person?.isAdmin &&
    !person?.hasJoinRequest &&
    !about?.length &&
    !proposals?.length &&
    !story.nominations.data?.length &&
    !story.rounds?.length;
  const nothing = useNothingAnywhere(address, quiet, person?.name ?? null);

  if (story.status.isError && !person)
    return (
      <>
        <ProfileLink address={address} />
        <ErrorState
          compact
          title="Couldn't load where they stand in MINTER."
          error={story.status.error}
          onRetry={() => void story.status.refetch()}
        />
      </>
    );

  if (quiet && (nothing.checking || nothing.nothing))
    return (
      <>
        <ProfileLink address={address} />
        {nothing.checking ? (
          <ListSkeleton count={1} label="Checking their records" />
        ) : (
          <>
            <EmptyState
              title={NOTHING_IN_MINTER}
              description={nothingChecked(
                nothing.scanned?.scanned ?? 0,
                nothing.scanned?.total ?? 0
              )}
            />
            <Section title="Original app poll votes" id="explorer-mintership-pollvotes">
              <PollVotesPanel address={address} />
            </Section>
          </>
        )}
      </>
    );

  return (
    <>
      <ProfileLink address={address} />
      <StandingSection story={story} />
      <NominationSummary address={address} story={story} />
      <Timeline story={story} />
      <MadeSection address={address} eager={quiet} />
      {person && proposals && (person.isAdmin || wasAdmin || proposals.length) ? (
        <AdminSection
          address={address}
          proposals={proposals}
          isAdmin={person.isAdmin}
          wasAdmin={wasAdmin}
          nowMs={story.chain.data?.timestamp ?? Date.now()}
        />
      ) : null}
      <PersonLegacy address={address} name={person?.name ?? null} />
      <OriginalPosted address={address} eager={quiet} />
    </>
  );
}
