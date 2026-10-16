/**
 * Two to four accounts side by side, with what links them. A placeholder until this part of the Explorer is built: Back and
 * one line.
 */
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState } from '../../components/common/states';
import { PATHS } from '../../routes/paths';

export default function ComparePage() {
  return (
    <>
      <PageHeader title="Compare" back={PATHS.explorer} />
      <PageBody>
        <EmptyState title="Coming in this update" />
      </PageBody>
    </>
  );
}
