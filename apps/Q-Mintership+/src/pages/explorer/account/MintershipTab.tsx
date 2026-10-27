/**
 * The Minter Profile tab (Simon, 2026-10-17: "add the Minter Profile into
 * the Explorer tabs as well so it has a place where it exists", then the
 * profile page "merged into … Minter Profile in Explorer"): an account's
 * MINTER profile, its one place, and what it did in Q-Mintership+ and in
 * the original app. `/people/<address>` links open it.
 *
 * - "MINTER status": where it stands and its facts, then what the viewer
 *   can do for it: the profile's actions (pages/person/ProfileActions.tsx,
 *   the Explorer's one part that acts): Propose nomination or Add your
 *   support, Open in Decisions for a Minter Admin, and on one's own profile
 *   Join now and the Minter Admin role.
 * - "Nomination" (or "Latest nomination"): the card in full, with comments,
 *   votes and the nominee's own next step, then its rounds in brief.
 * - "MINTER timeline": what happened to it, people linking into the Explorer.
 * - "In Q-Mintership+, under any of their names": the records it published
 *   (data/explorer/madeBy.ts), read as the section nears the screen.
 * - "As a Minter Admin": proposals, Activity's figures when already read,
 *   and its answers on request.
 * - "From the original app" (cards about it) and "In the original app,
 *   under any of their names" (what it posted, poll votes on request).
 *
 * An account with nothing in any of these gets one line instead. Every read
 * shares its key with the app's own (an account's status, history and
 * nominations, as Home reads them) or is the Explorer's own (`x…`); none
 * polls.
 */
import { useMemo } from 'react';
import { Typography } from '@mui/material';
import { FALLBACK_MS_PER_BLOCK } from '../../../data/constants';
import { inviteProposers } from '../../../data/nominations';
import { waitingWindowBlocks } from '../../../rules/timing';
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
import { useMyStatus } from '../../../hooks/useData';
import { isOpenState } from '../../../rules/nomination';
import { useSession } from '../../../state/session';
import { TimelineList } from '../../history/parts/TimelineList';
import { endedAt } from '../../nominations/filters';
import { PersonLegacy } from '../../person/PersonLegacy';
import {
  ProfileActions,
  ProfileNominationCard,
  type ProfileFacts,
} from '../../person/ProfileActions';
import { AdminSection } from './mintership/AdminSection';
import { MadeSection } from './mintership/MadeSection';
import { NOTHING_IN_MINTER, nothingChecked } from './mintership/mintershipWords';
import { OriginalPosted, PollVotesPanel } from './mintership/OriginalPosted';
import { NominationSummary, StandingSection } from './mintership/StandingSection';
import { useMinterStory, type MinterStory } from './mintership/useMinterStory';
import { ORIGINAL_WORDS } from '../../../constants/plus';
import { sentenceStart } from '../../../utils/format';

export interface MintershipTabProps {
  address: string;
}

function Timeline({ story, self }: { story: MinterStory; self: boolean }) {
  const { history, about, chain, nominations, group } = story;
  // An invite that answered a nomination says its nominator proposed it.
  const proposerOf = useMemo(
    () =>
      inviteProposers(
        nominations.data,
        waitingWindowBlocks(group.data ?? { minimumBlockDelay: 0, maximumBlockDelay: 10_080 }) *
          (chain.data?.msPerBlock ?? FALLBACK_MS_PER_BLOCK)
      ),
    [nominations.data, group.data, chain.data]
  );
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
          proposerOf={proposerOf}
          nowMs={chain.data?.timestamp ?? Date.now()}
          label="Their MINTER events, newest first"
        />
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
          No MINTER transactions about {self ? 'you' : 'them'} on chain yet.
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
  const session = useSession();
  const viewer = useMyStatus();
  // The profile's facts: what the viewer can do for it, and its nomination in full.
  const open = story.nominations.data?.find((n) => isOpenState(n.state)) ?? null;
  const facts: ProfileFacts | null = person
    ? {
        address,
        person,
        self: session.status === 'ready' && session.address === address,
        open,
        viewer: viewer.status,
      }
    : null;
  // Once its nominations are known: "Add your support" or "Propose nomination" depends on them.
  const nominationsKnown = story.nominations.data !== undefined || story.nominations.isError;
  const actions = facts && nominationsKnown ? <ProfileActions facts={facts} /> : null;
  const latest = story.current;
  const now = story.chain.data;
  const card =
    facts && latest && now ? (
      <ProfileNominationCard
        facts={facts}
        nomination={latest}
        now={now}
        endedAt={story.group.data ? endedAt(latest, now, story.group.data) : null}
      />
    ) : null;
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
        {actions}
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
            <Section
              title={`${sentenceStart(ORIGINAL_WORDS.adjective)} poll votes`}
              id="explorer-mintership-pollvotes"
            >
              <PollVotesPanel address={address} />
            </Section>
          </>
        )}
      </>
    );

  return (
    <>
      <StandingSection
        address={address}
        story={story}
        self={Boolean(facts?.self)}
        actions={actions}
      />
      <NominationSummary address={address} story={story} card={card} />
      <Timeline story={story} self={Boolean(facts?.self)} />
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
