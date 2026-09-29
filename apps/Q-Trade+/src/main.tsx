import { BrowserRouter } from 'react-router-dom'
import  { createRoot } from 'react-dom/client'
import App from './App.tsx'
import "./index.scss";
import { IndexedDBProvider } from './contexts/indexedDBContext.tsx';

interface CustomWindow extends Window {
  _qdnBase: string;
}

const customWindow = window as unknown as CustomWindow;

const baseUrl = customWindow?._qdnBase || "";
createRoot(document.getElementById('root')!).render(
  <BrowserRouter basename={baseUrl}>
   <IndexedDBProvider>
    <App />
    </IndexedDBProvider>
  </BrowserRouter>,
)
