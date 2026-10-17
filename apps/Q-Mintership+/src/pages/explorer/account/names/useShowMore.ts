/**
 * A list shown `page` rows at a time; with an `id`, how many are shown is
 * kept for Back (useViewState). "Show more" moves the focus to the
 * first row it added (the button may leave with the last page, and the
 * reader goes on from where the new rows start). Rows take `tabIndex={-1}`
 * so a script can focus them; they stay out of the tab order.
 *
 * useFocusNewRows does the same for a list that grows its own way ("Show
 * all", a limit kept elsewhere): call `focusFrom(index)` as it grows.
 * useFocusFallback is for a button that leaves while it has the focus.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useViewState } from '../../../../hooks/useViewState';

export function useShowMore(page: number, id: string | null = null) {
  const [shown, setShown] = useViewState(id, page);
  const firstNew = useRef<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (firstNew.current === null) return;
    const row = listRef.current?.children[firstNew.current];
    firstNew.current = null;
    if (row instanceof HTMLElement) row.focus();
  }, [shown]);
  const showMore = () => {
    firstNew.current = shown;
    setShown((n) => n + page);
  };
  /** Show at least `count` rows (whole steps of `page`), with no focus move. */
  const showAtLeast = useCallback(
    (count: number) => setShown((n) => Math.max(n, Math.ceil(count / page) * page)),
    [page, setShown]
  );
  return { shown, showMore, showAtLeast, listRef };
}

/** The look of a row that can take the focus from "Show more". */
export const FOCUSABLE_ROW_SX = {
  '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
} as const;

/**
 * After a list grows, the focus goes to the row at the index given to
 * `focusFrom` (the first one added), once, on the next render. `listRef`
 * goes on the list; its rows take `tabIndex={-1}` and FOCUSABLE_ROW_SX.
 */
export function useFocusNewRows<T extends HTMLElement = HTMLUListElement>() {
  const listRef = useRef<T>(null);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const index = pending.current;
    if (index === null) return;
    pending.current = null;
    const row = listRef.current?.children[index];
    if (row instanceof HTMLElement) row.focus();
  });
  const focusFrom = (index: number) => {
    pending.current = index;
  };
  return { listRef, focusFrom };
}

/**
 * A button that can leave the page while it has the focus (a start button
 * replaced by what it started, a Stop button when the run ends): `control`
 * goes on it as its ref (one or several, never at once), `fallback` on what
 * takes the focus then (a control, or an element with `tabIndex={-1}`).
 * Nothing moves when the focus is somewhere else by then, and the page
 * doesn't scroll.
 */
export function useFocusFallback<F extends HTMLElement = HTMLElement>() {
  const lost = useRef(false);
  const fallback = useRef<F>(null);
  const control = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    // React runs this before the button leaves the page: it may still have the focus.
    return () => {
      if (node.ownerDocument.activeElement === node) lost.current = true;
    };
  }, []);
  useEffect(() => {
    if (!lost.current) return;
    lost.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    fallback.current?.focus({ preventScroll: true });
  });
  return { control, fallback };
}
