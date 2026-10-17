import { lazy } from 'react';
import {
  createBrowserRouter,
  isRouteErrorResponse,
  Navigate,
  RouterProvider,
  useRouteError,
} from 'react-router-dom';
import { Box } from '@mui/material';
import { AppShell } from './components/layout/AppShell';
import { ErrorState } from './components/common/states';
import { routerBaseForPage } from './routes/hubLocation';
import { explorerRoutes } from './routes/explorerRoutes';
import { PATHS } from './routes/paths';

// Home is the first screen almost everyone sees; the rest load on demand.
import HomePage from './pages/home/HomePage';
const NominationsPage = lazy(() => import('./pages/nominations/NominationsPage'));
const NominationPage = lazy(() => import('./pages/nominations/NominationPage'));
const NominatePage = lazy(() => import('./pages/nominations/NominatePage'));
const DecisionsPage = lazy(() => import('./pages/decisions/DecisionsPage'));
const DecisionPage = lazy(() => import('./pages/decisions/DecisionPage'));
const AdminPollPage = lazy(() => import('./pages/decisions/AdminPollPage'));
const PersonPage = lazy(() => import('./pages/person/PersonPage'));
const HistoryPage = lazy(() => import('./pages/history/HistoryPage'));
const LegacyCardPage = lazy(() => import('./pages/history/LegacyCardPage'));
const ActivityPage = lazy(() => import('./pages/activity/ActivityPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));

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
        { path: 'nominations', element: <NominationsPage /> },
        // Shareable links: one nomination, one decision (also once it is decided).
        { path: 'nominations/:address', element: <NominationPage /> },
        { path: 'nominate', element: <NominatePage /> },
        // Old /decisions?d=<signature> links open /decisions/<signature> (DecisionsPage).
        { path: 'decisions', element: <DecisionsPage /> },
        { path: 'decisions/:signature', element: <DecisionPage /> },
        // One Minter Admin poll (Minter Admins only); without an id, all of Decisions.
        { path: 'decisions/polls/:id', element: <AdminPollPage /> },
        { path: 'decisions/polls', element: <Navigate to="/decisions" replace /> },
        { path: 'people/:address', element: <PersonPage /> },
        { path: 'history', element: <HistoryPage /> },
        { path: 'history/card/:card', element: <LegacyCardPage /> },
        { path: 'history/card/:card/:section', element: <LegacyCardPage /> },
        { path: 'explorer/activity', element: <ActivityPage /> },
        { path: 'activity', element: <Navigate to={PATHS.activity} replace /> },
        { path: 'settings', element: <SettingsPage /> },
        // The Explorer: any account or transaction, read-only.
        ...explorerRoutes,
        // Old routes of the scaffold and the original app's boards.
        { path: 'minters/*', element: <Navigate to="/nominations" replace /> },
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
