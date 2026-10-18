/**
 * The Explorer's routes (read-only pages, each loaded on demand). They go
 * above the router's `*` catch-all in Routes.tsx. An account's tab is an
 * optional segment of one route, so switching tabs keeps the page mounted.
 * Compare and the sets of accounts are for viewers who see the Explorer's
 * detailed parts (FullExplorerOnly).
 */
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { FullExplorerOnly } from './FullExplorerOnly';

const ExplorerPage = lazy(() => import('../pages/explorer/ExplorerPage'));
const AccountPage = lazy(() => import('../pages/explorer/AccountPage'));
const ComparePage = lazy(() => import('../pages/explorer/ComparePage'));
const TxPage = lazy(() => import('../pages/explorer/TxPage'));
const TransactionsPage = lazy(() => import('../pages/explorer/TransactionsPage'));
const SponseesPage = lazy(() => import('../pages/explorer/SponseesPage'));
const FundedPage = lazy(() => import('../pages/explorer/FundedPage'));

export const explorerRoutes: RouteObject[] = [
  { path: 'explorer', element: <ExplorerPage /> },
  // `:who` is an address, or a name that the page swaps for its owner's address.
  { path: 'explorer/account/:who/:tab?', element: <AccountPage /> },
  // 2 to 4 addresses: /explorer/compare/<a>/<b>[/<c>/<d>].
  {
    path: 'explorer/compare/*',
    element: (
      <FullExplorerOnly>
        <ComparePage />
      </FullExplorerOnly>
    ),
  },
  { path: 'explorer/tx/:signature', element: <TxPage /> },
  { path: 'explorer/transactions', element: <TransactionsPage /> },
  {
    path: 'explorer/sponsees/:address',
    element: (
      <FullExplorerOnly>
        <SponseesPage />
      </FullExplorerOnly>
    ),
  },
  {
    path: 'explorer/funded/:address',
    element: (
      <FullExplorerOnly>
        <FundedPage />
      </FullExplorerOnly>
    ),
  },
];
