/**
 * A page of the Explorer's detailed parts (Compare, a sponsor's sponsees, the
 * accounts an account funded: rules/explorer/access.ts) behind its route: shown
 * to a viewer who sees them; anyone else, coming by a link, goes on to the
 * Explorer page the link was about (an account's Overview, or the Explorer),
 * as if the link pointed there. A skeleton while that is being read.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ListSkeleton } from '../components/common/states';
import { PageBody } from '../components/layout/PageBody';
import { isAddress } from '../data/accounts';
import { useFullExplorer } from '../hooks/useFullExplorer';
import { PATHS, explorerAccountPath } from './paths';

/** Where a link to one of these pages goes for anyone else: its first account, or the Explorer. */
function elsewhere(pathname: string, address: string | undefined): string {
  const first =
    address ??
    pathname
      .split('/explorer/compare/')[1]
      ?.split('/')
      .find((part) => isAddress(part));
  return first && isAddress(first) ? explorerAccountPath(first) : PATHS.explorer;
}

export function FullExplorerOnly({ children }: { children: ReactNode }) {
  const full = useFullExplorer();
  const { pathname } = useLocation();
  const { address } = useParams();
  if (full) return <>{children}</>;
  if (full === false) return <Navigate to={elsewhere(pathname, address)} replace />;
  return (
    <PageBody>
      <ListSkeleton count={3} label="Loading" />
    </PageBody>
  );
}
