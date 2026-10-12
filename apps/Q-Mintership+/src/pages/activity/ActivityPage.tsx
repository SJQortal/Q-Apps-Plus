import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function ActivityPage() {
  return (
    <>
      <PageHeader title="Activity" subtitle="Minter Admin Activity and the group’s pulse." />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="Minter Admin Activity and the group’s pulse."
        />
      </PageBody>
    </>
  );
}
