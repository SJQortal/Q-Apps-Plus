import { describe, expect, it } from 'vitest';
import { fetchCallsFor } from '../test/setup';
import { TIP, installWorld } from '../test/world';
import { addTargetShift } from '../../e2e/world.mjs';
import { ADMIN_CHANGES_MAX_WINDOWS, loadAdminChangesBetween } from './targetChanges';

describe('loadAdminChangesBetween', () => {
  it('reads the approved admin changes since a block, in one bounded search', async () => {
    const { world } = installWorld('admin');
    const shift = addTargetShift(world);
    const result = await loadAdminChangesBetween(TIP - 100, TIP, 10_080);
    expect(result.complete).toBe(true);
    expect(result.changes.map((c) => [c.signature, c.added])).toEqual([
      [shift.removed[0], false],
      [shift.removed[1], false],
    ]);
    const searches = fetchCallsFor('/transactions/search');
    expect(searches).toHaveLength(1);
    const params = new URL(searches[0], 'http://x').searchParams;
    expect(params.getAll('txType').sort()).toEqual(['ADD_GROUP_ADMIN', 'REMOVE_GROUP_ADMIN']);
    expect(Number(params.get('startBlock'))).toBe(TIP - 100 - 10_080);
    expect(Number(params.get('limit'))).toBeGreaterThan(0);
  });

  it('leaves out changes applied before the block, and caches the answer', async () => {
    const { world } = installWorld('admin');
    addTargetShift(world);
    const result = await loadAdminChangesBetween(TIP - 30, TIP, 10_080);
    expect(result.changes).toHaveLength(1);
    await loadAdminChangesBetween(TIP - 30, TIP, 10_080);
    expect(fetchCallsFor('/transactions/search')).toHaveLength(1);
  });

  it('never reaches back further than five approval windows, and says it is incomplete', async () => {
    installWorld('admin');
    const result = await loadAdminChangesBetween(1, TIP, 10_080);
    expect(result.complete).toBe(false);
    const params = new URL(fetchCallsFor('/transactions/search')[0], 'http://x').searchParams;
    expect(Number(params.get('startBlock'))).toBe(TIP - ADMIN_CHANGES_MAX_WINDOWS * 10_080);
  });
});
