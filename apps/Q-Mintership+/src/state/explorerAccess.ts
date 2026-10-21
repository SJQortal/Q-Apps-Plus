/**
 * Whether the signed-in account sees the Explorer's detailed parts, as the
 * last screen that worked it out found it (hooks/useFullExplorer.ts), for the
 * small parts everywhere that only need to know: an exchange's account named
 * as the exchange (hooks/useDisplayName.ts), the Explorer Quiz's questions.
 * Kept with the address it is for, so another account never inherits it.
 * Nothing here is saved on the device.
 */
import { atom, getDefaultStore } from 'jotai';

export interface ExplorerAccess {
  address: string;
  full: boolean;
}

export const explorerAccessAtom = atom<ExplorerAccess | null>(null);

/** True only when it is known that `address` sees them. */
export function hasFullExplorer(access: ExplorerAccess | null, address: string): boolean {
  return Boolean(address && access?.full && access.address === address);
}

/** For code outside React (the Quiz's questions). */
export function fullExplorerNow(address: string): boolean {
  return hasFullExplorer(getDefaultStore().get(explorerAccessAtom), address);
}

/** Tests start with nothing known. */
export function resetExplorerAccess(): void {
  getDefaultStore().set(explorerAccessAtom, null);
}
