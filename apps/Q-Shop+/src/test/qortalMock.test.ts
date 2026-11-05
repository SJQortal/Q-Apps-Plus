import { describe, expect, it } from 'vitest';
import { installQortalMock } from './qortalMock';

describe('qortalRequest mock', () => {
  it('answers by action and records calls', async () => {
    const q = installQortalMock({ GET_USER_ACCOUNT: async () => ({ address: 'Qabc', publicKey: 'pk' }) });
    await expect(qortalRequest({ action: 'GET_USER_ACCOUNT' })).resolves.toEqual({ address: 'Qabc', publicKey: 'pk' });
    await expect(qortalRequest({ action: 'GET_NAME_DATA', name: 'x' })).resolves.toBeNull();
    expect(q.callsFor('GET_USER_ACCOUNT')).toHaveLength(1);
    expect(q.calls).toHaveLength(2);
  });

  it('refuses write actions that have no handler, so tests never publish or spend', async () => {
    installQortalMock();
    await expect(qortalRequest({ action: 'SEND_COIN', coin: 'QORT', amount: 1 })).rejects.toThrow(/SEND_COIN/);
    await expect(qortalRequest({ action: 'PUBLISH_QDN_RESOURCE' })).rejects.toThrow(/PUBLISH_QDN_RESOURCE/);
  });
});
