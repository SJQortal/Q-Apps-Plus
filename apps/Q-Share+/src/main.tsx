import ReactDOM from 'react-dom/client'
import App from './App'
import './hub-theme/fonts.css'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { watchEmbeddedFrame } from './utils/hubFrame'
import { routerBaseForPage } from './utils/routerBase'
interface CustomWindow extends Window {
  _qdnBase: string
}

const customWindow = window as unknown as CustomWindow

// Size the app to the Hub/GO iframe, not the device screen (DESIGN.md → Mobile).
watchEmbeddedFrame()

// A link that spells the app name differently from Core (Q-Share%2B) must not blank the app.
const baseUrl = routerBaseForPage(customWindow?._qdnBase || '')
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter
    basename={baseUrl}
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <App />
    <div id="modal-root" />
  </BrowserRouter>
)
