/**
 * useState that the page visit keeps (pageVisits.ts; Simon, 2026-10-17:
 * "when going back from the rabbit holes I want the views while going back
 * to open where they were left at"). Back on a visit by any Back (the
 * app's, Hub's, the browser's, a trail crumb), each view comes back as it
 * was left: a row opened, Show more pressed, a sort or a side picked. A
 * new visit of the page starts from `initial`.
 *
 * `id` names the view on its page, under the ViewScope it is in (an
 * account's tab, a dialog): the same each time the page is drawn (a row's
 * signature, a list's name). null keeps nothing (a plain useState). When
 * the id changes in place (a list moved to another account), the view is
 * that id's own. Only a view that differs from where it starts is kept
 * (a long list's closed rows take no room). Values stay in memory for the
 * session only.
 */
import {
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { currentVisit, visitFor } from './pageVisits';
import { ViewScopeContext } from './viewScope';

interface Held<T> {
  key: string | null;
  /** Where the view starts on a new visit. */
  start: T;
  value: T;
}

export function useViewState<T>(
  id: string | null,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const scope = useContext(ViewScopeContext);
  const key = id === null ? null : scope ? `${scope}/${id}` : id;
  // The view for `key`: kept on this visit, else where it starts (`start`, never kept).
  const resolve = (forKey: string | null): Held<T> => {
    const start = typeof initial === 'function' ? (initial as () => T)() : initial;
    const views = forKey === null ? undefined : visitFor()?.views;
    const value = forKey !== null && views?.has(forKey) ? (views.get(forKey) as T) : start;
    return { key: forKey, start, value };
  };
  const [held, setHeld] = useState(() => resolve(key));
  let current = held;
  if (held.key !== key) {
    current = resolve(key);
    setHeld(current);
  }
  useEffect(() => {
    if (current.key === null) return;
    const views = currentVisit()?.views;
    if (!views) return;
    if (Object.is(current.value, current.start)) views.delete(current.key);
    else views.set(current.key, current.value);
  }, [current]);
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setHeld((before) => ({
        ...before,
        value: typeof next === 'function' ? (next as (value: T) => T)(before.value) : next,
      })),
    []
  );
  return [current.value, set];
}
