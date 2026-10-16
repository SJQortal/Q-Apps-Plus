/**
 * A new page opens at its top. The window keeps its scroll across route
 * changes, so without this a tab or a link opened the next page as far
 * down as the last one was (seen in GO, where pages are long on phones).
 * Back and Forward (POP) leave the position alone, and a change of the
 * query only (a filter on the same page) doesn't jump, nor does a tab of
 * one Explorer account (routes/paths.ts pageKeyOf).
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { pageKeyOf } from '../routes/paths';

export function useScrollTopOnNewPage(): void {
  const page = pageKeyOf(useLocation().pathname);
  const type = useNavigationType();
  const last = useRef(page);
  useLayoutEffect(() => {
    if (last.current === page) return;
    last.current = page;
    if (type !== 'POP') window.scrollTo(0, 0);
  }, [page, type]);
}
