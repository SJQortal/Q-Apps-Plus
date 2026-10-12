/**
 * Home: the status engine's answer for whoever is signed in (plan item C).
 * One hero per status (outside Hub, signed out, newcomer, nominated,
 * approved, former member, member, nominator, Minter Admin), then only the
 * sections that status needs, so a newcomer's Home costs a handful of reads
 * and an admin's loads the decisions and nominations it shows.
 */
import { useReducer } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { NominationCard } from '../../components/nomination/NominationCard';
import { Section } from '../../components/common/Section';
import { ErrorState, HeroSkeleton } from '../../components/common/states';
import { invalidate } from '../../data/query';
import { useChainNow, useMyStatus } from '../../hooks/useData';
import type { MyStatus } from '../../rules/status';
import { useSession } from '../../state/session';
import { displayName } from '../../utils/format';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import { AdminSection } from './AdminSection';
import { HowItWorks } from './HowItWorks';
import { LiveStats } from './LiveStats';
import { MemberSection } from './MemberSection';
import { AdminHero } from './heroes/AdminHero';
import { AnonymousHero } from './heroes/AnonymousHero';
import { ApprovedHero } from './heroes/ApprovedHero';
import { FormerHero } from './heroes/FormerHero';
import { LearnerHero, NominatorHero } from './heroes/MemberHero';
import { NewcomerHero } from './heroes/NewcomerHero';
import { NominatedHero } from './heroes/NominatedHero';
import { useNeededSignatures, type NeededSignatures } from './homeData';

/** What the Refresh button reloads (only the keys Home shows; immutable blocks stay). */
const REFRESH_PREFIXES = [
  'status:',
  'decisions:',
  'nominations:',
  'membership:',
  'joinrequest:',
  'invite:',
  'history:',
  'balance:',
  'pending:',
  'unconfirmed:',
  'approvals:',
  'qdnsearch:',
  'chain:now',
  'chain:tip',
  'group:info',
  'group:admins',
  'group:invites',
  'group:joinrequests',
  'group:bans',
];

function subtitleFor(status: MyStatus | undefined, sessionStatus: string): string {
  if (sessionStatus === 'outside') return 'Open in Qortal Hub or GO to sign in';
  if (!status) return 'Checking your MINTER status…';
  if (status.kind === 'outsideHub') return 'Open in Qortal Hub or GO to sign in';
  if (status.kind === 'signedOut') return 'Not signed in';
  const role = status.isAdmin ? ' · Minter Admin' : status.isMember ? ' · MINTER member' : '';
  return `${displayName(status.name, status.address)} · Level ${status.level}${role}`;
}

function StatusView({
  status,
  needed,
  publicKey,
}: {
  status: MyStatus;
  needed: NeededSignatures;
  publicKey: string;
}) {
  const now = useChainNow();
  switch (status.kind) {
    case 'outsideHub':
    case 'signedOut':
      return (
        <>
          <AnonymousHero outside={status.kind === 'outsideHub'} needed={needed.needed} />
          <LiveStats needed={needed} />
          <HowItWorks needed={needed.needed} />
        </>
      );
    case 'admin':
      return (
        <>
          <AdminHero status={status} publicKey={publicKey} needed={needed} />
          <AdminSection publicKey={publicKey} />
          <MemberSection status={status} />
        </>
      );
    case 'memberNominator':
      return (
        <>
          <NominatorHero status={status} needed={needed.needed} />
          <MemberSection status={status} />
        </>
      );
    case 'member':
      return <LearnerHero status={status} />;
    case 'nominated':
      if (!status.nomination) break;
      return (
        <>
          <NominatedHero status={status} nomination={status.nomination} needed={needed.needed} />
          {now.data ? (
            <Section title="Your nomination" id="home-nomination">
              <NominationCard nomination={status.nomination} now={now.data} hideNominee />
            </Section>
          ) : null}
        </>
      );
    case 'approvedInvite':
      return <ApprovedHero status={status} />;
    case 'formerKicked':
    case 'formerBanned':
    case 'formerLeft':
      return (
        <>
          <FormerHero status={status} needed={needed.needed} />
          <HowItWorks needed={needed.needed} />
        </>
      );
    case 'newcomer':
      break;
  }
  return (
    <>
      <NewcomerHero status={status} needed={needed.needed} />
      <HowItWorks needed={needed.needed} />
    </>
  );
}

export default function HomePage() {
  const session = useSession();
  const my = useMyStatus();
  const needed = useNeededSignatures();
  // A join sent from Home re-renders the page, so the status reloads once Core has it.
  usePendingWrite(session.address ? writeKeys.join(session.address) : null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const status = my.status;

  const refresh = () => {
    for (const prefix of REFRESH_PREFIXES) invalidate(prefix);
    rerender();
  };

  return (
    <>
      <PageHeader
        title="Home"
        subtitle={subtitleFor(status, session.status)}
        actions={
          <Tooltip title="Refresh">
            <IconButton aria-label="Refresh" onClick={refresh} sx={{ width: 44, height: 44 }}>
              <RefreshOutlinedIcon />
            </IconButton>
          </Tooltip>
        }
      />
      <PageBody>
        {status && my.isError ? (
          <ErrorState
            compact
            title="Couldn't refresh your MINTER status."
            error={my.error}
            onRetry={() => void my.refetch()}
          />
        ) : null}
        {status ? (
          <StatusView status={status} needed={needed} publicKey={session.publicKey} />
        ) : my.isError ? (
          <ErrorState
            title="Couldn't load your MINTER status."
            error={my.error}
            onRetry={() => void my.refetch()}
          />
        ) : (
          <HeroSkeleton />
        )}
      </PageBody>
    </>
  );
}
