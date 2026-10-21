import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './hub-theme/fonts.css';
import { Root } from './Root';
import { watchForNewBuild } from './utils/staleBuild';

watchForNewBuild();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
