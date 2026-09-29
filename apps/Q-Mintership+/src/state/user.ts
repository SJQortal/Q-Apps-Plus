import { useEffect } from 'react';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { canUseQortal, loadUserSession, type UserSession } from '../qortal';

export type UserStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';

export interface UserState extends UserSession {
  status: UserStatus;
  error: string;
}

export const EMPTY_USER: UserState = {
  status: 'idle',
  error: '',
  address: '',
  publicKey: '',
  name: '',
  names: [],
  isAdmin: false,
  isMinterAdmin: false,
  isForumAdmin: false,
};

export const userAtom = atom<UserState>(EMPTY_USER);

let started = false;

/** Logs in once per page load and keeps the roles in the user atom. */
export function useInitializeUser() {
  const setUser = useSetAtom(userAtom);
  useEffect(() => {
    if (started) return;
    started = true;
    if (!canUseQortal()) {
      setUser({ ...EMPTY_USER, status: 'unavailable' });
      return;
    }
    setUser({ ...EMPTY_USER, status: 'loading' });
    loadUserSession()
      .then((session) => setUser({ ...session, status: 'ready', error: '' }))
      .catch((error: unknown) =>
        setUser({
          ...EMPTY_USER,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      );
  }, [setUser]);
}

/** For tests: allow the initializer to run again. */
export function resetUserInitializer() {
  started = false;
}

export function useUser(): UserState {
  return useAtomValue(userAtom);
}
