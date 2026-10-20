import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { legacyHashToPath, legacyPathToPath } from './legacyRoutes';

/**
 * Keeps old `#/board/card/section` links and the old nav hrefs working: on
 * load, and whenever the hash changes while the app is open, they redirect to
 * the matching React route and the hash is cleared.
 */
export function useLegacyRouteRedirect() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const fromHref = legacyPathToPath(pathname);
    if (fromHref && fromHref !== pathname) navigate(fromHref, { replace: true });
  }, [navigate, pathname]);

  useEffect(() => {
    const redirect = () => {
      const target = legacyHashToPath(window.location.hash);
      if (!target) return;
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`
      );
      navigate(target, { replace: true });
    };
    redirect();
    window.addEventListener('hashchange', redirect);
    return () => window.removeEventListener('hashchange', redirect);
  }, [navigate]);
}
