import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { hostModeAtom } from '../state/system';
import { normalizeHubPath } from '../routes/hubLocation';

type Theme = 'dark' | 'light';

interface HubWindow extends Window {
  _qdnTheme?: Theme;
}

/**
 * Listens for Hub's postMessage events: NAVIGATE_TO_PATH (Hub's back/forward
 * and deep links) and THEME_CHANGED (the user flipped Hub's light/dark mode).
 */
export function useHubMessages() {
  const setHostMode = useSetAtom(hostModeAtom);
  const navigate = useNavigate();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { action?: string; path?: string; theme?: string } | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.action === 'NAVIGATE_TO_PATH' && typeof data.path === 'string') {
        navigate(normalizeHubPath(data.path));
        window.parent?.postMessage({ action: 'NAVIGATION_SUCCESS', path: data.path }, '*');
      } else if (data.action === 'THEME_CHANGED' && (data.theme === 'dark' || data.theme === 'light')) {
        (window as HubWindow)._qdnTheme = data.theme;
        setHostMode(data.theme);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate, setHostMode]);
}
