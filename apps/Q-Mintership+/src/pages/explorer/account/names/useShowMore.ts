/**
 * A list shown `page` rows at a time. "Show more" moves the focus to the
 * first row it added (the button may leave with the last page, and the
 * reader goes on from where the new rows start). Rows take `tabIndex={-1}`
 * so a script can focus them; they stay out of the tab order.
 *
 * useFocusNewRows does the same for a list that grows its own way ("Show
 * all", a limit kept elsewhere): call `focusFrom(index)` as it grows.
 */
import { useEffect, useRef, useState } from 'react';

export function useShowMore(page: number) {
  const [shown, setShown] = useState(page);
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
  return { shown, showMore, listRef };
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
