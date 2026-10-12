/**
 * History (read-only): find a person, MINTER's on-chain changes 30 days at a
 * time, and the original app's cards with their polls and comments, so
 * nothing from before Q-Mintership+ is lost (plan §6).
 */
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { useNavHas } from '../../components/layout/useNavHas';
import { PATHS } from '../../routes/paths';
import { useMyStatus } from '../../hooks/useData';
import { ChainHistory } from './ChainHistory';
import { LegacyBoards } from './LegacyBoards';
import { PersonSearch } from './parts/PersonSearch';

export default function HistoryPage() {
  const { status } = useMyStatus();
  const inNav = useNavHas('history');
  return (
    <>
      <PageHeader
        title="History"
        subtitle="MINTER on chain, and the original app’s boards."
        back={inNav ? undefined : PATHS.home}
      />
      <PageBody>
        <PersonSearch />
        <ChainHistory />
        <LegacyBoards isAdmin={Boolean(status?.isAdmin)} />
      </PageBody>
    </>
  );
}
