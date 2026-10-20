/**
 * How Connections shows what was recorded between them: as a circle (the
 * default, Simon 2026-10-17: "make the Circle default") or as a list,
 * kept on this device (`<prefix>connections-view`). `remember: false`
 * changes it for this visit only (the search switching to the list).
 */
import { useState } from 'react';
import { STORAGE_PREFIX } from '../../../../constants/plus';

export type ConnectionsView = 'list' | 'circle';

const KEY = `${STORAGE_PREFIX}connections-view`;

function stored(): ConnectionsView {
  try {
    return window.localStorage.getItem(KEY) === 'list' ? 'list' : 'circle';
  } catch {
    return 'circle';
  }
}

export function useConnectionsView(): [
  ConnectionsView,
  (view: ConnectionsView, remember?: boolean) => void,
] {
  const [view, setView] = useState<ConnectionsView>(stored);
  const choose = (next: ConnectionsView, remember = true) => {
    setView(next);
    if (!remember) return;
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Kept for this visit only.
    }
  };
  return [view, choose];
}
