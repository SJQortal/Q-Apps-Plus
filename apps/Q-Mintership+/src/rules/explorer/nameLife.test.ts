/**
 * One step back in a name's life: what its owner did with it, down to how
 * it got it (registered, bought, renamed from an earlier name), nothing at
 * or after the point the walk came from, and a stop where the rows don't
 * fit together.
 */
import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../data/types';
import { CHAIN_NOW, ownerSpan, positionOf } from './nameLife';

const LEO = 'QLeo';
const ADA = 'QAda';

function tx(type: string, height: number, fields: Partial<TxRow> = {}): TxRow {
  return {
    type,
    signature: `${type}-${height}`,
    timestamp: 1_700_000_000_000 + height * 60_000,
    txGroupId: 0,
    blockHeight: height,
    creatorAddress: LEO,
    ...fields,
  } as TxRow;
}

const kinds = (rows: TxRow[]) => rows.map((row) => row.signature);

describe('ownerSpan', () => {
  it('goes back to the registration, with what was done in between', () => {
    const rows = [
      tx('UPDATE_NAME', 30, { name: 'Maple', newData: 'new' }),
      tx('SELL_NAME', 20, { name: 'Maple', amount: '5' }),
      tx('CANCEL_SELL_NAME', 25, { name: 'Maple' }),
      tx('REGISTER_NAME', 10, { name: 'Maple' }),
      tx('REGISTER_NAME', 5, { name: 'Other' }),
    ];
    const span = ownerSpan(rows, LEO, 'Maple', CHAIN_NOW);
    expect(kinds(span.steps)).toEqual([
      'UPDATE_NAME-30',
      'CANCEL_SELL_NAME-25',
      'SELL_NAME-20',
      'REGISTER_NAME-10',
    ]);
    expect(span.got).toMatchObject({ kind: 'registered' });
  });

  it('stops at a purchase, naming the seller, and leaves out what came at or after the point given', () => {
    const buy = tx('BUY_NAME', 40, { name: 'Maple', seller: ADA, amount: '5' });
    const rows = [tx('UPDATE_NAME', 50, { name: 'Maple', newData: 'x' }), buy];
    expect(ownerSpan(rows, LEO, 'Maple', CHAIN_NOW).got).toEqual({
      kind: 'bought',
      tx: buy,
      seller: ADA,
    });
    // From the update on: only the purchase before it.
    const span = ownerSpan(rows, LEO, 'Maple', positionOf(rows[0]));
    expect(kinds(span.steps)).toEqual(['BUY_NAME-40']);
  });

  it('follows a rename back to the earlier name', () => {
    const rename = tx('UPDATE_NAME', 40, { name: 'Mapl', newName: 'Maple' });
    const span = ownerSpan([rename], LEO, 'Maple', CHAIN_NOW);
    expect(span.got).toEqual({ kind: 'renamed', tx: rename, from: 'Mapl' });
  });

  it('stops where the rows don’t fit together, or when they say nothing of how it got it', () => {
    // Ada bought it from Leo, and nothing shows Leo got it again since.
    const sold = tx('BUY_NAME', 40, { name: 'Maple', seller: LEO, creatorAddress: ADA });
    expect(ownerSpan([sold], LEO, 'Maple', CHAIN_NOW).got).toEqual({ kind: 'notFound' });
    // Renamed away before it was got.
    const away = tx('UPDATE_NAME', 40, { name: 'Maple', newName: 'Birch' });
    expect(ownerSpan([away], LEO, 'Maple', CHAIN_NOW)).toEqual({
      steps: [],
      got: { kind: 'notFound' },
    });
    expect(ownerSpan([], LEO, 'Maple', CHAIN_NOW).got).toEqual({ kind: 'notFound' });
  });
});
