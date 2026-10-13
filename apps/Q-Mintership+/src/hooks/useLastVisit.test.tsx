/** The shell saves the last visit from data it already has, and keeps the earlier one as the baseline. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { lastVisitKey, resetLastVisitSession, visitBaseline } from '../data/lastVisit';
import { loadNominations } from '../data/nominations';
import { queryLoadCounts } from '../data/query';
import { parseSnapshot } from '../rules/sinceLastVisit';
import { renderPage } from '../test/render';
import { fetchCallsFor } from '../test/setup';
import { ADDR, TIP } from '../test/world';
import { useRecordVisit } from './useLastVisit';

beforeEach(() => resetLastVisitSession());
afterEach(() => vi.useRealTimers());

function Recorder() {
  useRecordVisit();
  return null;
}

const saved = (address: string) =>
  parseSnapshot(JSON.parse(window.localStorage.getItem(lastVisitKey(address)) ?? 'null'));

describe('useRecordVisit', () => {
  it("saves a Minter Admin's queue once it has loaded", async () => {
    await renderPage(<Recorder />, { persona: 'admin' });
    await waitFor(() => expect(saved(ADDR.admin)?.decisions?.length).toBe(11));
    const snapshot = saved(ADDR.admin);
    expect(snapshot?.height).toBe(TIP);
    expect('nomination' in (snapshot ?? {})).toBe(false);
    // Only reads the queue already makes: no single-transaction lookups.
    expect(fetchCallsFor(/^\/transactions\/signature\/[^/?]+$/)).toHaveLength(0);
  });

  it("saves a nominee's newest nomination", async () => {
    await renderPage(<Recorder />, { persona: 'nominatedSigning' });
    await waitFor(() => expect(saved(ADDR.nominatedSigning)?.nomination?.state).toBe('signing'));
    expect(saved(ADDR.nominatedSigning)?.nomination).toMatchObject({ signed: 5, needed: 8 });
    expect('decisions' in (saved(ADDR.nominatedSigning) ?? {})).toBe(false);
  });

  it('saves "no nomination" for someone not in MINTER without one', async () => {
    await renderPage(<Recorder />, { persona: 'newcomerName' });
    await waitFor(() => expect(saved(ADDR.newcomerName)).not.toBeNull());
    expect(saved(ADDR.newcomerName)?.nomination).toBeNull();
  });

  it('saves the nominations a nominator made once a screen has read them, never reading them itself', async () => {
    await renderPage(<Recorder />, { persona: 'nominator' });
    await waitFor(() => expect(saved(ADDR.nominator)).not.toBeNull());
    expect('made' in (saved(ADDR.nominator) ?? {})).toBe(false);
    expect(queryLoadCounts().nominations ?? 0).toBe(0);
    // Home reads every nomination: the shell saves Nora's own from it.
    await act(() => loadNominations());
    await waitFor(() => expect(saved(ADDR.nominator)?.made?.length).toBe(5));
    const made = saved(ADDR.nominator)?.made ?? [];
    expect(made.map((m) => [m.nominee, m.state])).toEqual([
      [ADDR.nominatedWaiting, 'waiting'],
      [ADDR.nominatedSigning, 'signing'],
      [ADDR.urgent, 'signing'],
      [ADDR.lapsed, 'lapsed'],
      [ADDR.expired, 'expired'],
    ]);
  });

  it('saves only the time for a member', async () => {
    await renderPage(<Recorder />, { persona: 'learner' });
    await waitFor(() => expect(saved(ADDR.learner)).not.toBeNull());
    const snapshot = saved(ADDR.learner) ?? {};
    expect('decisions' in snapshot || 'nomination' in snapshot).toBe(false);
  });

  it('keeps the earlier visit as the baseline for this session', async () => {
    const earlier = { v: 1, at: 1_791_000_000_000, height: 2_740_000, nomination: null };
    window.localStorage.setItem(lastVisitKey(ADDR.nominatedWaiting), JSON.stringify(earlier));
    await renderPage(<Recorder />, { persona: 'nominatedWaiting' });
    await waitFor(() => expect(saved(ADDR.nominatedWaiting)?.nomination?.state).toBe('waiting'));
    expect(visitBaseline(ADDR.nominatedWaiting)).toEqual(earlier);
  });

  it('saves nothing signed out or outside Hub', async () => {
    await renderPage(<Recorder />, { persona: 'signedOut' });
    await renderPage(<Recorder />, { persona: 'outside' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const keys = Object.keys(window.localStorage).filter((k) => k.includes('last-visit-'));
    expect(keys).toEqual([]);
  });
});
