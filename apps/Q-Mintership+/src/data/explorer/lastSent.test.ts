import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { peekQuery, queryLoadCounts, resetQueries } from '../query';
import { getLastSent, lastSentKey } from './lastSent';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const PK = '9FvNoo1GnEGDmE9KEpueY2UgaC4BwLaZr4EJFf6pzJpA';

beforeEach(() => resetQueries());

describe('getLastSent', () => {
  it('reads the newest confirmed own transaction by public key, one row', async () => {
    mockFetchRoute(`/transactions/creator/${PK}`, [
      { type: 'PAYMENT', blockHeight: 2_757_000, timestamp: 1_791_000_000_000, signature: 's1' },
    ]);
    await expect(getLastSent(A, PK)).resolves.toEqual({
      type: 'PAYMENT',
      height: 2_757_000,
      timestamp: 1_791_000_000_000,
      signature: 's1',
    });
    expect(fetchCallsFor('/transactions/creator/')).toEqual([
      `/transactions/creator/${PK}?confirmationStatus=CONFIRMED&limit=1&reverse=true`,
    ]);
    // Cached by address, for the Overview and Refresh.
    expect(peekQuery(lastSentKey(A))).toMatchObject({ height: 2_757_000 });
    expect(lastSentKey(A)).toBe(`xlastsent:${A}`);
    await getLastSent(A, PK);
    expect(queryLoadCounts().xlastsent).toBe(1);
  });

  it('is null when Core has no confirmed own transaction', async () => {
    mockFetchRoute(`/transactions/creator/${PK}`, []);
    await expect(getLastSent(A, PK)).resolves.toBeNull();
  });
});
