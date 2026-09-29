import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ThemeProviderWrapper from './styles/theme/theme-provider.tsx';
import './i18n/i18n.ts';
import { Routes } from './Routes.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProviderWrapper>
      <Routes />
    </ThemeProviderWrapper>
  </StrictMode>
);
