/**
 * One transaction: `/explorer/tx/:signature`. Its type in words is the
 * title ("Payment"); the page is tx/TxView.tsx. Read with
 * `GET /transactions/signature/{sig}` (data/explorer/account.ts getTx: a
 * confirmed one is kept for the session, a waiting one 20 s).
 *
 * A signature the node doesn't know (404) is told apart from a failed read
 * (Retry), and both from text that isn't a signature at all; the first two
 * offer the Explorer's search field.
 *
 * People link into the Explorer: as a step in the trail when this page was
 * reached from inside it, otherwise starting a new one. Read-only.
 */
import { useLocation, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { CopyShownLinkButton } from '../../components/common/CopyLinkButton';
import {
  EXPLORER_PERSON_LINKS,
  EXPLORER_START_LINKS,
  PersonLinkContext,
} from '../../components/common/personLinks';
import { RefreshButton } from '../../components/common/RefreshButton';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { ExplorerSearch } from '../../components/explorer/ExplorerSearch';
import { getTx, isSignature } from '../../data/explorer/account';
import { useQuery } from '../../hooks/useQuery';
import { PATHS } from '../../routes/paths';
import { txTypeLabel } from '../../rules/explorer/txFamilies';
import { cameFromExplorer } from '../../state/explorer';
import { TxView } from './tx/TxView';
import { ExplorerHeaderSearch } from '../../components/explorer/ExplorerHeaderSearch';

export const NO_SUCH_TX = 'No transaction has this signature on your node.';
export const NOT_A_SIGNATURE = "This isn't a transaction signature. A letter may be wrong.";

export default function TxPage() {
  const params = useParams();
  const signature = (params.signature ?? '').trim();
  const valid = isSignature(signature);
  const location = useLocation();
  const links = cameFromExplorer(location.state) ? EXPLORER_PERSON_LINKS : EXPLORER_START_LINKS;
  const tx = useQuery(valid ? `xtxsig:${signature}` : null, (force) => getTx(signature, { force }));

  let title = 'Transaction';
  let actions: React.ReactNode = null;
  let body: React.ReactNode;
  if (!valid) {
    title = 'Not a transaction';
    body = (
      <>
        <EmptyState title={NOT_A_SIGNATURE} description={<bdi dir="auto">{signature}</bdi>} />
        <ExplorerSearch />
      </>
    );
  } else if (tx.data === undefined && tx.isError) {
    body = (
      <ErrorState
        title="Couldn't load this transaction."
        error={tx.error}
        onRetry={() => void tx.refetch()}
      />
    );
  } else if (tx.data === undefined) {
    body = <ListSkeleton count={2} label="Loading the transaction" />;
  } else if (tx.data === null) {
    title = 'No such transaction';
    body = (
      <>
        <EmptyState
          title={NO_SUCH_TX}
          description="It may not have reached your node yet, or a character may be wrong."
        />
        <ExplorerSearch />
      </>
    );
  } else {
    title = txTypeLabel(tx.data.type);
    const waiting = typeof tx.data.blockHeight !== 'number';
    actions = (
      <>
        <CopyShownLinkButton />
        {waiting ? (
          <RefreshButton onClick={() => void tx.refetch()} fetching={tx.fetching} />
        ) : null}
      </>
    );
    body = <TxView tx={tx.data} />;
  }

  return (
    <PersonLinkContext value={links}>
      <PageHeader
        title={title}
        back={PATHS.explorer}
        actions={
          <>
            <ExplorerHeaderSearch />
            {actions}
          </>
        }
      />
      <PageBody>{body}</PageBody>
    </PersonLinkContext>
  );
}
