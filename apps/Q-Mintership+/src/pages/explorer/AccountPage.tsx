/**
 * One account in the Explorer.
 */
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';
import { PATHS } from '../../routes/paths';

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" back={PATHS.explorer} />
      <PageBody>
        <EmptyState title="Coming in this update" />
      </PageBody>
    </>
  );
}
