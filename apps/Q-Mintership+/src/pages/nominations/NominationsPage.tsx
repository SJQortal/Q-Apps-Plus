import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function NominationsPage() {
  return (
    <>
      <PageHeader title="Nominations" subtitle="Open nominations, and how to support one." />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="Open nominations, and how to support one."
        />
      </PageBody>
    </>
  );
}
