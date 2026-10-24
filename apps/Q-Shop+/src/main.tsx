import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './hub-theme/fonts.css'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { routerBaseForPage } from './utils/routerBase'
interface CustomWindow extends Window {
  _qdnBase: any // Replace 'any' with the appropriate type if you know it
}

const customWindow = window as unknown as CustomWindow

// Core injects the app name decoded ("/render/APP/Q-Shop+"); a link spelled
// Q-Shop%2B loads the same app under another spelling, which the router would
// not match (a blank app): routerBaseForPage rewrites it to Core's spelling.
const baseUrl = routerBaseForPage(customWindow?._qdnBase || '')
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter
    basename={baseUrl}
    future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
  >
    <App />
    <div id="modal-root" />
  </BrowserRouter>
)
