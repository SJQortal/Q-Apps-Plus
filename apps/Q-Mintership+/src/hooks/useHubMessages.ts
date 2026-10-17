import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetAtom } from 'jotai';
import { hostModeAtom } from '../state/system';
import { normalizeHubPath } from '../routes/hubLocation';
import { visitBelow } from './pageVisits';

type Theme = 'dark' | 'light';

interface HubWindow extends Window {
  _qdnTheme?: Theme;
}

/**
 * Listens for Hub's postMessage events: NAVIGATE_TO_PATH (Hub's back/forward
 * and deep links) and THEME_CHANGED (the user flipped Hub's light/dark mode).
 * Hub's Back is a navigation to the previous path (without its query, which
 * Hub isn't told): back on the page below, it opens with the query and the
 * state it had, as the app's own Back does (pageVisits.ts).
 */
export function useHubMessages() {
  const setHostMode = useSetAtom(hostModeAtom);
  const navigate = useNavigate();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { action?: string; path?: string; theme?: string } | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.action === 'NAVIGATE_TO_PATH' && typeof data.path === 'string') {
        const path = normalizeHubPath(data.path);
        const below = visitBelow(path);
        if (below) navigate(below.path, { state: below.state });
        else navigate(path);
        window.parent?.postMessage({ action: 'NAVIGATION_SUCCESS', path: data.path }, '*');
      } else if (
        data.action === 'THEME_CHANGED' &&
        (data.theme === 'dark' || data.theme === 'light')
      ) {
        (window as HubWindow)._qdnTheme = data.theme;
        setHostMode(data.theme);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate, setHostMode]);
}
