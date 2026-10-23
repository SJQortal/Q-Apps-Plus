/**
 * History (read-only): find a person, MINTER's on-chain changes 30 days at a
 * time, the closed Minter Admin polls (Minter Admins only), and the original
 * app's cards with their polls and comments, so nothing from before
 * Q-Mintership+ is lost (plan §6).
 */
import { lazy, Suspense, useMemo } from 'react';
import { CardSkeleton } from '../../components/common/states';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { useNavHas } from '../../components/layout/useNavHas';
import { PATHS } from '../../routes/paths';
import { useMyStatus } from '../../hooks/useData';
import { ChainHistory } from './ChainHistory';
import { LegacyBoards } from './LegacyBoards';
import { PersonSearch } from './parts/PersonSearch';
import { ORIGINAL_WORDS } from '../../constants/plus';
import { useSession } from '../../state/session';

/** The closed Minter Admin polls: loaded only for Minter Admins. */
const AdminPollHistory = lazy(() => import('./AdminPollHistory'));

export default function HistoryPage() {
  const { status } = useMyStatus();
  const inNav = useNavHas('history');
  const session = useSession();
  const ready = session.status === 'ready';
  // The account a poll's Share is published from, as on Decisions.
  const pollAuthor = useMemo(
    () =>
      ready ? { address: session.address, publicKey: session.publicKey, name: session.name } : null,
    [ready, session.address, session.publicKey, session.name]
  );
  const admin = Boolean(pollAuthor && status?.isAdmin && status.address === pollAuthor.address);
  return (
    <>
      <PageHeader
        title="History"
        subtitle={`MINTER on chain, and ${ORIGINAL_WORDS.app}’s boards.`}
        back={inNav ? undefined : PATHS.home}
      />
      <PageBody>
        <PersonSearch />
        <ChainHistory />
        {admin && pollAuthor ? (
          <Suspense fallback={<CardSkeleton lines={2} />}>
            <AdminPollHistory author={pollAuthor} />
          </Suspense>
        ) : null}
        <LegacyBoards isAdmin={Boolean(status?.isAdmin)} viewer={status?.address ?? null} />
      </PageBody>
    </>
  );
}
