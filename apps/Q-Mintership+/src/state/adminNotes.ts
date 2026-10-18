/**
 * Notes for the Minter Admins this device just published (writes/adminNotes.ts
 * marks them), shown on their decision or nomination at once until QDN lists
 * that version. Entries expire after 15 minutes, so a publish that never
 * arrives doesn't stick. Nothing here is saved on the device. (A comment for
 * the Minter Admins shows at once through the comments' own optimistic
 * store, state/comments.ts.)
 */
import { useMemo } from 'react';
import { atom, getDefaultStore, useAtomValue } from 'jotai';

export interface PendingAdminNote {
  identifier: string;
  key: string;
  /** The name it went under, and the account that owns it. */
  name: string;
  author: string;
  text: string;
  at: number;
}

const EXPIRE_MS = 15 * 60_000;

/** By identifier (`qmp-adminnote-<key>`) and name. */
export const pendingAdminNotesAtom = atom<Record<string, PendingAdminNote>>({});

const store = getDefaultStore();
const refOf = (name: string, identifier: string) => `${name}\n${identifier}`;

export function setPendingAdminNote(note: Omit<PendingAdminNote, 'at'> | null, ref?: string): void {
  if (!note) {
    if (!ref) return;
    store.set(pendingAdminNotesAtom, (current) => {
      const next = { ...current };
      delete next[ref];
      return next;
    });
    return;
  }
  store.set(pendingAdminNotesAtom, (current) => ({
    ...current,
    [refOf(note.name, note.identifier)]: { ...note, at: Date.now() },
  }));
}

/** The newest note this device published under one of `keys` by `authors`, still fresh. */
export function usePendingAdminNote(
  keys: readonly string[],
  authors: readonly string[]
): (PendingAdminNote & { ref: string }) | null {
  const all = useAtomValue(pendingAdminNotesAtom);
  const keyList = keys.join('+');
  const authorList = authors.join('+');
  return useMemo(() => {
    const wantedKeys = new Set(keyList.split('+'));
    const wantedAuthors = new Set(authorList.split('+'));
    const now = Date.now();
    let found: (PendingAdminNote & { ref: string }) | null = null;
    for (const [ref, note] of Object.entries(all)) {
      if (now - note.at > EXPIRE_MS) continue;
      if (!wantedKeys.has(note.key) || !wantedAuthors.has(note.author)) continue;
      if (!found || note.at > found.at) found = { ...note, ref };
    }
    return found;
  }, [all, keyList, authorList]);
}

/** Tests start empty. */
export function resetPendingAdminNotes(): void {
  store.set(pendingAdminNotesAtom, {});
}
