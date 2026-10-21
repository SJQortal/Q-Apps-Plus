/**
 * How an Explorer list lays itself out: a grid of cards (the default) or a
 * list. The choice is this viewer's own and kept on this device per list
 * (localStorage, `<prefix><list>-view`); when storage can't be read or
 * written the list still works, in the grid.
 */
import { useState } from 'react';
import { STORAGE_PREFIX } from '../../../constants/plus';

export type ListView = 'grid' | 'list';

function stored(key: string): ListView {
  try {
    return window.localStorage.getItem(key) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

/** `list` names the list ("names", "groups"). */
export function useListView(list: string): [ListView, (view: ListView) => void] {
  const key = `${STORAGE_PREFIX}${list}-view`;
  const [view, setView] = useState<ListView>(() => stored(key));
  const choose = (next: ListView) => {
    setView(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Kept for this visit only.
    }
  };
  return [view, choose];
}
