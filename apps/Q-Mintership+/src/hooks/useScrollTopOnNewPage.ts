/**
 * A new page opens at its top. The window keeps its scroll across route
 * changes, so without this a tab or a link opened the next page as far
 * down as the last one was (seen in GO, where pages are long on phones).
 * Back and Forward (POP) leave the position alone, and a change of the
 * query only (a filter on the same page) doesn't jump.
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

export function useScrollTopOnNewPage(): void {
  const { pathname } = useLocation();
  const type = useNavigationType();
  const last = useRef(pathname);
  useLayoutEffect(() => {
    if (last.current === pathname) return;
    last.current = pathname;
    if (type !== 'POP') window.scrollTo(0, 0);
  }, [pathname, type]);
}
