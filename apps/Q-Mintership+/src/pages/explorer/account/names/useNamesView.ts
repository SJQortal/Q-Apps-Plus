/**
 * How the Names tab lays its names out: a grid of cards (the default) or a
 * list, each name's history beside it, kept on this device
 * (`<prefix>names-view`: useListView).
 */
import { useListView, type ListView } from '../useListView';

export type NamesView = ListView;

export function useNamesView(): [NamesView, (view: NamesView) => void] {
  return useListView('names');
}
