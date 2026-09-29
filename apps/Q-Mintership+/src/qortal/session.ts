/**
 * Who is using the app (legacy `userState`, `login` and `verifyUserIsAdmin`).
 * Read once at start and kept in the user atom; the boards ask it who may
 * see the admin room, publish a nomination, approve an invite and so on.
 */
import { getAccountNames, getUserAccount } from './account';
import { hasQortalRequest } from './client';
import { getAdminFlags, type AdminFlags } from './groups';

export interface UserSession extends AdminFlags {
  address: string;
  publicKey: string;
  /** The first registered name, '' when the account has none. */
  name: string;
  names: string[];
}

export const EMPTY_FLAGS: AdminFlags = { isForumAdmin: false, isMinterAdmin: false, isAdmin: false };

/**
 * Log in through Hub and work out the user's roles. Throws when Hub is not
 * there; an account without a name still loads (name '').
 */
export async function loadUserSession(): Promise<UserSession> {
  const account = await getUserAccount();
  const [names, flags] = await Promise.all([
    getAccountNames(account.address),
    getAdminFlags(account.address).catch(() => EMPTY_FLAGS),
  ]);
  const list = names.map((entry) => entry.name).filter(Boolean);
  return {
    address: account.address,
    publicKey: account.publicKey ?? '',
    name: list[0] ?? '',
    names: list,
    ...flags,
  };
}

export function canUseQortal(): boolean {
  return hasQortalRequest();
}
