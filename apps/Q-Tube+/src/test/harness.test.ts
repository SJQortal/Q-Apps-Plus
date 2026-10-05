import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from './setup';

describe('test harness', () => {
  it('answers qortalRequest by action and records the call', async () => {
    mockQortalRequest('GET_ACCOUNT_NAMES', [{ name: 'alice' }]);
    await expect(
      qortalRequest({ action: 'GET_ACCOUNT_NAMES', address: 'Q1' })
    ).resolves.toEqual([{ name: 'alice' }]);
    expect(qortalCallsFor('GET_ACCOUNT_NAMES')).toHaveLength(1);
  });

  it('rejects unregistered actions so a test can never publish, send or sign', async () => {
    await expect(
      qortalRequest({ action: 'PUBLISH_QDN_RESOURCE', service: 'DOCUMENT', name: 'x' })
    ).rejects.toThrow(/no handler/);
    await expect(
      qortalRequest({ action: 'SEND_COIN', coin: 'QORT', amount: 1, recipient: 'x' })
    ).rejects.toThrow(/no handler/);
  });

  it('serves relative Core fetches from routes', async () => {
    mockFetchRoute('/arbitrary/resources/search', [{ name: 'bob', identifier: 'qtube_vid_1' }]);
    const res = await fetch('/arbitrary/resources/search?service=DOCUMENT&limit=20');
    await expect(res.json()).resolves.toEqual([{ name: 'bob', identifier: 'qtube_vid_1' }]);
    expect(fetchCallsFor('/arbitrary/resources/search')).toEqual([
      '/arbitrary/resources/search?service=DOCUMENT&limit=20',
    ]);
    const missing = await fetch('/names/nobody');
    expect(missing.status).toBe(404);
  });
});
