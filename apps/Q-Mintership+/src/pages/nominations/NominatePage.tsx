import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function NominatePage() {
  return (
    <>
      <PageHeader
        title="Nominate someone"
        subtitle="Pick the person, say why, add links."
        back="/"
      />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="Pick the person, say why, add links."
        />
      </PageBody>
    </>
  );
}
