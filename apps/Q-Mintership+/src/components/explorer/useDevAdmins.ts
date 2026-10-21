/** The Dev Admins (data/explorer/devAdmins.ts), once read; undefined until then or when it can't be. */
import { useMemo } from 'react';
import { getDevAdmins } from '../../data/explorer/devAdmins';
import { useQuery } from '../../hooks/useQuery';

export const DEV_ADMIN = 'Dev Admin';

export function useDevAdmins(load = true): ReadonlySet<string> | undefined {
  const query = useQuery(load ? 'xdevadmins' : null, (force) => getDevAdmins({ force }));
  return useMemo(() => (query.data ? new Set(query.data) : undefined), [query.data]);
}
