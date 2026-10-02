import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './hub-theme/fonts.css'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { GlobalContextMenu } from './components/common/GlobalContextMenu/GlobalContextMenu'
import { applyQAppTextSize } from '@qortal/qapp-lib/typography'
import { ensureLexendIllinoisTypographyStyle } from './styles/lexendIllinoisTypography'

// Hub and GO inject qortalRequest. Outside them (npm run dev, vite preview,
// a plain browser) every call rejects with a clear error instead of throwing
// a ReferenceError that unmounts the whole app.
const w = window as unknown as Record<string, unknown>
if (typeof w.qortalRequest !== 'function') {
  const notInHub = () =>
    Promise.reject(new Error('qortalRequest is only available inside Qortal Hub or GO'))
  w.qortalRequest = notInHub
  if (typeof w.qortalRequestWithTimeout !== 'function') w.qortalRequestWithTimeout = notInHub
}

if (typeof global === 'undefined') {
  // Check if window is defined to avoid issues in non-browser environments
  if (typeof window !== 'undefined') {
    ;(window as any).global = window
  }
}
interface CustomWindow extends Window {
  _qdnBase: any // Replace 'any' with the appropriate type if you know it
}

const customWindow = window as unknown as CustomWindow

ensureLexendIllinoisTypographyStyle({
  textSizeScale: {
    small: 0.875,
    medium: 1,
    large: 1.125
  }
})
applyQAppTextSize(document.documentElement, 'medium')

// Now you can access the _qdnTheme property without TypeScript errors
const baseUrl = customWindow?._qdnBase || ''
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter
    basename={baseUrl}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <App />
    <GlobalContextMenu />
    <div id="modal-root" />
  </BrowserRouter>
)
