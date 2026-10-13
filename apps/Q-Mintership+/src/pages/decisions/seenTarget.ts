/**
 * The target this device saw last, per group: Decisions says when it has
 * changed since the last visit or refresh, and why. Kept in localStorage
 * under the app's prefix (`qmintershipplus-seen-target-694`); a private
 * window just never shows the note.
 */
import { useEffect, useState } from 'react';
import { STORAGE_PREFIX } from '../../constants/plus';
import { MINTER_GROUP_ID } from '../../data/constants';

export interface SeenTarget {
  /** Core's admin count (the null owner included). */
  adminCount: number;
  /** Signatures needed at that count. */
  needed: number;
  /** The chain tip when it was seen. */
  height: number;
}

export interface TargetChange {
  from: SeenTarget;
  to: SeenTarget;
}

export function seenTargetKey(groupId: number = MINTER_GROUP_ID): string {
  return `${STORAGE_PREFIX}seen-target-${groupId}`;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function readSeenTarget(groupId: number = MINTER_GROUP_ID): SeenTarget | null {
  try {
    const raw = window.localStorage.getItem(seenTargetKey(groupId));
    const value = raw ? (JSON.parse(raw) as Partial<SeenTarget>) : null;
    if (!value || !isCount(value.adminCount) || !isCount(value.needed)) return null;
    return {
      adminCount: value.adminCount,
      needed: value.needed,
      height: isCount(value.height) ? value.height : 0,
    };
  } catch {
    return null;
  }
}

export function writeSeenTarget(value: SeenTarget, groupId: number = MINTER_GROUP_ID): void {
  try {
    window.localStorage.setItem(seenTargetKey(groupId), JSON.stringify(value));
  } catch {
    // A private window: the note just won't appear next time.
  }
}

/** The target moved between two snapshots (admin seats or signatures needed). */
export function targetMoved(a: SeenTarget, b: SeenTarget): boolean {
  return a.adminCount !== b.adminCount || a.needed !== b.needed;
}

/**
 * The change since the target this device saw last (the last visit, or the
 * last refresh during this one), kept on screen until dismissed or replaced
 * by a newer change. Each snapshot is saved as the new "seen".
 */
export function useSeenTargetChange(
  current: SeenTarget | null
): [change: TargetChange | null, dismiss: () => void] {
  const [last, setLast] = useState<SeenTarget | null>(() => readSeenTarget());
  const [change, setChange] = useState<TargetChange | null>(null);
  // React's adjust-while-rendering pattern: compare each new snapshot with the last one.
  if (current && (!last || targetMoved(last, current) || last.height !== current.height)) {
    if (last && targetMoved(last, current)) setChange({ from: last, to: current });
    setLast(current);
  }
  useEffect(() => {
    if (current) writeSeenTarget(current);
  }, [current]);
  return [change, () => setChange(null)];
}
