import { describe, expect, it } from 'vitest';
import { isBottomBarLayout, isBottomNavShown } from './useBottomNav';

describe('the phone bottom bar', () => {
  it('is on screen in a portrait phone frame', () => {
    expect(isBottomNavShown({ phone: true, landscape: false, short: false })).toBe(true);
  });

  it('steps aside while the keyboard is open (a short portrait frame), keeping the layout', () => {
    const typing = { phone: true, landscape: false, short: true };
    expect(isBottomNavShown(typing)).toBe(false);
    // Still the bottom-bar layout: the rail doesn't come back while typing.
    expect(isBottomBarLayout(typing)).toBe(true);
  });

  it('is never shown with the rail (landscape or wide)', () => {
    expect(isBottomNavShown({ phone: true, landscape: true, short: true })).toBe(false);
    expect(isBottomNavShown({ phone: false, landscape: false, short: false })).toBe(false);
    expect(isBottomBarLayout({ phone: true, landscape: true, short: true })).toBe(false);
  });
});
