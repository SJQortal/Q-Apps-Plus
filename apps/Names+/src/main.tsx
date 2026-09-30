import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './hub-theme/fonts.css';
import './i18n/i18n.ts';
import { Root } from './Root';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
