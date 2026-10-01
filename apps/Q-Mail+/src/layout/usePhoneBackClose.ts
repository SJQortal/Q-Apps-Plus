/**
 * Makes the hardware / browser Back button close a sub-pane on phones (an
 * open message, the composer, a thread): when `activeKey` becomes non-null a
 * history entry is pushed, so GO's Back pops it and `onBack` closes the pane;
 * when the pane closes from the UI while that entry is still on top, the
 * entry is popped again so Back does not bounce through an empty step.
 *
 * The entry keeps React Router's own history state (spread), and the URL
 * does not change, so the router re-renders the same page.
 */
import { useEffect, useRef } from 'react';

export const BACK_STATE_KEY = 'qmailSubPane';

interface Options {
  /** Phones only; on wider layouts Back keeps its normal meaning. */
  enabled: boolean;
  /** Which sub-pane is open, or null. A change of key replaces the entry. */
  activeKey: string | null;
  onBack: () => void;
}

export function hasSubPaneEntry(state: unknown): boolean {
  return Boolean(state && typeof state === 'object' && BACK_STATE_KEY in (state as Record<string, unknown>));
}

export function usePhoneBackClose({ enabled, activeKey, onBack }: Options): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;
  // Set while we pop our own entry, so that popstate is not taken as a Back press.
  const ignoreNextPopRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const onPopState = () => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      if (activeKeyRef.current && !hasSubPaneEntry(window.history.state)) {
        onBackRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const state = window.history.state;
    if (activeKey) {
      if (hasSubPaneEntry(state)) {
        if ((state as Record<string, unknown>)[BACK_STATE_KEY] !== activeKey) {
          window.history.replaceState({ ...state, [BACK_STATE_KEY]: activeKey }, '');
        }
        return;
      }
      window.history.pushState({ ...(state && typeof state === 'object' ? state : {}), [BACK_STATE_KEY]: activeKey }, '');
      return;
    }
    if (hasSubPaneEntry(state)) {
      ignoreNextPopRef.current = true;
      window.history.back();
    }
  }, [activeKey, enabled]);
}
