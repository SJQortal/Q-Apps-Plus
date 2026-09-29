import ReactDOM from 'react-dom/client';
import App from './App';
import './hub-theme/fonts.css';
import './index.css';
import './i18n/i18n';
import './state/persist/jotaiIndexedDB';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <>
    <App />
    <div id="modal-root" />
  </>
);
