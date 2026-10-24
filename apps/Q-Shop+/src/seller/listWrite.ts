/**
 * One write to a shop's product list at a time. A product publish, a
 * product delete, a collections publish that adds the list's pointer,
 * Recreate shop data and a shop delete each rebuild the whole list from the
 * page's copy; two at once would each drop the other's change (the review
 * found a delete undone by a publish started a moment before it). The lock
 * is taken when a write starts preparing, kept while its dialog is open, and
 * released when the dialog closes, the prepare stops, or the page goes.
 */
import { useEffect, useId, useSyncExternalStore } from "react";

export const LIST_BUSY_TEXT = "Another change to your product list is still going out. Try again once it has finished.";
export const LIST_CHANGED_TEXT = "Your product list changed while this was being prepared. Try again.";

let holder: string | null = null;
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of [...listeners]) listener();
}

/** Takes the lock for `who`; false when another write holds it. */
export function takeListWrite(who: string): boolean {
  if (holder !== null && holder !== who) return false;
  if (holder !== who) {
    holder = who;
    changed();
  }
  return true;
}

export function releaseListWrite(who: string): void {
  if (holder !== who) return;
  holder = null;
  changed();
}

/** Who holds the lock, for tests. */
export function listWriteHolder(): string | null {
  return holder;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while another write holds the lock (to disable buttons). */
export function useListWriteBusy(who?: string): boolean {
  return useSyncExternalStore(subscribe, () => holder !== null && holder !== who);
}

/** A lock owner for one hook instance, released when the component goes. */
export function useListWriteOwner(): string {
  const who = useId();
  useEffect(() => () => releaseListWrite(who), [who]);
  return who;
}

/** For tests. */
export function resetListWrite(): void {
  holder = null;
  changed();
}
