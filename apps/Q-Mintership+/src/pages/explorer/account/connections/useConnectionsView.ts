/**
 * How Connections shows what was recorded between them: as a list (the
 * default) or as a circle (ConnectionsCircle), kept on this device
 * (`<prefix>connections-view`); the list when storage can't be read.
 */
import { useState } from 'react';
import { STORAGE_PREFIX } from '../../../../constants/plus';

export type ConnectionsView = 'list' | 'circle';

const KEY = `${STORAGE_PREFIX}connections-view`;

function stored(): ConnectionsView {
  try {
    return window.localStorage.getItem(KEY) === 'circle' ? 'circle' : 'list';
  } catch {
    return 'list';
  }
}

export function useConnectionsView(): [ConnectionsView, (view: ConnectionsView) => void] {
  const [view, setView] = useState<ConnectionsView>(stored);
  const choose = (next: ConnectionsView) => {
    setView(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Kept for this visit only.
    }
  };
  return [view, choose];
}
