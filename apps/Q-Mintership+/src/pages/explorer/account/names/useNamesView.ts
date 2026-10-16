/**
 * How the Names tab lays its names out: a grid of cards (the default) or a
 * list, each name's history beside it. The choice is this viewer's own and
 * is kept on this device (localStorage, `<prefix>names-view`); when storage
 * can't be read or written the tab still works, in the grid.
 */
import { useState } from 'react';
import { STORAGE_PREFIX } from '../../../../constants/plus';

export type NamesView = 'grid' | 'list';

const KEY = `${STORAGE_PREFIX}names-view`;

function stored(): NamesView {
  try {
    return window.localStorage.getItem(KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function useNamesView(): [NamesView, (view: NamesView) => void] {
  const [view, setView] = useState<NamesView>(stored);
  const choose = (next: NamesView) => {
    setView(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Kept for this visit only.
    }
  };
  return [view, choose];
}
