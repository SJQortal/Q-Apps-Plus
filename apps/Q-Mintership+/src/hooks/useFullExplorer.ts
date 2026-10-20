/**
 * Whether the signed-in viewer sees the Explorer's detailed parts
 * (rules/explorer/access.ts): true for a Minter Admin, a MINTER member at
 * level 5 or above, or a Dev Admin; false for anyone else, signed out or
 * outside Hub; undefined while that is being read (the parts stay out until
 * it is known). The answer is kept for the small parts that only need to know
 * (state/explorerAccess.ts).
 *
 * Reads: the viewer's status (`status:<address>`, the read the app shell
 * keeps fresh) and, only when that doesn't settle it, the Dev Admins
 * (`xdevadmins`, one small read, kept 30 minutes).
 */
import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { getDevAdmins } from '../data/explorer/devAdmins';
import { loadMyStatus } from '../data/me';
import { fullExplorerByRole } from '../rules/explorer/access';
import { explorerAccessAtom } from '../state/explorerAccess';
import { useSession } from '../state/session';
import { useQuery } from './useQuery';

export function useFullExplorer(): boolean | undefined {
  const session = useSession();
  const address = session.status === 'ready' ? session.address : null;
  const nobody =
    session.status === 'outside' || session.status === 'signedOut' || session.status === 'error';
  const status = useQuery(address ? `status:${address}` : null, (force) =>
    loadMyStatus(address as string, { force })
  );
  const own = status.data && status.data.address === address ? status.data : null;
  const byRole = own ? fullExplorerByRole(own) : undefined;
  // A status that couldn't be read settles nothing by role: the Dev Admins may still.
  const askDev = Boolean(address) && (byRole === false || (byRole === undefined && status.isError));
  const dev = useQuery(askDev ? 'xdevadmins' : null, (force) => getDevAdmins({ force }));
  let full: boolean | undefined;
  if (!address) full = nobody ? false : undefined;
  else if (byRole) full = true;
  else if (!askDev) full = undefined;
  else if (dev.data) full = dev.data.includes(address);
  else full = dev.isError ? false : undefined;

  const setAccess = useSetAtom(explorerAccessAtom);
  useEffect(() => {
    if (address && full !== undefined) setAccess({ address, full });
    else if (nobody) setAccess(null);
  }, [address, full, nobody, setAccess]);
  return full;
}
