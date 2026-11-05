/**
 * Whether the Shops page asks "Have something to sell?" of a signed-in name
 * with no shop (Simon, 2026-10-25: it "can be closed for users that don't
 * have a shop and don't want to see it every time they visit"). Its X turns
 * it off; Settings turns it back on. On by default, this device only.
 */
import { useSyncExternalStore } from "react";
import { readStoredSettings, writeStoredSettings } from "./settingsStorage";

let current: boolean | null = null;
const listeners = new Set<() => void>();

export function getShowSellBanner(): boolean {
  if (current === null) current = readStoredSettings().showSellBanner !== false;
  return current;
}

export function setShowSellBanner(show: boolean): void {
  current = show;
  writeStoredSettings({ showSellBanner: show });
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useShowSellBanner(): boolean {
  return useSyncExternalStore(subscribe, getShowSellBanner);
}

/** For tests. */
export function resetShowSellBanner(): void {
  current = null;
}
