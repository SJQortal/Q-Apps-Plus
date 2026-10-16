/**
 * The Explorer's landing page: look up any Qortal account or transaction.
 */
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';

export default function ExplorerPage() {
  return (
    <>
      <PageHeader title="Explorer" subtitle="Look up any Qortal account or transaction" />
      <PageBody>
        <EmptyState title="Coming in this update" />
      </PageBody>
    </>
  );
}
