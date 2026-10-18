import { lazy } from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Navigate,
  RouterProvider,
  useLocation,
  useParams,
  useRouteError,
} from 'react-router-dom';
import { Box } from '@mui/material';
import { AppShell } from './components/layout/AppShell';
import { ErrorState } from './components/common/states';
import { routerBaseForPage } from './routes/hubLocation';
import { explorerRoutes } from './routes/explorerRoutes';
import { decisionsViewPath, PATHS, personPath } from './routes/paths';
import { nominationsRedirect } from './pages/decisions/decisionsViews';

// Home is the first screen almost everyone sees; the rest load on demand.
import HomePage from './pages/home/HomePage';
const NominationPage = lazy(() => import('./pages/nominations/NominationPage'));
const NominatePage = lazy(() => import('./pages/nominations/NominatePage'));
const ProposePage = lazy(() => import('./pages/decisions/propose/ProposePage'));
const DecisionsPage = lazy(() => import('./pages/decisions/DecisionsPage'));
const DecisionPage = lazy(() => import('./pages/decisions/DecisionPage'));
const AdminPollPage = lazy(() => import('./pages/decisions/AdminPollPage'));
const HistoryPage = lazy(() => import('./pages/history/HistoryPage'));
const LegacyCardPage = lazy(() => import('./pages/history/LegacyCardPage'));
const ActivityPage = lazy(() => import('./pages/activity/ActivityPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

/** `/people/<address or name>`: the person's Minter Profile, in the Explorer now. */
function PeopleRedirect() {
  const { address = '' } = useParams();
  return <Navigate to={personPath(address.trim())} replace />;
}

/** `/nominations` lives in Decisions now: its tab (and nomination state), from the old link. */
function NominationsRedirect() {
  const { search } = useLocation();
  return <Navigate to={nominationsRedirect(search)} replace />;
}

/** A path the router can't place opens Home; anything else gets Reload. */
function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <Navigate to="/" replace />;
  return (
    <Box sx={{ p: 2 }}>
      <ErrorState
        title="Q-Mintership+ could not open this page."
        error="Reloading usually fixes it. Nothing on chain was changed."
        onRetry={() => window.location.reload()}
      />
    </Box>
  );
}

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      errorElement: <RouteError />,
      children: [
        { index: true, element: <HomePage /> },
        { path: 'nominations', element: <NominationsRedirect /> },
        // Shareable links: one nomination, one decision (also once it is decided).
        { path: 'nominations/:address', element: <NominationPage /> },
        { path: 'nominate', element: <NominatePage /> },
        // Every other + Propose choice, a page each (Simon, 2026-10-18).
        { path: 'propose/:kind', element: <ProposePage /> },
        { path: 'propose', element: <Navigate to={PATHS.decisions} replace /> },
        // Old /decisions?d=<signature> links open /decisions/<signature> (DecisionsPage).
        { path: 'decisions', element: <DecisionsPage /> },
        { path: 'decisions/:signature', element: <DecisionPage /> },
        // One Minter Admin poll (Minter Admins only); without an id, all of Decisions.
        { path: 'decisions/polls/:id', element: <AdminPollPage /> },
        { path: 'decisions/polls', element: <Navigate to="/decisions" replace /> },
        { path: 'people/:address', element: <PeopleRedirect /> },
        { path: 'history', element: <HistoryPage /> },
        { path: 'history/card/:card', element: <LegacyCardPage /> },
        { path: 'history/card/:card/:section', element: <LegacyCardPage /> },
        { path: 'explorer/activity', element: <ActivityPage /> },
        { path: 'activity', element: <Navigate to={PATHS.activity} replace /> },
        { path: 'settings', element: <SettingsPage /> },
        // The Explorer: any account or transaction, read-only.
        ...explorerRoutes,
        // Old routes of the scaffold and the original app's boards.
        { path: 'minters/*', element: <Navigate to={decisionsViewPath('nominations')} replace /> },
        { path: 'forum/*', element: <Navigate to="/" replace /> },
        { path: 'stats/*', element: <Navigate to={PATHS.activity} replace /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  // Also accepts the app name spelled Q-Mintership%2B in the frame's URL.
  { basename: routerBaseForPage() }
);

export function Routes() {
  return <RouterProvider router={router} />;
}
