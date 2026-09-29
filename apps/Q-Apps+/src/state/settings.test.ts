import { describe, expect, it } from 'vitest';
import { MAX_RECENT, pushRecent, toggleFavourite } from './settings';

describe('recently opened', () => {
  it('keeps newest first, one entry per app, capped', () => {
    let list = pushRecent([], 'A+', 1);
    list = pushRecent(list, 'B+', 2);
    list = pushRecent(list, 'A+', 3);
    expect(list.map((e) => e.name)).toEqual(['A+', 'B+']);
    expect(list[0].at).toBe(3);
    for (let i = 0; i < MAX_RECENT + 3; i += 1) list = pushRecent(list, `X${i}+`, 10 + i);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].name).toBe(`X${MAX_RECENT + 2}+`);
  });
});

describe('favourites', () => {
  it('toggles membership', () => {
    expect(toggleFavourite([], 'A+')).toEqual(['A+']);
    expect(toggleFavourite(['A+', 'B+'], 'A+')).toEqual(['B+']);
  });
});
