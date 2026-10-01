/**
 * The mailbox indexes other list components have loaded this session (the
 * sent index, each alias inbox), shared so that the cross-mailbox search can
 * read them without a second fetch. A plain module store with
 * useSyncExternalStore; nothing here touches QDN.
 */
import { useSyncExternalStore } from "react";

export const SENT_INDEX_KEY = "sent";
export const aliasIndexKey = (alias: string): string =>
  `alias:${String(alias || "").trim().toLowerCase()}`;

const indexes = new Map<string, any[]>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach(listener => listener());
}

export function publishMailIndex(key: string, rows: any[]): void {
  if (!key) return;
  if (indexes.get(key) === rows) return;
  indexes.set(key, rows);
  notify();
}

export function getMailIndex(key: string): any[] | undefined {
  return indexes.get(key);
}

export function hasMailIndex(key: string): boolean {
  return indexes.has(key);
}

export function resetMailIndexStore(): void {
  indexes.clear();
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The rows published under `key`, re-rendering when they change. */
export function useMailIndex(key: string): any[] | undefined {
  return useSyncExternalStore(subscribe, () => indexes.get(key), () => indexes.get(key));
}

/** A counter that changes whenever any index changes; read the rows with getMailIndex. */
export function useMailIndexVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}
