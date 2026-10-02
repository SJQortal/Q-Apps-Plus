/**
 * Makes the hardware / browser Back button close a sub-pane on phones (an
 * open message, the composer, a thread, a group's thread list, an alias
 * inbox), through the router's own history and never `window.history`.
 *
 * Every Hub tab is an iframe in one Hub document, so `window.history` is
 * shared: `history.length` counts other tabs' entries and `history.back()`
 * can move a hidden tab instead of this one (docs/QORTAL.md → Hub & GO
 * pitfalls 8). So:
 *
 * - when `activeKey` becomes non-null, a router entry is pushed for the same
 *   path with `state.qmailSubPane = key` (a change of key replaces it);
 * - GO's Back pops that entry: the router reports a POP to an entry without
 *   the key while a pane is open, and `onBack` closes the pane;
 * - when the pane closes from the UI, the entry is replaced by one without
 *   the key, so nothing navigates backwards in the shared history.
 *
 * The URL never changes, so the router re-renders the same page.
 */
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';

export const BACK_STATE_KEY = 'qmailSubPane';

interface Options {
  /** Phones only; on wider layouts Back keeps its normal meaning. */
  enabled: boolean;
  /** Which sub-pane is open, or null. A change of key replaces the entry. */
  activeKey: string | null;
  onBack: () => void;
}

/** The sub-pane key carried by a router entry's state, or null. */
export function subPaneOf(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const value = (state as Record<string, unknown>)[BACK_STATE_KEY];
  return typeof value === 'string' && value ? value : null;
}

export function hasSubPaneEntry(state: unknown): boolean {
  return subPaneOf(state) !== null;
}

function withoutSubPane(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== 'object') return null;
  const rest: Record<string, unknown> = { ...(state as Record<string, unknown>) };
  delete rest[BACK_STATE_KEY];
  return Object.keys(rest).length ? rest : null;
}

export function usePhoneBackClose({ enabled, activeKey, onBack }: Options): void {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  const locationRef = useRef(location);
  locationRef.current = location;
  // The entry seen last, so that enabling the hook on an old POP entry (a
  // window resized to phone width) is not taken as a Back press.
  const seenKeyRef = useRef(location.key);

  // Back (GO's hardware button, the browser's Back) pops the sub-pane entry.
  useEffect(() => {
    const changed = location.key !== seenKeyRef.current;
    seenKeyRef.current = location.key;
    if (!enabled || !changed || navigationType !== 'POP') return;
    if (activeKeyRef.current && subPaneOf(location.state) === null) {
      onBackRef.current();
    }
  }, [enabled, location, navigationType]);

  // Keep the router entry in step with the open sub-pane.
  useEffect(() => {
    if (!enabled) return;
    const current = locationRef.current;
    const entryKey = subPaneOf(current.state);
    const path = current.pathname + current.search + current.hash;
    const state = current.state && typeof current.state === 'object' ? (current.state as Record<string, unknown>) : {};
    if (activeKey) {
      if (entryKey === activeKey) return;
      // A different sub-pane replaces the entry rather than stacking another.
      navigate(path, { replace: entryKey !== null, state: { ...state, [BACK_STATE_KEY]: activeKey } });
      return;
    }
    if (entryKey !== null) {
      navigate(path, { replace: true, state: withoutSubPane(current.state) });
    }
  }, [activeKey, enabled, navigate]);
}
