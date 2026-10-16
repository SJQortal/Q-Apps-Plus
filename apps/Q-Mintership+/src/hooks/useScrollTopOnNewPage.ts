/**
 * A new page opens at its top. The window keeps its scroll across route
 * changes, so without this a tab or a link opened the next page as far
 * down as the last one was (seen in GO, where pages are long on phones).
 * Back and Forward (POP) leave the position alone, and a change of the
 * query only (a filter on the same page) doesn't jump. A tab of one
 * Explorer account is the same page (routes/paths.ts pageKeyOf): the
 * account page brings that tab's top into view when it is above the
 * screen, rather than going to the page's top (useTopInViewOnSwitch).
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { pageKeyOf } from '../routes/paths';
import { HEADER_HEIGHT_VAR } from './useOverlayPadding';
import { useReducedMotion } from './useReducedMotion';

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

/**
 * One part of a page switched in place (an Explorer account's tab, `part`,
 * on the same `page`), not by Back or Forward: the element `elementId`
 * comes into view when its top is above the screen or under the sticky
 * header. On portrait phones the account's tabs ride in that header, so a
 * tab can be picked from deep in a long one, and the next would open as
 * far down. html's scroll-padding keeps the top clear of the header.
 */
export function useTopInViewOnSwitch(page: string | null, part: string, elementId: string): void {
  const navigation = useNavigationType();
  const reduced = useReducedMotion();
  const shown = useRef({ page, part });
  useLayoutEffect(() => {
    const before = shown.current;
    shown.current = { page, part };
    if (!page || before.page !== page || before.part === part) return;
    if (navigation === 'POP') return;
    const el = document.getElementById(elementId);
    if (!el) return;
    const header =
      parseFloat(document.documentElement.style.getPropertyValue(HEADER_HEIGHT_VAR)) || 0;
    if (el.getBoundingClientRect().top < header)
      el.scrollIntoView?.({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [page, part, elementId, navigation, reduced]);
}
