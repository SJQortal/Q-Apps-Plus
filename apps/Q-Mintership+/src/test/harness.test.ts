import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from './setup';

describe('test harness', () => {
  it('answers qortalRequest by action and records the call', async () => {
    mockQortalRequest('GET_USER_ACCOUNT', { address: 'Q1', publicKey: 'pk' });
    await expect(qortalRequest({ action: 'GET_USER_ACCOUNT' })).resolves.toEqual({
      address: 'Q1',
      publicKey: 'pk',
    });
    expect(qortalCallsFor('GET_USER_ACCOUNT')).toHaveLength(1);
  });

  it('rejects unregistered actions so a test can never publish, sign, vote or join', async () => {
    for (const action of [
      'PUBLISH_QDN_RESOURCE',
      'PUBLISH_MULTIPLE_QDN_RESOURCES',
      'SIGN_TRANSACTION',
      'CREATE_POLL',
      'VOTE_ON_POLL',
      'JOIN_GROUP',
      'ENCRYPT_QORTAL_GROUP_DATA',
      'SEND_CHAT_MESSAGE',
    ]) {
      await expect(qortalRequest({ action })).rejects.toThrow(/no handler/);
    }
  });

  it('serves relative Core fetches from routes', async () => {
    mockFetchRoute('/names/', { name: 'bob', owner: 'Q2' });
    const res = await fetch('/names/bob');
    await expect(res.json()).resolves.toEqual({ name: 'bob', owner: 'Q2' });
    expect(fetchCallsFor('/names/')).toEqual(['/names/bob']);
    const missing = await fetch('/blocks/last');
    expect(missing.status).toBe(404);
  });
});
