/**
 * Who is using the app: the Hub account (address and public key) and its
 * primary name. Read once at start; Sign in asks again.
 *
 * - Outside Hub and GO there is no qortalRequest: status 'outside'.
 * - GET_USER_ACCOUNT can hang until Hub's 30 s timeout (Hub locked), so it is
 *   tried twice, then the app shows Sign in (docs/QORTAL.md pitfall 12).
 * - A declined Authenticate dialog is 'signedOut', not an error.
 */
import { useEffect } from 'react';
import { atom, getDefaultStore, useAtomValue } from 'jotai';
import { hasQortalRequest, qortal } from '../qortal/client';
import { getPrimaryName } from '../data/accounts';
import { resetQueries } from '../data/query';
import { isAccountRefusal, isHubDecline, isHubTimeout } from '../utils/hubErrors';

export type SessionStatus = 'idle' | 'outside' | 'loading' | 'signedOut' | 'ready' | 'error';

export interface Session {
  status: SessionStatus;
  address: string;
  publicKey: string;
  name: string | null;
  error: string;
}

export const EMPTY_SESSION: Session = {
  status: 'idle',
  address: '',
  publicKey: '',
  name: null,
  error: '',
};

export const sessionAtom = atom<Session>(EMPTY_SESSION);

const store = getDefaultStore();

interface UserAccount {
  address?: string;
  publicKey?: string;
}

async function requestAccount(): Promise<UserAccount | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await qortal<UserAccount | null>({ action: 'GET_USER_ACCOUNT' });
    } catch (error) {
      if (isHubDecline(error) || isAccountRefusal(error)) return null;
      if (!isHubTimeout(error) || attempt === 1) throw error;
    }
  }
  return null;
}

/** Ask Hub who is signed in. Safe to call again (the Sign in button). */
export async function signIn(): Promise<void> {
  if (!hasQortalRequest()) {
    store.set(sessionAtom, { ...EMPTY_SESSION, status: 'outside' });
    return;
  }
  const previous = store.get(sessionAtom);
  store.set(sessionAtom, { ...previous, status: 'loading', error: '' });
  try {
    const account = await requestAccount();
    if (!account?.address || !account.publicKey) {
      store.set(sessionAtom, { ...EMPTY_SESSION, status: 'signedOut' });
      return;
    }
    if (previous.address && previous.address !== account.address) resetQueries();
    const name = await getPrimaryName(account.address).catch(() => null);
    store.set(sessionAtom, {
      status: 'ready',
      address: account.address,
      publicKey: account.publicKey,
      name,
      error: '',
    });
  } catch (error) {
    store.set(sessionAtom, {
      ...EMPTY_SESSION,
      status: isHubTimeout(error) ? 'signedOut' : 'error',
      error: error instanceof Error ? error.message : 'Hub did not answer.',
    });
  }
}

let started = false;

/** Mount once (AppShell): reads the account on first load. */
export function useStartSession(): void {
  useEffect(() => {
    if (started) return;
    started = true;
    void signIn();
  }, []);
}

/** For tests. */
export function resetSessionStarter(): void {
  started = false;
  store.set(sessionAtom, EMPTY_SESSION);
}

export function useSession(): Session {
  return useAtomValue(sessionAtom);
}

/** The signer for write flows, or null when nobody is signed in. */
export function signerOf(
  session: Session
): { address: string; publicKey: string; name: string | null } | null {
  return session.status === 'ready'
    ? { address: session.address, publicKey: session.publicKey, name: session.name }
    : null;
}
