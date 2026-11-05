/**
 * Product deletes that didn't finish: the product list stopped listing the
 * products, but some catalogues still hold them (Hub published the list and
 * reported those catalogues as failed, and the seller closed the dialog).
 * Until they are cleared the products stay orderable by their links, so the
 * seller page offers Finish deleting (seller/FinishDeletesCard.tsx). Kept in
 * this browser (qshopplus-pending-deletes) per name and shop.
 */
import { useSyncExternalStore } from "react";
import { PENDING_DELETES_STORAGE_KEY } from "../constants/plus";

export interface PendingDelete {
  name: string;
  storeId: string;
  productIds: string[];
  /** The catalogues that may still hold them. */
  catalogueIds: string[];
  at: number;
}

let entries: PendingDelete[] | null = null;
const listeners = new Set<() => void>();

function isEntry(value: unknown): value is PendingDelete {
  const e = value as PendingDelete;
  return (
    !!e &&
    typeof e.name === "string" &&
    typeof e.storeId === "string" &&
    Array.isArray(e.productIds) &&
    e.productIds.every((id) => typeof id === "string") &&
    Array.isArray(e.catalogueIds) &&
    e.catalogueIds.every((id) => typeof id === "string") &&
    typeof e.at === "number"
  );
}

function load(): PendingDelete[] {
  if (entries) return entries;
  entries = [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PENDING_DELETES_STORAGE_KEY) ?? "[]");
    if (Array.isArray(stored)) entries = stored.filter(isEntry);
  } catch {
    // Unreadable or blocked storage: keep them for this tab only.
  }
  return entries;
}

function save(next: PendingDelete[]): void {
  entries = next;
  try {
    if (next.length > 0) localStorage.setItem(PENDING_DELETES_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(PENDING_DELETES_STORAGE_KEY);
  } catch {
    // Storage full or blocked: the in-tab copy still works.
  }
  for (const listener of [...listeners]) listener();
}

const same = (e: PendingDelete, name: string, storeId: string) => e.name === name && e.storeId === storeId;

/** Some catalogues of a delete didn't land: remember them (merged with what is already pending for the shop). */
export function notePendingDelete(entry: Omit<PendingDelete, "at">, now = Date.now()): void {
  const current = load();
  const existing = current.find((e) => same(e, entry.name, entry.storeId));
  const merged: PendingDelete = {
    name: entry.name,
    storeId: entry.storeId,
    productIds: [...new Set([...(existing?.productIds ?? []), ...entry.productIds])],
    catalogueIds: [...new Set([...(existing?.catalogueIds ?? []), ...entry.catalogueIds])],
    at: now,
  };
  save([...current.filter((e) => !same(e, entry.name, entry.storeId)), merged]);
}

/** These catalogues are cleared now; the shop's entry goes when none are left. */
export function clearPendingCatalogues(name: string, storeId: string, catalogueIds: string[]): void {
  const done = new Set(catalogueIds);
  const next: PendingDelete[] = [];
  for (const e of load()) {
    if (!same(e, name, storeId)) {
      next.push(e);
      continue;
    }
    const left = e.catalogueIds.filter((id) => !done.has(id));
    if (left.length > 0) next.push({ ...e, catalogueIds: left });
  }
  save(next);
}

export function pendingDeleteFor(name: string, storeId: string): PendingDelete | null {
  return load().find((e) => same(e, name, storeId)) ?? null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The shop's unfinished delete, re-rendering when it changes. */
export function usePendingDelete(name: string | undefined, storeId: string | undefined): PendingDelete | null {
  return useSyncExternalStore(subscribe, () => (name && storeId ? pendingDeleteFor(name, storeId) : null));
}

/** For tests. */
export function resetPendingDeletes(): void {
  entries = [];
  try {
    localStorage.removeItem(PENDING_DELETES_STORAGE_KEY);
  } catch {
    // nothing stored
  }
  for (const listener of [...listeners]) listener();
}
