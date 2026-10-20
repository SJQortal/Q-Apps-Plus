import { describe, expect, it } from 'vitest';
import { readSeenTarget, seenTargetKey, targetMoved, writeSeenTarget } from './seenTarget';

describe('the target this device saw last', () => {
  it('is kept per group under the app’s prefix', () => {
    expect(seenTargetKey(694)).toBe('qmintershipplus-seen-target-694');
    writeSeenTarget({ adminCount: 20, needed: 8, height: 100 }, 694);
    expect(readSeenTarget(694)).toEqual({ adminCount: 20, needed: 8, height: 100 });
    expect(readSeenTarget(42)).toBeNull();
  });

  it('ignores anything malformed, and reads a missing height as unknown', () => {
    const key = seenTargetKey(694);
    window.localStorage.setItem(key, 'not json');
    expect(readSeenTarget(694)).toBeNull();
    window.localStorage.setItem(key, JSON.stringify({ adminCount: '20', needed: 8 }));
    expect(readSeenTarget(694)).toBeNull();
    window.localStorage.setItem(key, JSON.stringify({ adminCount: 20, needed: -1 }));
    expect(readSeenTarget(694)).toBeNull();
    window.localStorage.setItem(key, JSON.stringify({ adminCount: 20, needed: 8 }));
    expect(readSeenTarget(694)).toEqual({ adminCount: 20, needed: 8, height: 0 });
  });

  it('has moved when the admin seats or the target differ, not the tip', () => {
    const a = { adminCount: 20, needed: 8, height: 1 };
    expect(targetMoved(a, { ...a, height: 2 })).toBe(false);
    expect(targetMoved(a, { ...a, adminCount: 19 })).toBe(true);
    expect(targetMoved(a, { ...a, needed: 7 })).toBe(true);
  });
});
