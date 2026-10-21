/**
 * The mailbox indexes other list components have loaded this session (the
 * sent index, each alias inbox), shared so that the cross-mailbox search can
 * read them without a second fetch. A plain module store with
 * useSyncExternalStore; nothing here touches QDN.
 */
import { useSyncExternalStore } from "react";

/**
 * The sent index of exactly these names (order and case ignored). Keyed by
 * names so a single name's Sent view never stands in for "All mail".
 */
export const sentIndexKey = (names: string[]): string => {
  const normalized = Array.from(
    new Set(names.map(name => String(name || "").trim().toLowerCase()).filter(Boolean))
  ).sort();
  return normalized.length ? `sent:${normalized.join(",")}` : "";
};
export const aliasIndexKey = (alias: string): string =>
  `alias:${String(alias || "").trim().toLowerCase()}`;

const indexes = new Map<string, any[]>();
// When each index was last built by a full walk (ms epoch).
const walkedAt = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version += 1;
  listeners.forEach(listener => listener());
}

/** `walkedAt`: set when `rows` come from a full walk (not a delta or an edit). */
export function publishMailIndex(key: string, rows: any[], options?: { walkedAt?: number }): void {
  if (!key) return;
  if (options?.walkedAt) walkedAt.set(key, options.walkedAt);
  if (indexes.get(key) === rows) return;
  indexes.set(key, rows);
  notify();
}

/** When the index under `key` was last built by a full walk, if ever. */
export function getMailIndexWalkedAt(key: string): number | undefined {
  return walkedAt.get(key);
}

export function getMailIndex(key: string): any[] | undefined {
  return indexes.get(key);
}

export function hasMailIndex(key: string): boolean {
  return indexes.has(key);
}

export function resetMailIndexStore(): void {
  indexes.clear();
  walkedAt.clear();
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
