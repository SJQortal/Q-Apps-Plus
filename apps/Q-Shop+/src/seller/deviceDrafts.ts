/**
 * The seller's unpublished changes, kept on this device (Simon, 2026-10-25:
 * "keep them as drafts"): product drafts, collections, delivery prices and
 * discount codes stay through leaving the seller page, a reload or a
 * restart, until they're published or discarded. Each store keeps one draft
 * per name and shop (`draftKey`), in memory for the page and in IndexedDB
 * (localforage) for later: drafts carry pictures, too big for localStorage.
 * A key is read from the device the first time it's asked for.
 */
import { useEffect, useSyncExternalStore } from "react";
import localForage from "localforage";

interface Backend {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<unknown>;
  removeItem(key: string): Promise<void>;
}

// Tests keep drafts in memory (resetDeviceDrafts clears them between tests).
const testing = import.meta.env.MODE === "test";
const memoryBackends = new Map<string, Map<string, unknown>>();

function backendFor(name: string): Backend {
  if (testing) {
    const map = memoryBackends.get(name) ?? new Map<string, unknown>();
    memoryBackends.set(name, map);
    return {
      getItem: async <T,>(key: string) => (map.has(key) ? (map.get(key) as T) : null),
      setItem: async (key, value) => map.set(key, value),
      removeItem: async (key) => void map.delete(key),
    };
  }
  return localForage.createInstance({ name: "qshopplus-drafts", storeName: name });
}

/** The key of a name's draft for a shop. */
export function draftKey(name: string | null | undefined, storeId: string | null | undefined): string {
  return name && storeId ? `${name}\n${storeId}` : "";
}

export interface DeviceDraftStore<T> {
  get(key: string): T | null;
  set(key: string, value: T | null): void;
  /** The draft for `key`, read from the device the first time; null when there's none. */
  useDraft(key: string): T | null;
  /** Reads `key` from the device now (the seller page asks this for every store when it opens). */
  load(key: string): Promise<T | null>;
}

const stores: { reset(): void }[] = [];

export function createDeviceDraftStore<T>(name: string): DeviceDraftStore<T> {
  const memory = new Map<string, T>();
  const loaded = new Set<string>();
  const listeners = new Set<() => void>();
  let backend: Backend | null = null;
  const db = () => (backend ??= backendFor(name));
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };
  const load = async (key: string): Promise<T | null> => {
    if (!key) return null;
    if (!loaded.has(key)) {
      loaded.add(key);
      try {
        const saved = await db().getItem<T>(key);
        // A change made meanwhile wins over the copy on the device.
        if (saved !== null && !memory.has(key)) {
          memory.set(key, saved);
          emit();
        }
      } catch {
        // The device's store can't be read (private window): drafts last for this visit only.
      }
    }
    return memory.get(key) ?? null;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const store: DeviceDraftStore<T> = {
    get: (key) => memory.get(key) ?? null,
    set: (key, value) => {
      if (!key) return;
      loaded.add(key);
      if (value === null) memory.delete(key);
      else memory.set(key, value);
      emit();
      void (value === null ? db().removeItem(key) : db().setItem(key, value)).catch(() => {});
    },
    useDraft(key) {
      const value = useSyncExternalStore(subscribe, () => (key ? (memory.get(key) ?? null) : null));
      useEffect(() => {
        if (key) void load(key);
      }, [key]);
      return value;
    },
    load,
  };
  stores.push({
    reset: () => {
      memory.clear();
      loaded.clear();
      memoryBackends.get(name)?.clear();
      emit();
    },
  });
  return store;
}

/** For tests. */
export function resetDeviceDrafts(): void {
  for (const store of stores) store.reset();
}
