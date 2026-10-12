import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function DecisionsPage() {
  return (
    <>
      <PageHeader title="Decisions" subtitle="Everything waiting for the Minter Admins." />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="Everything waiting for the Minter Admins."
        />
      </PageBody>
    </>
  );
}
