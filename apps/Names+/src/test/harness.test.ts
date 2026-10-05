import { describe, expect, it } from 'vitest';
import {
  fetchCallsFor,
  mockFetchRoute,
  mockQortalRequest,
  qortalCallsFor,
} from './setup';

describe('test harness', () => {
  it('answers qortalRequest by action and records the call', async () => {
    mockQortalRequest('GET_PRIMARY_NAME', 'alice');
    await expect(qortalRequest({ action: 'GET_PRIMARY_NAME', address: 'Q1' })).resolves.toBe(
      'alice'
    );
    expect(qortalCallsFor('GET_PRIMARY_NAME')).toHaveLength(1);
  });

  it('rejects unregistered actions so a test can never publish or spend', async () => {
    await expect(qortalRequest({ action: 'REGISTER_NAME', name: 'x' })).rejects.toThrow(
      /no handler/
    );
  });

  it('serves relative Core fetches from routes', async () => {
    mockFetchRoute('/names/forsale', [{ name: 'bob', salePrice: 5 }]);
    const res = await fetch('/names/forsale?limit=20');
    await expect(res.json()).resolves.toEqual([{ name: 'bob', salePrice: 5 }]);
    expect(fetchCallsFor('/names/forsale')).toEqual(['/names/forsale?limit=20']);
    const missing = await fetch('/names/nobody');
    expect(missing.status).toBe(404);
  });
});
