import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Box, Skeleton } from '@mui/material';
import { Layout, Page, PageHeader } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { HomePage } from './pages/HomePage';
import { notifyHubDisplayedPath } from './qortal/hubLocation';

const AppDetailPage = lazy(() => import('./pages/AppDetailPage').then((m) => ({ default: m.AppDetailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function HubNavigationReporter() {
  const { pathname } = useLocation();
  useEffect(() => {
    notifyHubDisplayedPath(pathname);
  }, [pathname]);
  return null;
}

function PageFallback() {
  return (
    <>
      <PageHeader title={<Skeleton width={120} />} />
      <Page $maxWidth={760}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={80} />
          <Skeleton variant="rounded" height={80} />
        </Box>
      </Page>
    </>
  );
}

export function App() {
  return (
    <ToastProvider>
      <HubNavigationReporter />
      <Layout>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/app/:name" element={<AppDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </ToastProvider>
  );
}
