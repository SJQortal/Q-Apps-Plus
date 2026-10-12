import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function PersonPage() {
  return (
    <>
      <PageHeader title="Person" subtitle="Profile, nominations and MINTER history." back="/" />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="Profile, nominations and MINTER history."
        />
      </PageBody>
    </>
  );
}
