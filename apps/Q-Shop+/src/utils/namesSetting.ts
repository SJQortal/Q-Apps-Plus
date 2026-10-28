/**
 * Whether Q-Shop+ shows names for sale (Simon, 2026-10-24: "add toggle in
 * settings to hide the Names sales from q-shop"): the Names tab and its
 * page. On by default; kept with the other settings (qshopplus-settings),
 * saved by Settings → Sync, shared through one small store.
 */
import { useSyncExternalStore } from "react";
import { readStoredSettings, writeStoredSettings } from "./settingsStorage";

let current: boolean | null = null;
const listeners = new Set<() => void>();

export function getShowNames(): boolean {
  if (current === null) current = readStoredSettings().showNames !== false;
  return current;
}

export function setShowNames(show: boolean): void {
  current = show;
  writeStoredSettings({ showNames: show });
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useShowNames(): boolean {
  return useSyncExternalStore(subscribe, getShowNames);
}

/** For tests. */
export function resetShowNames(): void {
  current = null;
}
