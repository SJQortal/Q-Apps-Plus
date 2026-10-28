import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './hub-theme/fonts.css'
import './index.css'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { routerBaseForPage } from './utils/routerBase'
interface CustomWindow extends Window {
  _qdnBase: any // Replace 'any' with the appropriate type if you know it
}

const customWindow = window as unknown as CustomWindow

// Core injects the app name decoded ("/render/APP/Q-Shop+"); a link spelled
// Q-Shop%2B loads the same app under another spelling, which the router would
// not match (a blank app): routerBaseForPage rewrites it to Core's spelling.
const baseUrl = routerBaseForPage(customWindow?._qdnBase || '')
// One route holding the app's own <Routes>: a data router, so a page can hold back leaving it (the seller
// page's unpublished changes: seller/useLeaveGuard.ts).
const router = createBrowserRouter(
  [
    {
      path: '*',
      element: (
        <>
          <App />
          <div id="modal-root" />
        </>
      ),
    },
  ],
  { basename: baseUrl, future: { v7_relativeSplatPath: true } }
)
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <RouterProvider router={router} future={{ v7_startTransition: true }} />
)
