import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCallsFor,
  fetchRequests,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from '../test/setup';
import { resetAccountCaches } from './account';
import {
  createAddGroupAdminTransaction,
  createGroupApprovalTransaction,
  createGroupBanTransaction,
  createGroupInviteTransaction,
  createGroupJoinTransaction,
  createGroupKickTransaction,
  createRemoveGroupAdminTransaction,
  getLatestBlockInfo,
  joinGroup,
  processTransaction,
  searchPendingTransactions,
  searchTransactions,
  signAndProcess,
  signTransaction,
} from './transactions';

const ADMIN = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG';
const NOMINEE = 'QNomiUy6sUiEnaN87dWmE92g1uQjrvPgrWX';

function postedBody(path: string): Record<string, unknown> {
  const request = fetchRequests.find((r) => r.path === path);
  if (!request) throw new Error(`no POST to ${path}`);
  return JSON.parse(String(request.init?.body)) as Record<string, unknown>;
}

beforeEach(() => {
  resetAccountCaches();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(1_700_000_000_000));
  mockFetchRoute('/addresses/convert/', ADMIN);
  mockFetchRoute('/addresses/', (url) => ({
    address: url.pathname.split('/').pop(),
    reference: `ref-${url.pathname.split('/').pop()}`,
    publicKey: 'PK-ADMIN',
  }));
  for (const path of ['/groups/invite', '/groups/kick', '/groups/ban', '/groups/addadmin', '/groups/removeadmin', '/groups/approval', '/groups/join']) {
    mockFetchRoute(path, 'RAWTX');
  }
});
afterEach(() => vi.useRealTimers());

describe('transaction builders post the exact legacy payloads', () => {
  it('GROUP_INVITE', async () => {
    await expect(
      createGroupInviteTransaction({ recipientAddress: ADMIN, adminPublicKey: 'PK-ADMIN', invitee: NOMINEE, fee: 0.01, txGroupId: 694 })
    ).resolves.toBe('RAWTX');
    expect(postedBody('/groups/invite')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${ADMIN}`,
      fee: 0.01,
      txGroupId: 694,
      recipient: null,
      adminPublicKey: 'PK-ADMIN',
      groupId: 694,
      invitee: NOMINEE,
      timeToLive: 0,
    });
    const request = fetchRequests.find((r) => r.path === '/groups/invite');
    expect(request?.init?.method).toBe('POST');
    expect(request?.init?.headers).toEqual({ Accept: 'text/plain', 'Content-Type': 'application/json' });
  });

  it('GROUP_INVITE defaults invitee to the recipient and txGroupId to 0', async () => {
    await createGroupInviteTransaction({ recipientAddress: ADMIN, adminPublicKey: 'PK-ADMIN', fee: 0.01 });
    expect(postedBody('/groups/invite')).toMatchObject({ invitee: ADMIN, txGroupId: 0 });
  });

  it('GROUP_KICK with legacy defaults', async () => {
    await createGroupKickTransaction({ adminPublicKey: 'PK-ADMIN', member: NOMINEE });
    expect(postedBody('/groups/kick')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${ADMIN}`,
      fee: 0.01,
      txGroupId: 694,
      adminPublicKey: 'PK-ADMIN',
      groupId: 694,
      member: NOMINEE,
      reason: 'Kicked by admins',
    });
  });

  it('GROUP_BAN', async () => {
    await createGroupBanTransaction({ adminPublicKey: 'PK-ADMIN', offender: NOMINEE, txGroupId: 694, fee: 0.01 });
    expect(postedBody('/groups/ban')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${ADMIN}`,
      fee: 0.01,
      txGroupId: 694,
      adminPublicKey: 'PK-ADMIN',
      groupId: 694,
      offender: NOMINEE,
      reason: 'Banned by admins',
    });
  });

  it('ADD_GROUP_ADMIN and REMOVE_GROUP_ADMIN, with a given key or from the user address', async () => {
    await createAddGroupAdminTransaction({ ownerPublicKey: 'PK-ADMIN', member: NOMINEE, txGroupId: 694, fee: 0.01 });
    expect(postedBody('/groups/addadmin')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${ADMIN}`,
      fee: 0.01,
      txGroupId: 694,
      ownerPublicKey: 'PK-ADMIN',
      groupId: 694,
      member: NOMINEE,
    });
    await createRemoveGroupAdminTransaction({ userAddress: ADMIN, admin: NOMINEE, txGroupId: 694, fee: 0.01 });
    expect(postedBody('/groups/removeadmin')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${ADMIN}`,
      fee: 0.01,
      txGroupId: 694,
      ownerPublicKey: 'PK-ADMIN',
      groupId: 694,
      admin: NOMINEE,
    });
    await expect(createAddGroupAdminTransaction({ member: NOMINEE, fee: 0.01 })).rejects.toThrow(/required/);
  });

  it('GROUP_APPROVAL always approves', async () => {
    await createGroupApprovalTransaction({ adminPublicKey: 'PK-ADMIN', pendingSignature: 'SIG', txGroupId: 694 });
    expect(postedBody('/groups/approval')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${ADMIN}`,
      fee: 0.01,
      txGroupId: 694,
      adminPublicKey: 'PK-ADMIN',
      pendingSignature: 'SIG',
      approval: true,
    });
  });

  it('GROUP_JOIN', async () => {
    await createGroupJoinTransaction({ recipientAddress: NOMINEE, joinerPublicKey: 'PK-NOM', groupId: 694, fee: 0.01 });
    expect(postedBody('/groups/join')).toEqual({
      timestamp: 1_700_000_000_000,
      reference: `ref-${NOMINEE}`,
      fee: 0.01,
      txGroupId: 0,
      joinerPublicKey: 'PK-NOM',
      groupId: 694,
    });
  });

  it('fails clearly when Core rejects the payload', async () => {
    mockFetchRoute('/groups/invite', new Response('bad reference', { status: 400 }));
    await expect(
      createGroupInviteTransaction({ recipientAddress: ADMIN, adminPublicKey: 'PK-ADMIN', fee: 0.01 })
    ).rejects.toThrow('Failed to create transaction: 400, bad reference');
  });
});

