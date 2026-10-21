/**
 * Whether the signed-in account is a Minter Admin, from its status (the read
 * the app shell keeps fresh, `status:<address>`; nothing polls from here),
 * for the parts that show, or read, only for Minter Admins: the notes and
 * comments encrypted to them. False while unknown, signed out or outside Hub.
 */
import { loadMyStatus } from '../data/me';
import { useSession } from '../state/session';
import { useQuery } from './useQuery';

export function useViewerIsAdmin(): boolean {
  const session = useSession();
  const address = session.status === 'ready' ? session.address : null;
  const status = useQuery(address ? `status:${address}` : null, (force) =>
    loadMyStatus(address as string, { force })
  );
  return Boolean(address && status.data?.isAdmin && status.data.address === address);
}

/**
 * The signed-in address and whether it is a Minter Admin, with `known` false
 * until both are read (so a page can wait instead of showing the wrong view).
 */
export function useAdminViewer(): { viewer: string | null; isAdmin: boolean; known: boolean } {
  const session = useSession();
  const address = session.status === 'ready' ? session.address : null;
  const status = useQuery(address ? `status:${address}` : null, (force) =>
    loadMyStatus(address as string, { force })
  );
  const isAdmin = Boolean(address && status.data?.isAdmin && status.data.address === address);
  const settled =
    session.status !== 'idle' &&
    session.status !== 'loading' &&
    (!address || Boolean(status.data) || status.isError);
  return { viewer: address, isAdmin, known: settled };
}
