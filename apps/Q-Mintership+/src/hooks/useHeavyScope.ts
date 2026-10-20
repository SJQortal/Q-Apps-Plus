/**
 * Drop the heavy reads a view queued (data/explorer/heavy.ts) once it moves
 * on: when its scope (an account's address) changes, and when it closes.
 * Reads already running are left to finish; Back can use what they bring.
 */
import { useEffect } from 'react';
import { dropHeavy } from '../data/explorer/heavy';

export function useHeavyScope(scope: string | null | undefined): void {
  useEffect(() => {
    if (!scope) return;
    return () => dropHeavy(scope);
  }, [scope]);
}
