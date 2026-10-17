import { describe, expect, it } from 'vitest';
import {
  decisionsViewPath,
  defaultDecisionsView,
  nominationsRedirect,
  parseDecisionsView,
} from './decisionsViews';

describe('Decisions’ tabs in the address', () => {
  it('reads ?show=, and nothing else, as a tab', () => {
    expect(parseDecisionsView('decisions')).toBe('decisions');
    expect(parseDecisionsView('nominations')).toBe('nominations');
    expect(parseDecisionsView('ready')).toBe('ready');
    expect(parseDecisionsView(null)).toBeNull();
    expect(parseDecisionsView('waiting')).toBeNull();
  });

  it('opens a Minter Admin on Decisions and everyone else on Nominations', () => {
    expect(defaultDecisionsView(true)).toBe('decisions');
    expect(defaultDecisionsView(false)).toBe('nominations');
  });

  it('builds each tab’s address, with a nomination state on Nominations only', () => {
    expect(decisionsViewPath('decisions')).toBe('/decisions?show=decisions');
    expect(decisionsViewPath('nominations')).toBe('/decisions?show=nominations');
    expect(decisionsViewPath('nominations', 'waiting')).toBe(
      '/decisions?show=nominations&state=waiting'
    );
    expect(decisionsViewPath('ready', 'waiting')).toBe('/decisions?show=ready');
  });

  it('opens the old Nominations page’s links on the same tab and state', () => {
    expect(nominationsRedirect('')).toBe('/decisions?show=nominations');
    expect(nominationsRedirect('?show=ready')).toBe('/decisions?show=ready');
    expect(nominationsRedirect('?show=signing')).toBe('/decisions?show=nominations&state=signing');
    expect(nominationsRedirect('?show=nonsense')).toBe('/decisions?show=nominations');
    // A query Hub appended to the app's own is not the app's.
    expect(nominationsRedirect('?show=ready?theme=dark')).toBe('/decisions?show=ready');
    // The rest of the query comes along: Ready to mint's order.
    expect(nominationsRedirect('?show=ready&sort=date')).toBe('/decisions?show=ready&sort=date');
  });
});
