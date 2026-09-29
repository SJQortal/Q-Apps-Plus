import { beforeEach, describe, expect, it } from 'vitest';
import { mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../test/setup';
import { resetGroupCaches } from './groups';
import { loadUserSession } from './session';

const ADDRESS = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';

beforeEach(() => resetGroupCaches());

describe('loadUserSession', () => {
  it('logs in, reads names and derives admin flags', async () => {
    mockQortalRequest('GET_USER_ACCOUNT', { address: ADDRESS, publicKey: 'PK' });
    mockQortalRequest('GET_ACCOUNT_NAMES', [{ name: 'alice' }, { name: 'alice2' }]);
    mockFetchRoute('/groups/member/', [{ groupId: 721, groupName: 'Q-Mintership-admin' }]);
    mockFetchRoute('/groups/members/694', { members: [] });
    await expect(loadUserSession()).resolves.toEqual({
      address: ADDRESS,
      publicKey: 'PK',
      name: 'alice',
      names: ['alice', 'alice2'],
      isForumAdmin: true,
      isMinterAdmin: false,
      isAdmin: true,
    });
    expect(qortalCallsFor('GET_ACCOUNT_NAMES')).toHaveLength(1);
  });

  it('loads an account without a name and survives a group lookup failure', async () => {
    mockQortalRequest('GET_USER_ACCOUNT', { address: ADDRESS, publicKey: 'PK' });
    mockQortalRequest('GET_ACCOUNT_NAMES', []);
    mockFetchRoute('/groups/member/', () => {
      throw new Error('offline');
    });
    mockFetchRoute('/groups/members/694', { members: [] });
    await expect(loadUserSession()).resolves.toMatchObject({ name: '', names: [], isAdmin: false });
  });

  it('fails when no account is logged in', async () => {
    mockQortalRequest('GET_USER_ACCOUNT', null);
    await expect(loadUserSession()).rejects.toThrow(/logged in/);
  });
});
