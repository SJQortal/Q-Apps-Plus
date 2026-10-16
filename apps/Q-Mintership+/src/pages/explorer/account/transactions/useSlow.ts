/**
 * True once `active` has stayed true for `ms` (a read slower than usual:
 * a busy account's search), false again as soon as it stops.
 */
import { useEffect, useState } from 'react';

export const SLOW_MS = 3000;

export function useSlow(active: boolean, ms = SLOW_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSlow(true), ms);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [active, ms]);
  return active && slow;
}
