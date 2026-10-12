/**
 * The hooks screens use to read data. Each wraps a data/ loader with the
 * same key it caches under, plus a polite refresh interval for live views.
 *
 * Refresh pace: the chain makes a block about every 73 s, so live views
 * refresh every 60 s while visible; slow lists every few minutes.
 */
import { getAccount, getPrimaryName } from '../data/accounts';
import { getChainNow } from '../data/chain';
import { loadDecisions } from '../data/decisions';
import { getAdmins, getGroupInfo, getMembers } from '../data/group';
import { anonymousStatus, loadMyStatus } from '../data/me';
import { loadNominations, loadNominationsFor } from '../data/nominations';
import { getAddressHistory } from '../data/txs';
import type { MyStatus } from '../rules/status';
import { useSession } from '../state/session';
import { useQuery, type UseQueryResult } from './useQuery';

export const LIVE_REFRESH_MS = 60_000;

export function useChainNow() {
  return useQuery('chain:now', (force) => getChainNow({ force }), { refreshMs: LIVE_REFRESH_MS });
}

export function useGroupInfo() {
  return useQuery('group:info', (force) => getGroupInfo({ force }), { refreshMs: 5 * 60_000 });
}

export function useAdmins() {
  return useQuery('group:admins', (force) => getAdmins({ force }), { refreshMs: 5 * 60_000 });
}

/** The whole member list (7 pages): only for views that need it. */
export function useMembers(enabled = true) {
  return useQuery('group:members', (force) => getMembers({ force }), { enabled });
}

export function useDecisions(enabled = true) {
  return useQuery('decisions:queue', (force) => loadDecisions({ force }), {
    refreshMs: LIVE_REFRESH_MS,
    enabled,
  });
}

export function useNominations(enabled = true) {
  return useQuery('nominations:all', (force) => loadNominations({ force }), {
    refreshMs: LIVE_REFRESH_MS,
    enabled,
  });
}

export function useNominationsFor(address: string | null) {
  return useQuery(
    address ? `nominations:for:${address}` : null,
    (force) => loadNominationsFor(address as string, { force }),
    {
      refreshMs: LIVE_REFRESH_MS,
    }
  );
}

export function useAccount(address: string | null) {
  return useQuery(address ? `account:${address}` : null, (force) =>
    getAccount(address as string, { force })
  );
}

export function usePrimaryName(address: string | null) {
  return useQuery(address ? `name:${address}` : null, () => getPrimaryName(address as string));
}

export function useAddressHistory(address: string | null) {
  return useQuery(address ? `history:${address}` : null, (force) =>
    getAddressHistory(address as string, { force })
  );
}

/** Anyone's MINTER status: the same read (and key) as useMyStatus. */
function useStatusQuery(address: string | null, refreshMs: number) {
  return useQuery(
    address ? `status:${address}` : null,
    (force) => loadMyStatus(address as string, { force }),
    { refreshMs }
  );
}

/** Someone else's status, for their page: their standing changes slowly. */
export function usePersonStatus(address: string | null) {
  return useStatusQuery(address, 3 * 60_000);
}

export interface MyStatusResult extends Pick<
  UseQueryResult<MyStatus>,
  'refetch' | 'isLoading' | 'isError' | 'error' | 'fetching'
> {
  status: MyStatus | undefined;
}

/**
 * The signed-in account's status. Outside Hub or signed out it is the
 * matching anonymous status straight away.
 */
export function useMyStatus(): MyStatusResult {
  const session = useSession();
  const address = session.status === 'ready' ? session.address : null;
  const query = useStatusQuery(address, 90_000);
  if (session.status === 'outside')
    return { ...query, status: anonymousStatus('outside'), isLoading: false };
  if (session.status === 'signedOut' || session.status === 'error') {
    return { ...query, status: anonymousStatus('signedOut'), isLoading: false };
  }
  if (!address) return { ...query, status: undefined, isLoading: true };
  return { ...query, status: query.data };
}
