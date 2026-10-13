/** The last visit on this device: per account and group, read once a session, outcomes read once. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCallsFor } from '../test/setup';
import { ADDR, installWorld } from '../test/world';
import { lastVisitStorageKey } from '../../e2e/world.mjs';
import type { VisitSnapshot } from '../rules/sinceLastVisit';
import {
  claimAnnouncement,
  isJoinedSeen,
  knownOutcomes,
  lastVisitKey,
  loadOutcomes,
  markSeen,
  outcomesKey,
  recordVisit,
  resetLastVisitSession,
  visitBaseline,
} from './lastVisit';

const AT = 1_791_000_000_000;
const snap = (at: number): VisitSnapshot => ({ v: 1, at, height: 100, nomination: null });

beforeEach(() => resetLastVisitSession());
afterEach(() => vi.useRealTimers());

describe('the last visit', () => {
  it('is kept per account and group under the app prefix', () => {
    expect(lastVisitKey('QAbc', 694)).toBe('qmintershipplus-last-visit-QAbc-694');
    expect(lastVisitKey('QAbc')).toBe('qmintershipplus-last-visit-QAbc-694');
    // The mock world writes the same key for the screenshot check.
    expect(lastVisitStorageKey('QAbc')).toBe(lastVisitKey('QAbc'));
  });

  it('keeps the earlier visit as the baseline while it saves new ones', () => {
    window.localStorage.setItem(lastVisitKey('QA'), JSON.stringify(snap(AT)));
    expect(visitBaseline('QA')?.at).toBe(AT);
    recordVisit('QA', snap(AT + 5000));
    expect(visitBaseline('QA')?.at).toBe(AT);
    expect(JSON.parse(window.localStorage.getItem(lastVisitKey('QA')) ?? '{}').at).toBe(AT + 5000);
    // A new session compares with the newest save.
    resetLastVisitSession();
    expect(visitBaseline('QA')?.at).toBe(AT + 5000);
  });

  it("keeps the nominations a nominator made when a save doesn't know them", () => {
    const made = [{ nominee: 'Qn', decision: null, state: 'waiting' as const, publishedAt: AT }];
    const stored = () => JSON.parse(window.localStorage.getItem(lastVisitKey('QM')) ?? '{}');
    recordVisit('QM', { ...snap(AT), made });
    // A screen that didn't read every nomination: the time moves on, the list stays.
    recordVisit('QM', snap(AT + 1));
    expect(stored()).toMatchObject({ at: AT + 1, made });
    // A screen that did: its list (even an empty one) replaces it.
    recordVisit('QM', { ...snap(AT + 2), made: [] });
    expect(stored()).toMatchObject({ at: AT + 2, made: [] });
  });

  it('reads the earlier visit before the first save of a session', () => {
    window.localStorage.setItem(lastVisitKey('QB'), JSON.stringify(snap(AT)));
    recordVisit('QB', snap(AT + 1));
    expect(visitBaseline('QB')?.at).toBe(AT);
  });

  it('has no baseline on a first visit, or with damaged or blocked storage', () => {
    expect(visitBaseline('QNone')).toBeNull();
    window.localStorage.setItem(lastVisitKey('QBad'), '{not json');
    expect(visitBaseline('QBad')).toBeNull();
    window.localStorage.setItem(lastVisitKey('QOld'), JSON.stringify({ v: 0, at: AT }));
    expect(visitBaseline('QOld')).toBeNull();
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(visitBaseline('QBlocked')).toBeNull();
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(() => recordVisit('QBlocked', snap(AT))).not.toThrow();
    set.mockRestore();
  });

  it('moves the baseline to now on "Mark as seen"', () => {
    window.localStorage.setItem(lastVisitKey('QC'), JSON.stringify(snap(AT)));
    expect(isJoinedSeen('QC')).toBe(false);
    markSeen('QC', snap(AT + 9000));
    expect(visitBaseline('QC')?.at).toBe(AT + 9000);
    expect(isJoinedSeen('QC')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(lastVisitKey('QC')) ?? '{}').at).toBe(AT + 9000);
  });

  it('reads the summary out once per account and session', () => {
    expect(claimAnnouncement('QD')).toBe(true);
    expect(claimAnnouncement('QD')).toBe(false);
    expect(claimAnnouncement('QE')).toBe(true);
    resetLastVisitSession();
    expect(claimAnnouncement('QD')).toBe(true);
  });
});

describe('loadOutcomes', () => {
  it('reads each decided transaction once, and keeps the answers', async () => {
    const { world } = installWorld('admin');
    const expired = world.decided.find(
      (t: { invitee?: string }) => t.invitee === ADDR.expired
    ).signature;
    const approved = world.decided.find(
      (t: { invitee?: string }) => t.invitee === ADDR.recentlyJoined
    ).signature;
    const outcomes = await loadOutcomes([expired, approved, 'unknownSignature']);
    expect(outcomes.get(expired)?.approvalStatus).toBe('EXPIRED');
    expect(outcomes.get(approved)?.approvalStatus).toBe('APPROVED');
    expect(outcomes.get('unknownSignature')).toBeNull();
    expect(fetchCallsFor('/transactions/signature/')).toHaveLength(3);
    await loadOutcomes([approved, expired, 'unknownSignature']);
    expect(fetchCallsFor('/transactions/signature/')).toHaveLength(3);
    expect(outcomesKey(['b', 'a', 'b'])).toBe('lastvisit:outcomes:a,b');
  });

  it('a set that grows by one reads only the new one, and knows the rest at once', async () => {
    const { world } = installWorld('admin');
    const [a, b, c] = world.decided
      .filter(
        (t: { approvalStatus?: string }) =>
          t.approvalStatus === 'APPROVED' || t.approvalStatus === 'EXPIRED'
      )
      .slice(0, 3)
      .map((t: { signature: string }) => t.signature) as string[];
    expect(c).toBeDefined();
    await loadOutcomes([a, b]);
    expect(fetchCallsFor('/transactions/signature/')).toHaveLength(2);
    // Past the 15 s a transaction read is kept: the decided ones are still known.
    vi.setSystemTime(Date.now() + 60_000);
    expect([...knownOutcomes([a, b, c]).keys()].sort()).toEqual([a, b].sort());
    await loadOutcomes([a, b, c]);
    expect(fetchCallsFor('/transactions/signature/')).toHaveLength(3);
  });

  it('reads at most a dozen', async () => {
    installWorld('admin');
    const many = Array.from({ length: 20 }, (_, i) => `sig${String(i).padStart(2, '0')}`);
    const outcomes = await loadOutcomes(many);
    expect(outcomes.size).toBe(12);
    expect(fetchCallsFor('/transactions/signature/')).toHaveLength(12);
  });
});
