/**
 * An account's status (the signed-in one, or anyone's for their page):
 * account (level), primary name and MINTER membership first. Members and
 * admins stop there: nothing else changes their status. Everyone else also
 * gets their join request, stored invite, bans, MINTER history, open
 * nominations and the chain tip. Admin- and member-only views load their
 * own data on top.
 */
import { isOpenState } from '../rules/nomination';
import { resolveStatus, type MyStatus } from '../rules/status';
import { effectiveBlocksMinted, getAccount, getPrimaryName } from './accounts';
import { getChainNow } from './chain';
import {
  activeBanFor,
  getBans,
  getJoinRequestFor,
  getMembership,
  getStoredInviteFor,
} from './group';
import { loadNominationsFor } from './nominations';
import { fetchQuery } from './query';
import { getAddressHistory } from './txs';

export function loadMyStatus(
  address: string,
  options: { force?: boolean } = {}
): Promise<MyStatus> {
  return fetchQuery(
    `status:${address}`,
    async () => {
      const force = options.force;
      const [account, name, membership] = await Promise.all([
        getAccount(address, { force }),
        getPrimaryName(address).catch(() => null),
        getMembership(address, { force }),
      ]);
      const base = {
        hub: 'signedIn' as const,
        address,
        name,
        level: account.level,
        blocksMinted: effectiveBlocksMinted(account),
        isMember: membership.isMember,
        isAdmin: membership.isAdmin,
      };
      if (membership.isMember || membership.isAdmin) {
        // The tip only dates removals, which members don't have: no forced read.
        const now = await getChainNow();
        return resolveStatus({
          ...base,
          hasJoinRequest: false,
          activeBan: null,
          storedInvite: null,
          history: [],
          nominations: [],
          msPerBlock: now.msPerBlock,
          tip: { height: now.height, timestamp: now.timestamp },
        });
      }
      const [joinRequest, storedInvite, bans, history, now, nominations] = await Promise.all([
        getJoinRequestFor(address, { force }),
        getStoredInviteFor(address, { force }),
        getBans(),
        getAddressHistory(address, { force }),
        getChainNow({ force }),
        loadNominationsFor(address, { force }),
      ]);
      return resolveStatus({
        ...base,
        hasJoinRequest: Boolean(joinRequest),
        activeBan: activeBanFor(bans, address, now.timestamp),
        storedInvite,
        history: history.rows,
        nominations: nominations.filter((n) => isOpenState(n.state)),
        msPerBlock: now.msPerBlock,
        tip: { height: now.height, timestamp: now.timestamp },
      });
    },
    { ttlMs: 60_000, force: options.force }
  );
}

/** Status for the screens that don't have an account (outside Hub, signed out). */
export function anonymousStatus(hub: 'outside' | 'signedOut'): MyStatus {
  return resolveStatus({
    hub,
    address: '',
    name: null,
    level: 0,
    blocksMinted: 0,
    isMember: false,
    isAdmin: false,
    hasJoinRequest: false,
    activeBan: null,
    storedInvite: null,
    history: [],
    nominations: [],
    msPerBlock: 72_900,
    tip: { height: 0, timestamp: 0 },
  });
}
