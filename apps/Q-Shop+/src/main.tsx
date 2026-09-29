import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { HashRouter, BrowserRouter } from 'react-router-dom'
interface CustomWindow extends Window {
  _qdnBase: any // Replace 'any' with the appropriate type if you know it
}

const customWindow = window as unknown as CustomWindow

// Now you can access the _qdnTheme property without TypeScript errors
const baseUrl = customWindow?._qdnBase || ''
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter basename={baseUrl}>
    <App />
    <div id="modal-root" />
  </BrowserRouter>
)
