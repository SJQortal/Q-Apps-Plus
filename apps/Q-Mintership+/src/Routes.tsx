import { lazy } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { resolveQdnBase } from './routes/hubLocation';

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

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
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
  { basename: resolveQdnBase() }
);

export function Routes() {
  return <RouterProvider router={router} />;
}
