import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import { resetAccountCaches } from './account';
import {
  fetchAdminGroupsMembersPublicKeys,
  fetchAllAdminGroupsMembers,
  fetchAllGroups,
  fetchGroupInvitesByAddressCached,
  fetchMinterGroupAdmins,
  fetchMinterGroupMembers,
  getAdminFlags,
  getUserGroups,
  resetGroupCaches,
} from './groups';

const ADMIN = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';
const USER = 'QUserUy6sUiEnaN87dWmE92g1uQjrvPgrWX';

beforeEach(() => {
  resetGroupCaches();
  resetAccountCaches();
});

describe('groups', () => {
  it('reads MINTER admins from the exact legacy URL and caches them', async () => {
    mockFetchRoute('/groups/members/694', { members: [{ member: ADMIN, isAdmin: true }] });
    const admins = await fetchMinterGroupAdmins();
    expect(admins).toEqual([{ member: ADMIN, isAdmin: true }]);
    await fetchMinterGroupAdmins();
    expect(fetchCallsFor('/groups/members/694')).toEqual([
      '/groups/members/694?onlyAdmins=true&limit=0&reverse=true',
    ]);
    await fetchMinterGroupAdmins(true);
    expect(fetchCallsFor('/groups/members/694')).toHaveLength(2);
  });

  it('throws when the admins payload has no members array', async () => {
    mockFetchRoute('/groups/members/694', { nope: true });
    await expect(fetchMinterGroupAdmins()).rejects.toThrow(/members/);
  });

  it('returns [] for MINTER members on failure', async () => {
    mockFetchRoute('/groups/members/694', new Response('down', { status: 500 }));
    await expect(fetchMinterGroupMembers()).resolves.toEqual([]);
    mockFetchRoute('/groups/members/694', { members: [{ member: USER, joined: 1 }] });
    await expect(fetchMinterGroupMembers(true)).resolves.toEqual([{ member: USER, joined: 1 }]);
    expect(fetchCallsFor('/groups/members/694')).toContain('/groups/members/694?limit=0');
  });

  it('merges the three admin groups without duplicates', async () => {
    mockFetchRoute('/groups/members/721', { members: [{ member: ADMIN }, { member: USER }] });
    mockFetchRoute('/groups/members/1', { members: [{ member: ADMIN }] });
    mockFetchRoute('/groups/members/673', { members: [{ member: 'Qthird' }] });
    await expect(fetchAllAdminGroupsMembers()).resolves.toEqual([
      { member: ADMIN },
      { member: USER },
      { member: 'Qthird' },
    ]);
    expect(fetchCallsFor('/groups/members/')).toEqual([
      '/groups/members/721?limit=0',
      '/groups/members/1?limit=0',
      '/groups/members/673?limit=0',
    ]);
  });

  it('collects admin public keys from every admin group plus MINTER admins', async () => {
    mockFetchRoute('/groups/members/721', { members: [{ member: ADMIN }] });
    mockFetchRoute('/groups/members/1', { members: [] });
    mockFetchRoute('/groups/members/673', { members: [] });
    mockFetchRoute('/groups/members/694', { members: [{ member: USER, isAdmin: true }] });
    mockFetchRoute('/addresses/', (url) => ({ publicKey: `PK-${url.pathname.split('/').pop()}` }));
    await expect(fetchAdminGroupsMembersPublicKeys()).resolves.toEqual([`PK-${ADMIN}`, `PK-${USER}`]);
  });

  it('derives admin flags from group names and MINTER admin status', async () => {
    mockFetchRoute('/groups/members/694', { members: [{ member: ADMIN, isAdmin: true }] });
    mockFetchRoute('/groups/member/', (url) =>
      url.pathname.endsWith(USER)
        ? [{ groupId: 673, groupName: 'Mintership-Forum-Admins' }]
        : [{ groupId: 694, groupName: 'MINTER' }]
    );
    await expect(getAdminFlags(ADMIN)).resolves.toEqual({
      isForumAdmin: false,
      isMinterAdmin: true,
      isAdmin: true,
    });
    await expect(getAdminFlags(USER)).resolves.toEqual({
      isForumAdmin: true,
      isMinterAdmin: false,
      isAdmin: true,
    });
    await expect(getAdminFlags('')).resolves.toEqual({
      isForumAdmin: false,
      isMinterAdmin: false,
      isAdmin: false,
    });
    await getUserGroups(ADMIN);
    expect(fetchCallsFor('/groups/member/')).toHaveLength(2);
  });

  it('caches invites for 15 s and rethrows failures', async () => {
    mockFetchRoute('/groups/invites/', [{ groupId: 694, inviter: ADMIN, invitee: USER, expiry: 0 }]);
    const invites = await fetchGroupInvitesByAddressCached(USER);
    expect(invites).toHaveLength(1);
    await fetchGroupInvitesByAddressCached(USER);
    expect(fetchCallsFor('/groups/invites/')).toHaveLength(1);
    mockFetchRoute('/groups/invites/', new Response('nope', { status: 500 }));
    await expect(fetchGroupInvitesByAddressCached(USER, true)).rejects.toThrow(/HTTP 500/);
    await expect(fetchGroupInvitesByAddressCached('')).resolves.toEqual([]);
  });

  it('lists groups with the legacy limit', async () => {
    mockFetchRoute('/groups', [{ groupId: 694, groupName: 'MINTER', owner: ADMIN }]);
    await expect(fetchAllGroups()).resolves.toHaveLength(1);
    expect(fetchCallsFor('/groups?')).toEqual(['/groups?limit=2000&reverse=true']);
  });
});
