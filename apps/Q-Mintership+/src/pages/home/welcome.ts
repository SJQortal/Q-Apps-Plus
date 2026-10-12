/**
 * The moment someone becomes a minter, for Home's small celebration. Home
 * remembers the last status it showed for each account (localStorage), so
 * the celebration plays once: when a nominated or approved account is seen
 * as a member, whether that happened while Home was open (a refresh) or
 * between visits. Join now celebrates at once and records it, so the
 * confirmation that follows doesn't celebrate twice.
 */
import { useEffect, useState } from 'react';
import { STORAGE_PREFIX } from '../../constants/plus';
import type { MyStatus, StatusKind } from '../../rules/status';

const KEY = `${STORAGE_PREFIX}last-status:`;
const WAITING: ReadonlySet<StatusKind> = new Set(['nominated', 'approvedInvite']);
const MEMBER: ReadonlySet<StatusKind> = new Set(['member', 'memberNominator']);

function read(address: string): string | null {
  try {
    return localStorage.getItem(KEY + address);
  } catch {
    return null;
  }
}

/** Record the status Home last showed (or that a celebration already played). */
export function rememberStatus(address: string, kind: StatusKind): void {
  try {
    localStorage.setItem(KEY + address, kind);
  } catch {
    // Private mode or blocked storage: at worst the celebration is skipped.
  }
}

/** True once, when this account went from nominated or approved to member. */
export function useBecameMinter(status: MyStatus | undefined): boolean {
  const [celebrate, setCelebrate] = useState(false);
  const address = status?.address ?? null;
  const kind = status?.kind ?? null;
  useEffect(() => {
    if (!address || !kind || kind === 'outsideHub' || kind === 'signedOut') return;
    const last = read(address) as StatusKind | null;
    if (last && WAITING.has(last) && MEMBER.has(kind)) setCelebrate(true);
    rememberStatus(address, kind);
  }, [address, kind]);
  return celebrate;
}
