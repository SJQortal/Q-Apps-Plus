import { useEffect, useState } from 'react';
import { useAtomValue } from 'jotai';
import { checkAvatars, getUnitFee, knownAvatar } from '../api/names';
import { refreshAtom } from '../state/global/names';

/** The fee for one transaction type in QORT, or null until known. */
export function useUnitFee(txType: string): number | null {
  const [fee, setFee] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getUnitFee(txType)
      .then((value) => {
        if (!cancelled) setFee(value);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [txType]);
  return fee;
}

export type AvatarStatuses = Record<string, boolean | undefined>;

/**
 * Whether each name has an avatar: known answers at once, the rest after one
 * batched search. Re-checks when `refreshAtom` changes (after a publish).
 */
export function useAvatarStatuses(names: string[]): AvatarStatuses {
  const refresh = useAtomValue(refreshAtom);
  const key = names.join('\n');
  const [statuses, setStatuses] = useState<AvatarStatuses>({});

  useEffect(() => {
    const list = key ? key.split('\n') : [];
    const known: AvatarStatuses = {};
    for (const name of list) {
      const has = knownAvatar(name);
      if (has !== null) known[name] = has;
    }
    setStatuses(known);
    if (list.length === 0) return;
    let cancelled = false;
    checkAvatars(list)
      .then((map) => {
        if (!cancelled) setStatuses(Object.fromEntries(map));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [key, refresh]);

  return statuses;
}
