/**
 * A name's whole history, walked back from its record: through a purchase
 * to the seller, through a rename to the earlier name, down to the
 * registration its record gives; the whole of an owner's name transactions
 * when the first page stops short; one read per owner, GETs only.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { resetQueries } from '../query';
import { fetchCalls, fetchRequests, mockFetchRoute } from '../../test/setup';
import type { TxRow } from '../types';
import { getNameLife } from './nameLife';

const CAT = 'QPqAJUh8MKgmKkigAvu7Rv2Yf4BX6rGLvj';
const SAGE = 'QXKiEnQte9emozqPyaoVfiqVVWpqM4BcLq';

function tx(type: string, height: number, by: string, fields: Partial<TxRow> = {}): TxRow {
  return {
    type,
    signature: `${type}-${height}`,
    timestamp: 1_677_000_000_000 + height,
    txGroupId: 0,
    blockHeight: height,
    creatorAddress: by,
    ...fields,
  } as TxRow;
}

const REGISTER = tx('REGISTER_NAME', 100, SAGE, { name: 'Mapl' });
const RENAME = tx('UPDATE_NAME', 200, SAGE, { name: 'Mapl', newName: 'Maple' });
const SELL = tx('SELL_NAME', 300, SAGE, { name: 'Maple', amount: '5' });
const BUY = tx('BUY_NAME', 400, CAT, { name: 'Maple', seller: SAGE, amount: '5' });
const UPDATE = tx('UPDATE_NAME', 500, CAT, { name: 'Maple', newData: 'caticon' });

function node(rowsOf: Record<string, TxRow[]>, registered = REGISTER.timestamp) {
  mockFetchRoute('/names/', () => ({ name: 'Maple', owner: CAT, registered }));
  mockFetchRoute('/transactions/search', (url: URL) => {
    const rows = rowsOf[url.searchParams.get('address') ?? ''] ?? [];
    const offset = Number(url.searchParams.get('offset') ?? 0);
    return rows.slice(offset, offset + Number(url.searchParams.get('limit')));
  });
}

beforeEach(() => resetQueries());

describe('getNameLife', () => {
  it('walks back through a purchase and a rename to the registration', async () => {
    node({ [CAT]: [UPDATE, BUY], [SAGE]: [BUY, SELL, RENAME, REGISTER] });
    const life = await getNameLife('Maple');
    expect(life?.steps.map((step) => step.signature)).toEqual([
      UPDATE.signature,
      BUY.signature,
      SELL.signature,
      RENAME.signature,
      REGISTER.signature,
    ]);
    expect(life?.owners).toEqual([CAT, SAGE]);
    expect(life?.end).toEqual({ kind: 'registered', tx: REGISTER, matches: true });
    // One read per owner, every one a GET.
    expect(fetchCalls.filter((call) => call.startsWith('/transactions/search'))).toHaveLength(2);
    expect(fetchRequests.every((request) => (request.init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('says when the registration found isn’t the one its record gives', async () => {
    node({ [CAT]: [UPDATE, BUY], [SAGE]: [BUY, SELL, RENAME, REGISTER] }, 1_687_130_078_055);
    expect((await getNameLife('Maple'))?.end).toMatchObject({
      kind: 'registered',
      matches: false,
    });
  });

  it('reads the whole of an owner’s name transactions when the first page stops short', async () => {
    const busy = Array.from({ length: 100 }, (_, i) =>
      tx('REGISTER_NAME', 10_000 - i, CAT, { name: `Spare ${i}` })
    );
    node({ [CAT]: [...busy, UPDATE, BUY], [SAGE]: [BUY, SELL, RENAME, REGISTER] });
    const life = await getNameLife('Maple');
    expect(life?.end).toMatchObject({ kind: 'registered' });
    const cat = fetchCalls.filter((call) => call.includes(`address=${CAT}`));
    expect(cat.some((call) => call.includes('offset=100'))).toBe(true);
  });

  it('stops where an owner’s transactions don’t say how it got the name, and is null with no record', async () => {
    node({ [CAT]: [UPDATE] });
    expect((await getNameLife('Maple'))?.end).toEqual({ kind: 'cut', at: CAT, why: 'notFound' });
    resetQueries();
    mockFetchRoute('/names/', () => new Response('{"error":401}', { status: 404 }));
    expect(await getNameLife('Gone')).toBeNull();
  });
});
