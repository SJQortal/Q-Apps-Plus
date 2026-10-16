/**
 * The accounts whose first QORT payment came from this one. A placeholder until this part of the Explorer is built: Back and
 * one line.
 */
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';
import { PATHS } from '../../routes/paths';

export default function FundedPage() {
  return (
    <>
      <PageHeader title="First QORT payments" back={PATHS.explorer} />
      <PageBody>
        <EmptyState title="Coming in this update" />
      </PageBody>
    </>
  );
}
