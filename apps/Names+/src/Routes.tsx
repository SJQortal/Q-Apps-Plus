import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import App from './App';
import { AppWrapper } from './AppWrapper';

const Market = lazy(() => import('./pages/Market').then((m) => ({ default: m.Market })));
const Settings = lazy(() => import('./pages/Settings'));

// Use a custom type if you need it
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
          path: 'market',
          element: (
            <Suspense fallback={<PageFallback />}>
              <Market />
            </Suspense>
          ),
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
