/**
 * Every transaction on Qortal, by type and blocks. A placeholder until this part of the Explorer is built: Back and
 * one line.
 */
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';
import { PATHS } from '../../routes/paths';

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions on Qortal" back={PATHS.explorer} />
      <PageBody>
        <EmptyState title="Coming in this update" />
      </PageBody>
    </>
  );
}
