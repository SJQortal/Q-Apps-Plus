import { useCallback, useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  noteNavigation,
  notePathDrawn,
  noteScroll,
  popToPage,
  popVisit,
  resetPageVisits,
} from './pageVisits';

/**
 * The app's own back stack (pageVisits.ts). Every Hub tab is an iframe in
 * one Hub document, so `window.history` is shared: `history.length` counts
 * other tabs' entries and `navigate(-1)` can move a hidden tab instead of
 * this one. Back buttons therefore navigate to the previous in-app page,
 * with the state it was opened with, or to a parent page when the app was
 * opened on this page (a deep link or Hub's reload). Each page visit keeps
 * how it was left: back on it, it is drawn the same and scrolled to where
 * it was (useViewState, useScrollTopOnNewPage).
 */

/** Mount once, inside the router (AppShell). */
export function useTrackInAppHistory(): void {
  const location = useLocation();
  const type = useNavigationType();
  const path = location.pathname + location.search;
  // Before the pages under the shell are drawn: their views find their visit.
  notePathDrawn(path, type);
  // Before any page's own effects: what they keep goes to the visit on screen.
  useLayoutEffect(() => {
    noteNavigation(path, type, location.state);
  }, [location, path, type]);
  useEffect(() => {
    const onScroll = () => noteScroll(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

/** A Back handler: the previous in-app page, else `fallback` (replacing this entry). */
export function useSafeBack(fallback = '/'): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const previous = popVisit();
    if (previous) navigate(previous.path, { state: previous.state });
    else navigate(fallback, { replace: true });
  }, [fallback, navigate]);
}

/**
 * Back to the latest visit of a page opened earlier (an Explorer trail
 * crumb), as it was left: true when there was one to go back to, false
 * when the page should be opened anew.
 */
export function useGoBackTo(): (page: string) => boolean {
  const navigate = useNavigate();
  return useCallback(
    (page: string) => {
      const earlier = popToPage(page);
      if (!earlier) return false;
      navigate(earlier.path, { state: earlier.state });
      return true;
    },
    [navigate]
  );
}

/** Test hook: forget the stack between tests. */
export function resetInAppHistory(): void {
  resetPageVisits();
}
