/**
 * How far an account has seen MINTER's History on this device: the chain
 * height its list reached the last time History was open, for the History
 * tab's count of what is new since (localStorage
 * `qmintershipplus-history-seen-<address>`, `{ v: 1, height }`). Only ever
 * moves forward. Without storage (a private window) it lasts the page.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_PREFIX } from '../constants/plus';

export function historySeenKey(address: string): string {
  return `${STORAGE_PREFIX}history-seen-${address}`;
}

const memory = new Map<string, number>();
const listeners = new Set<() => void>();

/** The height `address` has seen History up to, or null before their first look. */
export function readHistorySeen(address: string): number | null {
  try {
    const raw = window.localStorage.getItem(historySeenKey(address));
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: unknown; height?: unknown };
      if (parsed.v === 1 && Number.isSafeInteger(parsed.height) && (parsed.height as number) > 0)
        return parsed.height as number;
    }
  } catch {
    // unreadable or unavailable storage: what this page saw, if anything
  }
  return memory.get(address) ?? null;
}

/** History's list reached `height` for `address`: what it showed isn't new any more. */
export function markHistorySeen(address: string, height: number): void {
  if (!Number.isSafeInteger(height) || height <= 0) return;
  const current = readHistorySeen(address);
  if (current !== null && current >= height) return;
  memory.set(address, height);
  try {
    window.localStorage.setItem(historySeenKey(address), JSON.stringify({ v: 1, height }));
  } catch {
    // the page still has it
  }
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React: the height `address` has seen History up to (null: not yet, or nobody). */
export function useHistorySeen(address: string | null): number | null {
  const read = useCallback(() => (address ? readHistorySeen(address) : null), [address]);
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Tests: forget what this page saw. */
export function resetHistorySeen(): void {
  memory.clear();
}
