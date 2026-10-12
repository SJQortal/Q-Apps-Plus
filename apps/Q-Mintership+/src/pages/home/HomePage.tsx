import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function HomePage() {
  return (
    <>
      <PageHeader title="Home" subtitle="Your MINTER status and what to do next." />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="Your MINTER status and what to do next."
        />
      </PageBody>
    </>
  );
}
