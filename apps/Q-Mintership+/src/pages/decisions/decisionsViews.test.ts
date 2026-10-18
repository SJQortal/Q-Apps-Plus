import { describe, expect, it } from 'vitest';
import {
  TAB_ACCENT,
  decisionsViewPath,
  defaultDecisionsView,
  nominationsRedirect,
  parseDecisionsView,
  shownDecisionsViews,
} from './decisionsViews';

describe('Decisions’ tabs in the address', () => {
  it('reads ?show=, and nothing else, as a tab', () => {
    expect(parseDecisionsView('decisions')).toBe('decisions');
    expect(parseDecisionsView('nominations')).toBe('nominations');
    // Ready to mint was a tab until 2026-10-18: now Propose → Decline a join request.
    expect(parseDecisionsView('ready')).toBeNull();
    expect(parseDecisionsView(null)).toBeNull();
    expect(parseDecisionsView('waiting')).toBeNull();
  });

  it('opens a Minter Admin on Decisions and everyone else on Nominations', () => {
    expect(defaultDecisionsView(true)).toBe('decisions');
    expect(defaultDecisionsView(false, 3)).toBe('nominations');
    // None open: Nominations has no tab, so All Decisions (Simon, 2026-10-18).
    expect(defaultDecisionsView(false, 0)).toBe('decisions');
    // Not read yet: wait; couldn't be read: Nominations, with its error and Retry.
    expect(defaultDecisionsView(false)).toBeNull();
    expect(defaultDecisionsView(false, null)).toBe('nominations');
  });

  it('gives Nominations a tab only while it lists someone, or is on screen, in green', () => {
    const keys = (counts: { decisions?: number; nominations?: number }, view: string | null) =>
      shownDecisionsViews(counts, view as 'decisions' | null).map((v) => v.key);
    expect(keys({ decisions: 2, nominations: 0 }, 'decisions')).toEqual(['decisions']);
    expect(keys({ decisions: 2 }, 'decisions')).toEqual(['decisions']);
    expect(keys({ decisions: 0, nominations: 1 }, 'decisions')).toEqual([
      'decisions',
      'nominations',
    ]);
    expect(keys({ nominations: 0 }, 'nominations')).toEqual(['decisions', 'nominations']);
    // Green, as Add to MINTER (not the waiting blue).
    expect(TAB_ACCENT.nominations).toBe('invite');
  });

  it('builds each tab’s address, with a nomination state on Nominations only', () => {
    expect(decisionsViewPath('decisions')).toBe('/decisions?show=decisions');
    expect(decisionsViewPath('nominations')).toBe('/decisions?show=nominations');
    expect(decisionsViewPath('nominations', 'waiting')).toBe(
      '/decisions?show=nominations&state=waiting'
    );
    expect(decisionsViewPath('decisions', 'waiting')).toBe('/decisions?show=decisions');
  });

  it('opens the old Nominations page’s links on the same tab and state', () => {
    expect(nominationsRedirect('')).toBe('/decisions?show=nominations');
    expect(nominationsRedirect('?show=signing')).toBe('/decisions?show=nominations&state=signing');
    expect(nominationsRedirect('?show=nonsense')).toBe('/decisions?show=nominations');
    // The old Ready to mint view: Decisions on the account's own default view.
    expect(nominationsRedirect('?show=ready')).toBe('/decisions');
    expect(nominationsRedirect('?show=ready&sort=date')).toBe('/decisions');
    // A query Hub appended to the app's own is not the app's.
    expect(nominationsRedirect('?show=ready?theme=dark')).toBe('/decisions');
    // The rest of the query comes along.
    expect(nominationsRedirect('?show=waiting&from=home')).toBe(
      '/decisions?show=nominations&state=waiting&from=home'
    );
  });
});
