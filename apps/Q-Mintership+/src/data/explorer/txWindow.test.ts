import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { resetQueries } from '../query';
import { DEFAULT_FILTERS, dayStart } from '../../rules/explorer/accountTxFilters';
import { inWindow, resolveWindow, windowKeyPart } from './txWindow';

const NOW = new Date(2026, 9, 16, 13, 30, 15).getTime();

beforeEach(() => resetQueries());

describe('resolveWindow', () => {
  it('any time is no window; the last 7 days start 7 days ago, to the minute, with no read', async () => {
    expect(await resolveWindow(DEFAULT_FILTERS, NOW)).toBeNull();
    const week = await resolveWindow({ ...DEFAULT_FILTERS, when: '7d' }, NOW);
    expect(week).toEqual({ fromMs: Math.floor((NOW - 7 * 86_400_000) / 60_000) * 60_000 });
    expect(fetchCallsFor('/blocks')).toEqual([]);
  });

  it('dates run from the first day’s midnight to the end of the last day; a last day of today stays open', async () => {
    const sept = await resolveWindow(
      { ...DEFAULT_FILTERS, when: 'dates', from: '2026-09-01', to: '2026-09-30' },
      NOW
    );
    expect(sept).toEqual({ fromMs: dayStart('2026-09-01'), toMs: dayStart('2026-10-01') });
    expect(
      await resolveWindow(
        { ...DEFAULT_FILTERS, when: 'dates', from: '2026-10-01', to: '2026-10-16' },
        NOW
      )
    ).toEqual({ fromMs: dayStart('2026-10-01') });
    expect(await resolveWindow({ ...DEFAULT_FILTERS, when: 'dates' }, NOW)).toBeNull();
  });

  it('blocks are kept exact, and found by their times, a day wider before and an hour after', async () => {
    mockFetchRoute('/blocks/last', { height: 2_761_000, timestamp: NOW });
    mockFetchRoute(/^\/blocks\/byheight\/\d+$/, (url: URL) => {
      const h = Number(url.pathname.split('/').pop());
      return { height: h, timestamp: h * 60_000 };
    });
    const w = await resolveWindow(
      { ...DEFAULT_FILTERS, when: 'blocks', from: '2700000', to: '2700100' },
      NOW
    );
    expect(w).toEqual({
      fromBlock: 2_700_000,
      toBlock: 2_700_100,
      fromMs: 2_700_000 * 60_000 - 86_400_000,
      toMs: 2_700_100 * 60_000 + 3_600_000,
    });
    // Past the tip: nothing can be there; up to the tip: open at the end.
    expect(await resolveWindow({ ...DEFAULT_FILTERS, when: 'blocks', from: '2800000' }, NOW)).toBe(
      'empty'
    );
    expect(
      await resolveWindow(
        { ...DEFAULT_FILTERS, when: 'blocks', from: '2760000', to: '2900000' },
        NOW
      )
    ).toEqual({ fromBlock: 2_760_000, fromMs: 2_760_000 * 60_000 - 86_400_000 });
  });
});

describe('inWindow and its key', () => {
  it('matches by time, or by block when blocks were picked', () => {
    expect(inWindow({ timestamp: 5 }, { fromMs: 5, toMs: 6 })).toBe(true);
    expect(inWindow({ timestamp: 6 }, { fromMs: 5, toMs: 6 })).toBe(false);
    expect(
      inWindow({ timestamp: 1, blockHeight: 10 }, { fromBlock: 10, toBlock: 10, fromMs: 0 })
    ).toBe(true);
    expect(inWindow({ timestamp: 1, blockHeight: 11 }, { fromBlock: 10, toBlock: 10 })).toBe(false);
    expect(windowKeyPart(null)).toBe('');
    expect(windowKeyPart({ fromMs: 1 })).toBe(':t1-');
    expect(windowKeyPart({ fromBlock: 3, toBlock: 4, fromMs: 1, toMs: 2 })).toBe(':t1-2:b3-4');
  });
});
