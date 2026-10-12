/**
 * A person's page (/people/:address): who they are and where they stand in
 * MINTER, their nomination, their on-chain MINTER timeline, what they
 * proposed as a Minter Admin, and their cards from the original app. It
 * replaces the original app's account explorer. A name in place of the
 * address opens that name's owner.
 *
 * Reads: the same cached status read Home uses (account, name, membership,
 * join request, stored invite, bans, MINTER history, nominations), plus the
 * chain tip and group settings. The original app's cards load on their own.
 */
import { useMemo, type ReactNode } from 'react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { getNameOwner, isAddress } from '../../data/accounts';
import {
  buildTimeline,
  eventsAbout,
  memberSince,
  proposalsBy,
  withOwnSubject,
} from '../../data/timeline';
import { isOpenState } from '../../rules/nomination';
import {
  useAccount,
  useAddressHistory,
  useChainNow,
  useGroupInfo,
  useMyStatus,
  useNominationsFor,
  usePersonStatus,
} from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { useSession } from '../../state/session';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { NominationCard } from '../../components/nomination/NominationCard';
import { Section } from '../../components/common/Section';
import {
  EmptyState,
  ErrorState,
  HeroSkeleton,
  ListSkeleton,
  TruncatedNote,
} from '../../components/common/states';
import { PATHS, personPath } from '../../routes/paths';
import { shortAddress } from '../../utils/format';
import { CopyLinkButton } from '../history/parts/CopyLinkButton';
import { PersonSearch } from '../history/parts/PersonSearch';
import { TimelineList } from '../history/parts/TimelineList';
import { AdminProposals } from './AdminProposals';
import { PersonHero } from './PersonHero';
import { PersonLegacy } from './PersonLegacy';
import { isInvalidAddress } from './personWords';

export default function PersonPage() {
  const { address: param = '' } = useParams();
  const value = param.trim();
  if (isAddress(value)) return <PersonView key={value} address={value} />;
  return <NameLookup key={value} name={value} />;
}

function Shell({
  title,
  children,
  address,
}: {
  title: string;
  children: ReactNode;
  address?: string;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle="MINTER profile and history"
        back={PATHS.history}
        actions={address ? <CopyLinkButton path={personPath(address)} what="this person" /> : null}
      />
      <PageBody>{children}</PageBody>
    </>
  );
}

/** /people/<name>: open the name's owner, or say no one has it. */
function NameLookup({ name }: { name: string }) {
  const owner = useQuery(name ? `nameowner:${name}` : null, () => getNameOwner(name));
  if (owner.data) return <Navigate to={personPath(owner.data)} replace />;
  return (
    <Shell title="Person">
      {name && owner.isLoading ? (
        <HeroSkeleton />
      ) : (
        <>
          <EmptyState
            title="No one found."
            description={
              name
                ? `“${name}” isn't a Qortal address, and no account has that name.`
                : 'This link has no address in it.'
            }
          />
          <PersonSearch />
        </>
      )}
    </Shell>
  );
}

function PersonView({ address }: { address: string }) {
  const session = useSession();
  const self = session.status === 'ready' && session.address === address;
  // Their nomination card refreshes on its own, faster.
  const status = usePersonStatus(address);
  const account = useAccount(address);
  const history = useAddressHistory(address);
  const nominations = useNominationsFor(address);
  const chain = useChainNow();
  const group = useGroupInfo();
  const viewer = useMyStatus();

  const person = status.data;
  const msPerBlock = chain.data?.msPerBlock;
  const maximumBlockDelay = group.data?.maximumBlockDelay ?? 10_080;
  const events = useMemo(
    () =>
      history.data && msPerBlock
        ? buildTimeline(withOwnSubject(history.data.rows, address), {
            msPerBlock,
            maximumBlockDelay,
          })
        : null,
    [history.data, msPerBlock, maximumBlockDelay, address]
  );
  const about = events ? eventsAbout(events, address) : null;
  const proposals = events ? proposalsBy(events, address) : [];
  const since = events && person?.isMember ? memberSince(events, address) : null;
  const title = person?.name ?? (person ? shortAddress(address) : 'Person');

  if (status.isError && !person) {
    return (
      <Shell title="Person">
        {isInvalidAddress(status.error) ? (
          <>
            <EmptyState
              title="That isn't a valid Qortal address."
              description="Check the address for a typo, or look the person up by name."
            />
            <PersonSearch />
          </>
        ) : (
          <ErrorState
            title="Couldn't load this person."
            error={status.error}
            onRetry={() => void status.refetch()}
          />
        )}
      </Shell>
    );
  }
  if (!person) {
    return (
      <Shell title="Person" address={address}>
        <HeroSkeleton />
        <ListSkeleton count={2} label="Loading their MINTER history" />
      </Shell>
    );
  }

  const unused =
    account.data &&
    !account.data.publicKey &&
    !account.data.reference &&
    !person.name &&
    !person.isMember &&
    history.data?.rows.length === 0 &&
    nominations.data?.length === 0;
  const list = nominations.data ?? [];
  const open = list.find((n) => isOpenState(n.state)) ?? null;
  const latest = open ?? list[0] ?? null;
  const nowMs = chain.data?.timestamp ?? Date.now();

  return (
    <Shell title={title} address={address}>
      <PersonHero
        address={address}
        person={person}
        self={self}
        memberSince={since}
        open={open}
        viewer={viewer.status}
      />

      {unused ? (
        <EmptyState
          title="No activity on Qortal yet."
          description="This address hasn't made a transaction. Once it does, its MINTER story shows here."
        />
      ) : (
        <>
          {latest && chain.data ? (
            <Section title={open ? 'Nomination' : 'Latest nomination'} id="person-nomination">
              <NominationCard nomination={latest} now={chain.data} hideNominee compact={!open} />
            </Section>
          ) : null}

          <Section title="MINTER timeline" id="person-timeline">
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
                events={about}
                nowMs={nowMs}
                label="Their MINTER events, newest first"
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                Nothing on chain yet: {self ? "you haven't" : "they haven't"} been nominated, joined
                or removed.
              </Typography>
            )}
            {history.data?.truncated ? <TruncatedNote what="their history" /> : null}
          </Section>

          <AdminProposals proposals={proposals} isAdmin={person.isAdmin} nowMs={nowMs} />

          <PersonLegacy address={address} name={person.name} />
        </>
      )}

      <Box>
        <Button
          component={RouterLink}
          to={PATHS.history}
          startIcon={<HistoryOutlinedIcon />}
          sx={{ minHeight: 44 }}
        >
          All of MINTER's history
        </Button>
      </Box>
    </Shell>
  );
}
