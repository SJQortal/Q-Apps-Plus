import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" subtitle="MINTER on chain, and the original app’s boards." />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="MINTER on chain, and the original app’s boards."
        />
      </PageBody>
    </>
  );
}
