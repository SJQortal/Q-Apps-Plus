import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../test/setup';
import {
  fetchOwnerAddressFromNameCached,
  getAccountNames,
  getAddressAssetBalances,
  getAddressBalance,
  getAddressFromPublicKey,
  getAddressInfo,
  getAddressInfoCached,
  getNameFromAddress,
  getNameInfo,
  getNameInfoCached,
  getPublicKeyByName,
  getUserAccount,
  resetAccountCaches,
} from './account';

const ADDRESS = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';

describe('account', () => {
  it('reads the logged-in account through qortalRequest', async () => {
    mockQortalRequest('GET_USER_ACCOUNT', { address: ADDRESS, publicKey: 'PK' });
    mockQortalRequest('GET_ACCOUNT_NAMES', [{ name: 'alice', owner: ADDRESS }]);
    await expect(getUserAccount()).resolves.toEqual({ address: ADDRESS, publicKey: 'PK' });
    await expect(getAccountNames(ADDRESS)).resolves.toEqual([{ name: 'alice', owner: ADDRESS }]);
    expect(qortalCallsFor('GET_ACCOUNT_NAMES')[0]).toEqual({
      action: 'GET_ACCOUNT_NAMES',
      address: ADDRESS,
    });
  });

  it('maps /addresses/{address} onto AddressInfo and rejects bad addresses without a call', async () => {
    mockFetchRoute('/addresses/', {
      address: ADDRESS,
      reference: 'ref',
      publicKey: 'PK',
      defaultGroupId: 0,
      flags: 0,
      level: 5,
      blocksMinted: 100,
      blocksMintedAdjustment: 1,
      blocksMintedPenalty: 0,
      extra: 'ignored',
    });
    await expect(getAddressInfo('not-an-address')).resolves.toBeNull();
    expect(fetchCallsFor('/addresses/')).toHaveLength(0);
    await expect(getAddressInfo(ADDRESS)).resolves.toEqual({
      address: ADDRESS,
      reference: 'ref',
      publicKey: 'PK',
      defaultGroupId: 0,
      flags: 0,
      level: 5,
      blocksMinted: 100,
      blocksMintedAdjustment: 1,
      blocksMintedPenalty: 0,
    });
    expect(fetchCallsFor('/addresses/')).toEqual([`/addresses/${ADDRESS}`]);
  });

  it('caches address info per session', async () => {
    resetAccountCaches();
    mockFetchRoute('/addresses/', { address: ADDRESS, reference: 'r', publicKey: 'PK', level: 1 });
    await Promise.all([getAddressInfoCached(ADDRESS), getAddressInfoCached(ADDRESS)]);
    await getAddressInfoCached(ADDRESS);
    expect(fetchCallsFor('/addresses/')).toHaveLength(1);
  });

  it('reads balances as text and asset balances as JSON, never throwing', async () => {
    mockFetchRoute('/addresses/balance/', '12.5');
    await expect(getAddressBalance(ADDRESS)).resolves.toBe('12.5');
    await expect(getAddressBalance('bad')).resolves.toBeNull();
    mockFetchRoute('/assets/balances', [{ assetId: 0, balance: '12.5' }]);
    await expect(getAddressAssetBalances(ADDRESS)).resolves.toEqual([{ assetId: 0, balance: '12.5' }]);
    expect(fetchCallsFor('/assets/balances')).toEqual([
      `/assets/balances?address=${ADDRESS}&ordering=ASSET_BALANCE_ACCOUNT&limit=0`,
    ]);
    await expect(getAddressAssetBalances('bad')).resolves.toEqual([]);
  });

  it('reads name info, returns null for unknown names, and caches', async () => {
    resetAccountCaches();
    mockFetchRoute('/names/alice', {
      name: 'alice',
      reducedName: 'alice',
      owner: ADDRESS,
      data: '',
      registered: 1,
      isForSale: false,
    });
    mockFetchRoute('/names/nobody', new Response('', { status: 404 }));
    await expect(getNameInfo('nobody')).resolves.toBeNull();
    const info = await getNameInfoCached('alice');
    expect(info?.owner).toBe(ADDRESS);
    await getNameInfoCached('alice');
    expect(fetchCallsFor('/names/alice')).toHaveLength(1);
    await expect(fetchOwnerAddressFromNameCached('alice')).resolves.toBe(ADDRESS);
    await expect(getPublicKeyByName('nobody')).resolves.toBeNull();
  });

  it('converts public keys to addresses and addresses to names, with caching', async () => {
    resetAccountCaches();
    mockFetchRoute('/addresses/convert/', ` ${ADDRESS} `);
    await expect(getAddressFromPublicKey('PK')).resolves.toBe(ADDRESS);
    await expect(getAddressFromPublicKey('PK')).resolves.toBe(ADDRESS);
    expect(fetchCallsFor('/addresses/convert/')).toHaveLength(1);
    await expect(getAddressFromPublicKey('')).resolves.toBeNull();

    mockFetchRoute('/names/address/', [{ name: 'alice' }, { name: 'alice2' }]);
    await expect(getNameFromAddress(ADDRESS)).resolves.toBe('alice');
    await getNameFromAddress(ADDRESS);
    expect(fetchCallsFor('/names/address/')).toEqual([`/names/address/${ADDRESS}?limit=20`]);
    mockFetchRoute('/names/address/', []);
    await expect(getNameFromAddress('Qnew')).resolves.toBe('Qnew');
  });
});