describe('sign and process', () => {
  it('signs through the mocked bridge and posts to /transactions/process with API version 2', async () => {
    mockQortalRequest('SIGN_TRANSACTION', 'SIGNED');
    mockFetchRoute('/transactions/process', '{"type":"GROUP_INVITE","signature":"s"}');
    await expect(signAndProcess('RAWTX')).resolves.toEqual({ type: 'GROUP_INVITE', signature: 's' });
    expect(qortalCallsFor('SIGN_TRANSACTION')).toEqual([{ action: 'SIGN_TRANSACTION', unsignedBytes: 'RAWTX' }]);
    const request = fetchRequests.find((r) => r.path === '/transactions/process');
    expect(request?.init).toMatchObject({
      method: 'POST',
      body: 'SIGNED',
      headers: { Accept: 'text/plain', 'X-API-VERSION': '2', 'Content-Type': 'text/plain' },
    });
  });

  it('throws when the user cancels signing', async () => {
    mockQortalRequest('SIGN_TRANSACTION', null);
    await expect(signTransaction('RAWTX')).rejects.toThrow(/canceled/);
  });

  it('returns raw text when process answers with something that is not JSON', async () => {
    mockFetchRoute('/transactions/process', 'ok');
    await expect(processTransaction('SIGNED')).resolves.toBe('ok');
    mockFetchRoute('/transactions/process', new Response('INVALID', { status: 400 }));
    await expect(processTransaction('SIGNED')).rejects.toThrow('Transaction processing failed: INVALID');
  });

  it('JOIN_GROUP goes through the bridge with the group id', async () => {
    mockQortalRequest('JOIN_GROUP', { signature: 'j' });
    await joinGroup(694);
    expect(qortalCallsFor('JOIN_GROUP')).toEqual([{ action: 'JOIN_GROUP', groupId: 694 }]);
  });
});

describe('block and transaction reads', () => {
  it('normalises /blocks/last', async () => {
    mockFetchRoute('/blocks/last', { height: 10, minterAddress: ADMIN });
    const block = await getLatestBlockInfo();
    expect(block).toMatchObject({ height: 10, minterAddress: ADMIN, totalFees: '0', version: 0 });
    mockFetchRoute('/blocks/last', new Response('x', { status: 500 }));
    await expect(getLatestBlockInfo()).resolves.toBeNull();
  });

  it('builds the legacy /transactions/search query', async () => {
    mockFetchRoute('/transactions/search', [{ type: 'GROUP_INVITE', timestamp: 1, reference: 'r', signature: 's' }]);
    await searchTransactions({ txTypes: ['GROUP_INVITE', 'GROUP_APPROVAL'], address: ADMIN, txGroupId: 694, limit: 50, offset: 10 });
    expect(fetchCallsFor('/transactions/search')).toEqual([
      `/transactions/search?txType=GROUP_INVITE&txType=GROUP_APPROVAL&txGroupId=694&address=${ADMIN}&confirmationStatus=CONFIRMED&limit=50&reverse=true&offset=10`,
    ]);
    mockFetchRoute('/transactions/search', { not: 'an array' });
    await expect(searchTransactions()).rejects.toThrow(/array/);
  });

  it('reads pending transactions', async () => {
    mockFetchRoute('/transactions/pending', []);
    await expect(searchPendingTransactions(20, 0, false)).resolves.toEqual([]);
    expect(fetchCallsFor('/transactions/pending')).toEqual(['/transactions/pending?limit=20&offset=0&reverse=false']);
  });
});
