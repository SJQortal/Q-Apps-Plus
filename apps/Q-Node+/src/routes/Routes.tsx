import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import App from '../App';
import { AppWrapper } from '../AppWrapper';

const Settings = lazy(() => import('../pages/Settings'));

interface CustomWindow extends Window {
  _qdnBase: string;
}
const customWindow = window as unknown as CustomWindow;
const baseUrl = customWindow?._qdnBase || '';

function PageFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
      <CircularProgress size={32} />
    </Box>
  );
}

// Built once at module scope; creating it per render would reset the router.
const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <AppWrapper />,
      children: [
        {
          index: true,
          element: <App />,
        },
        {
          path: 'settings',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Settings />
            </Suspense>
          ),
        },
      ],
    },
  ],
  {
    basename: baseUrl,
  }
);

export function Routes() {
  return <RouterProvider router={router} />;
}
