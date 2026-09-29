import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AppShell } from './components/layout/AppShell';
import { Home } from './pages/Home';
import { BoardPlaceholder } from './pages/BoardPlaceholder';
import { resolveQdnBase } from './routes/hubLocation';

const Settings = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
      <CircularProgress size={32} />
    </Box>
  );
}

const forum = <BoardPlaceholder title="Forum" subtitle="General, Minters and Admins rooms" phase={2} itemLabel="room" />;
const minters = <BoardPlaceholder title="Minter Board" subtitle="Nominations, comments and votes" phase={2} />;
const mam = <BoardPlaceholder title="MAM Board" subtitle="Add or remove Minter Admins" phase={2} />;
const stats = <BoardPlaceholder title="Stats" subtitle="Nominator statistics and leaderboards" phase={2} itemLabel="section" />;
const adminBoard = <BoardPlaceholder title="Admin Board" subtitle="Encrypted, Minter Admins only" phase={4} />;
const tools = <BoardPlaceholder title="Admin Tools" subtitle="Block list, pending and manual invites" phase={4} />;
const account = <BoardPlaceholder title="Account details" subtitle="Transactions and minting history" phase={4} itemLabel="account" />;

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Home /> },
        { path: 'forum', element: forum },
        { path: 'forum/:card', element: forum },
        { path: 'minters', element: minters },
        { path: 'minters/:card', element: minters },
        { path: 'minters/:card/:section', element: minters },
        { path: 'mam', element: mam },
        { path: 'mam/:card', element: mam },
        { path: 'mam/:card/:section', element: mam },
        { path: 'stats', element: stats },
        { path: 'stats/:card', element: stats },
        { path: 'admin-board', element: adminBoard },
        { path: 'admin-board/:card', element: adminBoard },
        { path: 'admin-board/:card/:section', element: adminBoard },
        { path: 'tools', element: tools },
        { path: 'account/:card', element: account },
        {
          path: 'settings',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Settings />
            </Suspense>
          ),
        },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
  ],
  { basename: resolveQdnBase() }
);

export function Routes() {
  return <RouterProvider router={router} />;
}
