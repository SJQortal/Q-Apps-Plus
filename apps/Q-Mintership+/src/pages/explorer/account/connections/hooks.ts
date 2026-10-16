/**
 * Small reads the Connections tab and the set pages share:
 *
 * - useStoreValues: values already in the read store, kept up to date,
 *   without loading anything (a mark shows only once its list is loaded);
 * - useMinterMarks: "Minter Admin" / "MINTER member" from the app's cached
 *   admin and member lists (one read each, shared with the rest of the
 *   app; loaded only when `load` is true), else no mark;
 * - usePayerBands: how many payments each account on screen has sent
 *   (xbusy:<a>, 4 at a time), for "has sent 500+ payments";
 * - useLevels: the level now of a few accounts (account:<a>).
 *
 * None of them polls.
 */
import { useEffect, useReducer } from 'react';
import { getAccount } from '../../../../data/accounts';
import { getAdmins, getMembers, type AdminList, type MemberList } from '../../../../data/group';
import { getPayerBand, type PayerBand } from '../../../../data/explorer/account';
import { runPool } from '../../../../data/explorer/sets';
import { peekQuery, subscribeQuery } from '../../../../data/query';
import type { AccountInfo } from '../../../../data/types';

/** The values of `keys` in the store now (undefined where nothing is loaded), re-read on change. */
export function useStoreValues<T>(keys: readonly string[]): Array<T | undefined> {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const joined = keys.join('\n');
  useEffect(() => {
    const offs = joined ? joined.split('\n').map((key) => subscribeQuery(key, bump)) : [];
    // A value that arrived between render and subscribing.
    bump();
    return () => offs.forEach((off) => off());
  }, [joined]);
  return keys.map((key) => peekQuery<T>(key));
}

export type MinterMark = 'Minter Admin' | 'MINTER member';

export interface MinterMarks {
  /** The mark for an account, or null (not in the lists, or the lists aren't loaded). */
  markOf: (address: string) => MinterMark | null;
  /** The member list is loaded, so "MINTER members only" can filter. */
  ready: boolean;
}

const quiet = () => undefined;

export function useMinterMarks(load: boolean): MinterMarks {
  useEffect(() => {
    if (!load) return;
    getMembers().catch(quiet);
    getAdmins().catch(quiet);
  }, [load]);
  const [members, admins] = useStoreValues<MemberList | AdminList>([
    'group:members',
    'group:admins',
  ]);
  const memberSet = new Set((members as MemberList | undefined)?.members.map((m) => m.member));
  const adminSet = new Set((admins as AdminList | undefined)?.admins.map((m) => m.member));
  return {
    markOf: (address) =>
      adminSet.has(address) ? 'Minter Admin' : memberSet.has(address) ? 'MINTER member' : null,
    ready: members !== undefined,
  };
}

/** Each account's payer band, read 4 at a time as they come on screen. */
export function usePayerBands(addresses: readonly string[]): Record<string, PayerBand | undefined> {
  const joined = addresses.join('\n');
  useEffect(() => {
    const todo = (joined ? joined.split('\n') : []).filter(
      (address) => address.startsWith('Q') && peekQuery(`xbusy:${address}`) === undefined
    );
    void runPool(todo, 4, (address) => getPayerBand(address).then(quiet, quiet));
  }, [joined]);
  const bands = useStoreValues<PayerBand>(addresses.map((address) => `xbusy:${address}`));
  return Object.fromEntries(addresses.map((address, i) => [address, bands[i]]));
}

/** The level now of each account (one cached read each). */
export function useLevels(addresses: readonly string[]): Record<string, number | undefined> {
  const joined = addresses.join('\n');
  useEffect(() => {
    for (const address of joined ? joined.split('\n') : []) getAccount(address).catch(quiet);
  }, [joined]);
  const accounts = useStoreValues<AccountInfo>(addresses.map((address) => `account:${address}`));
  return Object.fromEntries(addresses.map((address, i) => [address, accounts[i]?.level]));
}
