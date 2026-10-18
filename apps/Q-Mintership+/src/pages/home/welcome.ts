/**
 * The moment someone becomes a minter, for Home's small celebration. Home
 * remembers the last status it showed for each account (localStorage), so
 * the celebration plays once: when a nominated, approved or ready account
 * (one with an open join request) is seen as a member, whether that
 * happened while Home was open (a refresh) or between visits. Join now
 * celebrates at once and records it, so the confirmation that follows
 * doesn't celebrate twice.
 */
import { useEffect, useState } from 'react';
import { STORAGE_PREFIX } from '../../constants/plus';
import type { MyStatus, StatusKind } from '../../rules/status';

/** A status, or 'ready': not in MINTER, with an open join request. */
type Shown = StatusKind | 'ready';

const KEY = `${STORAGE_PREFIX}last-status:`;
const WAITING: ReadonlySet<Shown> = new Set(['nominated', 'approvedInvite', 'ready']);
const MEMBER: ReadonlySet<Shown> = new Set(['member', 'memberNominator']);
/** Statuses that can have an open join request. */
const CAN_BE_READY: ReadonlySet<StatusKind> = new Set(['newcomer', 'formerKicked', 'formerLeft']);

function read(address: string): string | null {
  try {
    return localStorage.getItem(KEY + address);
  } catch {
    return null;
  }
}

/** Record the status Home last showed (or that a celebration already played). */
export function rememberStatus(address: string, kind: Shown): void {
  try {
    localStorage.setItem(KEY + address, kind);
  } catch {
    // Private mode or blocked storage: at worst the celebration is skipped.
  }
}

/** True once, when this account went from nominated, approved or ready to member. */
export function useBecameMinter(status: MyStatus | undefined): boolean {
  const [celebrate, setCelebrate] = useState(false);
  const address = status?.address ?? null;
  const kind = status?.kind ?? null;
  const shown: Shown | null =
    kind && status?.hasJoinRequest && CAN_BE_READY.has(kind) ? 'ready' : kind;
  useEffect(() => {
    if (!address || !shown || shown === 'outsideHub' || shown === 'signedOut') return;
    const last = read(address) as Shown | null;
    if (last && WAITING.has(last) && MEMBER.has(shown)) setCelebrate(true);
    rememberStatus(address, shown);
  }, [address, shown]);
  return celebrate;
}
