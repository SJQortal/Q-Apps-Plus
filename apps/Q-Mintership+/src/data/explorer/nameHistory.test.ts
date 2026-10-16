import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { resetQueries } from '../query';
import { heavyLoad } from './heavy';
import { getNameHistory, NAME_HISTORY_LIMIT, nameHistoryKey } from './nameHistory';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';

const row = (n: number) => ({
  type: 'REGISTER_NAME',
  signature: `sig${n}`,
  timestamp: 1_000 + n,
  blockHeight: 100 + n,
  txGroupId: 0,
  name: `name ${n}`,
});

beforeEach(() => resetQueries());

describe('getNameHistory', () => {
  it('reads one page of the five name types for the account, newest first', async () => {
    mockFetchRoute('/transactions/search', [row(2), row(1)]);
    const history = await getNameHistory(A);
    expect(history.rows.map((r) => r.signature)).toEqual(['sig2', 'sig1']);
    expect(history.capped).toBe(false);
    expect(fetchCallsFor('/transactions/search')).toEqual([
      `/transactions/search?address=${A}&txType=REGISTER_NAME&txType=UPDATE_NAME&txType=SELL_NAME&txType=CANCEL_SELL_NAME&txType=BUY_NAME&confirmationStatus=CONFIRMED&limit=100&reverse=true`,
    ]);
    expect(nameHistoryKey(A)).toBe(`xnamehist:${A}`);
    // A heavy read: through the limiter, which is idle again.
    expect(heavyLoad()).toEqual({ running: 0, queued: 0 });
  });

  it('says when the page was full', async () => {
    mockFetchRoute(
      '/transactions/search',
      Array.from({ length: NAME_HISTORY_LIMIT }, (_, i) => row(i))
    );
    expect((await getNameHistory(A)).capped).toBe(true);
  });
});
