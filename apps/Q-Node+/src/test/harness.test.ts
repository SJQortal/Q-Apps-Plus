import { describe, expect, it } from 'vitest';
import {
  fetchCallsFor,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from './setup';

describe('test harness', () => {
  it('answers qortalRequest by action and records the call', async () => {
    mockQortalRequest('GET_NODE_STATUS', { height: 5 });
    await expect(
      qortalRequest({ action: 'GET_NODE_STATUS', address: 'Q1' })
    ).resolves.toEqual({ height: 5 });
    expect(qortalCallsFor('GET_NODE_STATUS')).toHaveLength(1);
  });

  it('rejects unregistered actions so a test can never touch the node', async () => {
    await expect(
      qortalRequest({ action: 'ADMIN_ACTION', type: 'stop' })
    ).rejects.toThrow(/no handler/);
  });

  it('serves relative Core fetches from routes', async () => {
    mockFetchRoute('/peers', [{ address: '1.2.3.4:12392' }]);
    const res = await fetch('/peers?limit=20');
    await expect(res.json()).resolves.toEqual([{ address: '1.2.3.4:12392' }]);
    expect(fetchCallsFor('/peers')).toEqual(['/peers?limit=20']);
    const missing = await fetch('/admin/nobody');
    expect(missing.status).toBe(404);
  });
});
