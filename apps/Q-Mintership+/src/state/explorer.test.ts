import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultStore } from 'jotai';
import {
  addPick,
  cameFromExplorer,
  clearPicks,
  clearRecent,
  COMPARE_FULL,
  COMPARE_MAX,
  comparePicksAtom,
  nameMatchOf,
  nextTrail,
  openInTrail,
  readRecent,
  RECENT_KEY,
  RECENT_MAX,
  recentAtom,
  recordRecent,
  rememberExplorations,
  removePick,
  resetExplorerState,
  togglePick,
  TRAIL_MAX,
  trailAtom,
} from './explorer';
import { SETTINGS_KEYS } from './settings';

const store = getDefaultStore();
/** A valid-looking address per letter: QAAA…, QBBB…, and so on. */
const addr = (c: string) => `Q${c.repeat(33)}`;
const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map(addr);

beforeEach(() => resetExplorerState());
afterEach(() => vi.restoreAllMocks());

describe('the trail', () => {
  it('starts a new trail for an account opened from outside the Explorer', () => {
    expect(nextTrail([A, B], C, false)).toEqual([C]);
    expect(nextTrail([], A, false)).toEqual([A]);
  });

  it('adds a crumb for an account reached by an Explorer link', () => {
    expect(nextTrail([A, B], C, true)).toEqual([A, B, C]);
    expect(nextTrail([], A, true)).toEqual([A]);
  });

  it('goes back to an account already in the trail, cutting what came after it', () => {
    expect(nextTrail([A, B, C, D], B, true)).toEqual([A, B]);
    expect(nextTrail([A, B, C, D], B, false)).toEqual([A, B]);
    // The one on screen again (a tab switch, a refresh): unchanged, the same list.
    const trail = [A, B];
    expect(nextTrail(trail, B, false)).toBe(trail);
  });

  it(`keeps the newest ${TRAIL_MAX}`, () => {
    let trail: string[] = [];
    const many = Array.from({ length: 25 }, (_, i) => `Q${String(i).padStart(2, '0')}`);
    for (const a of many) trail = nextTrail(trail, a, true);
    expect(trail).toHaveLength(TRAIL_MAX);
    expect(trail[0]).toBe(many[5]);
    expect(trail.at(-1)).toBe(many[24]);
  });

  it('is kept in the session store as accounts open', () => {
    openInTrail(A, false);
    openInTrail(B, true);
    openInTrail(C, true);
    expect(store.get(trailAtom)).toEqual([A, B, C]);
    openInTrail(A, true);
    expect(store.get(trailAtom)).toEqual([A]);
  });

  it('knows an Explorer link by its router state', () => {
    expect(cameFromExplorer({ via: 'explorer' })).toBe(true);
    expect(cameFromExplorer({ via: 'history' })).toBe(false);
    expect(cameFromExplorer(null)).toBe(false);
    expect(cameFromExplorer(undefined)).toBe(false);
  });

  it('reads the name an account was opened from', () => {
    expect(nameMatchOf({ viaName: 'T00LS', matched: 'Tools' })).toEqual({
      viaName: 'T00LS',
      matched: 'Tools',
    });
    expect(nameMatchOf({ viaName: 'Q-Maps', via: 'explorer' })).toEqual({
      viaName: 'Q-Maps',
      matched: 'Q-Maps',
    });
    expect(nameMatchOf({ via: 'explorer' })).toBeNull();
    expect(nameMatchOf({ viaName: '' })).toBeNull();
    expect(nameMatchOf('Q-Maps')).toBeNull();
    expect(nameMatchOf(null)).toBeNull();
  });
});

describe('compare picks', () => {
  it(`holds up to ${COMPARE_MAX} accounts and refuses a 5th`, () => {
    expect([A, B, C, D].map(addPick)).toEqual(['added', 'added', 'added', 'added']);
    expect(addPick(E)).toBe('full');
    expect(store.get(comparePicksAtom)).toEqual([A, B, C, D]);
    expect(COMPARE_FULL).toBe('Compare holds 4 accounts. Remove one first.');
    expect(addPick(A)).toBe('already');
  });

  it('toggles, removes and clears', () => {
    expect(togglePick(A)).toBe('added');
    expect(togglePick(B)).toBe('added');
    expect(togglePick(A)).toBe('removed');
    expect(store.get(comparePicksAtom)).toEqual([B]);
    removePick(C);
    expect(store.get(comparePicksAtom)).toEqual([B]);
    for (const a of [A, C, D]) togglePick(a);
    expect(togglePick(E)).toBe('full');
    clearPicks();
    expect(store.get(comparePicksAtom)).toEqual([]);
  });
});

describe('recent explorations', () => {
  it('remembers addresses only, newest first, at most 8, under the app’s prefix', () => {
    expect(RECENT_KEY).toBe('qmintershipplus-explorer-recent');
    const many = 'abcdefghij'.split('').map(addr);
    for (const a of many) recordRecent(a);
    recordRecent(many[3]);
    const expected = [
      many[3],
      ...many
        .slice(2)
        .reverse()
        .filter((a) => a !== many[3]),
    ].slice(0, RECENT_MAX);
    expect(store.get(recentAtom)).toEqual(expected);
    expect(JSON.parse(window.localStorage.getItem(RECENT_KEY) as string)).toEqual(expected);
    // Anything that isn't an address is never written.
    recordRecent('Simon James');
    expect(store.get(recentAtom)).toEqual(expected);
  });

  it('writes nothing while the setting is off (on by default)', () => {
    expect(rememberExplorations()).toBe(true);
    window.localStorage.setItem(SETTINGS_KEYS.explorerRemember, 'false');
    expect(rememberExplorations()).toBe(false);
    recordRecent(A);
    expect(store.get(recentAtom)).toEqual([]);
    expect(window.localStorage.getItem(RECENT_KEY)).toBeNull();
    window.localStorage.setItem(SETTINGS_KEYS.explorerRemember, 'true');
    recordRecent(A);
    expect(store.get(recentAtom)).toEqual([A]);
  });

  it('Clear forgets them on this device', () => {
    recordRecent(A);
    recordRecent(B);
    clearRecent();
    expect(store.get(recentAtom)).toEqual([]);
    expect(window.localStorage.getItem(RECENT_KEY)).toBeNull();
  });

  it('reads back what this device kept, and ignores anything else', () => {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify([B, 'not an address', 7, A]));
    expect(readRecent()).toEqual([B, A]);
    window.localStorage.setItem(RECENT_KEY, '{broken');
    expect(readRecent()).toEqual([]);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify({ a: 1 }));
    expect(readRecent()).toEqual([]);
  });

  it('keeps working when storage throws (a private window, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readRecent()).toEqual([]);
    // Nothing can be remembered where the setting can't be read.
    expect(rememberExplorations()).toBe(false);
    expect(() => recordRecent(A)).not.toThrow();
    expect(store.get(recentAtom)).toEqual([]);
    expect(() => clearRecent()).not.toThrow();
  });

  it('keeps the list for the session when only writing fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => recordRecent(A)).not.toThrow();
    expect(store.get(recentAtom)).toEqual([A]);
  });
});
