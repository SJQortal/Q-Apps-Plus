import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HubThemeProvider } from './hub-theme';
import './hub-theme/fonts.css';
import './index.css';
import { App } from './App';
import { resolveQdnBase } from './qortal/hubLocation';
import { themeConfig, THEME_STORAGE_KEY } from './theme/qplus-theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <BrowserRouter basename={resolveQdnBase()}>
        <App />
      </BrowserRouter>
    </HubThemeProvider>
  </StrictMode>
);
