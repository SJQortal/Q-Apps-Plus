import { describe, expect, it } from 'vitest';
import type { TxRow } from '../types';
import { atRowsOf } from './portalTrades';

const ME = `Q${'m'.repeat(33)}`;
const row = (over: Partial<TxRow>): TxRow => ({
  type: 'DEPLOY_AT',
  timestamp: 1_000,
  signature: `s${Math.random()}`,
  txGroupId: 0,
  creatorAddress: ME,
  ...over,
});

describe('the trade offers among an account’s rows', () => {
  it('keeps its own trade contracts, with their coin and QORT, newest first', () => {
    const { deployed, paidBack, truncated } = atRowsOf(
      [
        row({ aTAddress: 'A1', aTType: 'ACCT', tags: 'ACCT QORT LTC', amount: '500.00100000' }),
        row({ aTAddress: 'A2', tags: 'ACCT QORT DOGE', amount: '12', timestamp: 2_000 }),
        // Not a trade contract, and not its own.
        row({ aTAddress: 'A3', aTType: 'LOTTERY', tags: 'game' }),
        row({ aTAddress: 'A4', aTType: 'ACCT', creatorAddress: `Q${'o'.repeat(33)}` }),
        // Payouts to it, and one to someone else.
        row({ type: 'AT', atAddress: 'A1', recipient: ME, amount: '0.00099463' }),
        row({ type: 'AT', atAddress: 'A7', recipient: ME, amount: '45' }),
        row({ type: 'AT', atAddress: 'A8', recipient: `Q${'o'.repeat(33)}`, amount: '1' }),
      ],
      ME,
      true
    );
    expect(deployed).toEqual([
      { at: 'A2', chain: 'DOGECOIN', qort: 1_200_000_000n, timestamp: 2_000 },
      { at: 'A1', chain: 'LITECOIN', qort: 50_000_100_000n, timestamp: 1_000 },
    ]);
    expect(paidBack).toEqual(['A1', 'A7']);
    expect(truncated).toBe(true);
  });
});
