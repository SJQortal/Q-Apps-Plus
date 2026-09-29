// @ts-nocheck

import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'

import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { lightTheme, darkTheme } from './styles/theme'
import { store } from './state/store'
import { Provider } from 'react-redux'
import GlobalWrapper from './wrappers/GlobalWrapper'
import DownloadWrapper from './wrappers/DownloadWrapper'
import Notification from './components/common/Notification/Notification'
import { Mail } from './pages/Mail/Mail'

type ThemeMode = 'light' | 'dark'

const normalizeTheme = (value?: string | null): ThemeMode | null => {
  if (!value) return null
  const theme = String(value).toLowerCase()
  return theme === 'light' || theme === 'dark' ? (theme as ThemeMode) : null
}

const getInitialTheme = (): ThemeMode => {
  const qdnTheme = normalizeTheme(window?._qdnTheme)
  if (qdnTheme) return qdnTheme

  try {
    const params = new URLSearchParams(window.location.search)
    const queryTheme = normalizeTheme(params.get('theme'))
    if (queryTheme) return queryTheme
  } catch {
    /* ignore */
  }

  return 'dark'
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme === 'light' ? lightTheme : darkTheme}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper setTheme={setTheme}>
            <CssBaseline />

            <Routes>
              <Route path="/" element={<Mail />} />
              <Route path="/to/:name" element={<Mail isFromTo />} />
            </Routes>
          </GlobalWrapper>
        </DownloadWrapper>
      </ThemeProvider>
    </Provider>
  )
}

export default App
