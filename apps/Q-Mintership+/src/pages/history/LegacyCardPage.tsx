import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

/** Placeholder until this screen is built. */
export default function LegacyCardPage() {
  return (
    <>
      <PageHeader
        title="Original card"
        subtitle="A card from the original Q-Mintership, read-only."
        back="/"
      />
      <PageBody>
        <EmptyState
          title="Coming in this build"
          description="A card from the original Q-Mintership, read-only."
        />
      </PageBody>
    </>
  );
}
