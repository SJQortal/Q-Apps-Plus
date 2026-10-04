import { Suspense } from 'react'
import { Box } from '@mui/material'
import { Provider } from 'react-redux'
import { Route, Routes, useLocation, type Location } from 'react-router-dom'
import { HubThemeProvider } from './hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from './theme/qplus-theme'
import { store } from './state/store'
import GlobalWrapper from './wrappers/GlobalWrapper'
import DownloadWrapper from './wrappers/DownloadWrapper'
import Notification from './components/common/Notification/Notification'
import { Mail } from './pages/Mail/Mail'
import { SETTINGS_PATH } from './pages/Settings/settingsPath'
import { lazyNamed } from './components/common/lazyNamed'
import { ListSkeleton } from './layout/states'
import { ErrorBoundary } from './components/common/ErrorBoundary'

// Settings is a separate chunk: it is opened rarely and carries the theme
// picker, the blocked-names dialog and the changelog.
const SettingsPage = lazyNamed(() => import('./pages/Settings/SettingsPage'), 'SettingsPage')

type LocationState = { backgroundLocation?: Location } | null

/**
 * Settings opens on top of the mail page without unmounting it, so the inbox
 * keeps its loaded state (the "background location" pattern from React Router).
 */
function AppRoutes() {
  const location = useLocation()
  const state = location.state as LocationState
  const isSettings = location.pathname === SETTINGS_PATH
  const mailLocation = isSettings
    ? state?.backgroundLocation ?? { ...location, pathname: '/' }
    : location

  return (
    <>
      <Box sx={{ display: isSettings ? 'none' : 'contents' }}>
        <Routes location={mailLocation}>
          {/* Mail stays mounted under Settings; isHidden turns its keyboard shortcuts off. */}
          <Route path="/" element={<Mail isFromTo={false} isHidden={isSettings} />} />
          <Route path="/to/:name" element={<Mail isFromTo isHidden={isSettings} />} />
          <Route path="*" element={<Mail isFromTo={false} isHidden={isSettings} />} />
        </Routes>
      </Box>
      {isSettings && (
        <Suspense fallback={<ListSkeleton rows={8} />}>
          <SettingsPage />
        </Suspense>
      )}
    </>
  )
}

function App() {
  return (
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </GlobalWrapper>
        </DownloadWrapper>
      </HubThemeProvider>
    </Provider>
  )
}

export default App
