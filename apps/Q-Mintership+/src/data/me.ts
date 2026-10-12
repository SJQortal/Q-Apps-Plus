/**
 * The signed-in account's status, from about a dozen cached GETs:
 * account (level), primary name, MINTER membership, own join request,
 * stored invite, bans, own MINTER history, own nominations, and the chain
 * tip. Admin- and member-only views load their own data on top.
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
      const [
        account,
        name,
        membership,
        joinRequest,
        storedInvite,
        bans,
        history,
        now,
        nominations,
      ] = await Promise.all([
        getAccount(address, { force }),
        getPrimaryName(address).catch(() => null),
        getMembership(address, { force }),
        getJoinRequestFor(address, { force }),
        getStoredInviteFor(address, { force }),
        getBans(),
        getAddressHistory(address, { force }),
        getChainNow({ force }),
        loadNominationsFor(address, { force }),
      ]);
      return resolveStatus({
        hub: 'signedIn',
        address,
        name,
        level: account.level,
        blocksMinted: effectiveBlocksMinted(account),
        isMember: membership.isMember,
        isAdmin: membership.isAdmin,
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
