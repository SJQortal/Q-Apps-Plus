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

// Home is the first screen almost everyone sees; the rest load on demand.
import HomePage from './pages/home/HomePage';
const NominationsPage = lazy(() => import('./pages/nominations/NominationsPage'));
const NominatePage = lazy(() => import('./pages/nominations/NominatePage'));
const DecisionsPage = lazy(() => import('./pages/decisions/DecisionsPage'));
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
        { path: 'nominate', element: <NominatePage /> },
        { path: 'decisions', element: <DecisionsPage /> },
        { path: 'people/:address', element: <PersonPage /> },
        { path: 'history', element: <HistoryPage /> },
        { path: 'history/card/:card', element: <LegacyCardPage /> },
        { path: 'history/card/:card/:section', element: <LegacyCardPage /> },
        { path: 'activity', element: <ActivityPage /> },
        { path: 'settings', element: <SettingsPage /> },
        // Old routes of the scaffold and the original app's boards.
        { path: 'minters/*', element: <Navigate to="/nominations" replace /> },
        { path: 'forum/*', element: <Navigate to="/" replace /> },
        { path: 'stats/*', element: <Navigate to="/activity" replace /> },
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
