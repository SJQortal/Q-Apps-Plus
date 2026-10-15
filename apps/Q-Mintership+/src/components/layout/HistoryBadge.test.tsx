/**
 * The History tab's count for Minter Admins: MINTER's changes decided since
 * they last had History open on this device.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderPage } from '../../test/render';
import { fetchCallsFor } from '../../test/setup';
import { ADDR, TIP, installWorld } from '../../test/world';
import { historySeenKey, readHistorySeen, resetHistorySeen } from '../../data/historySeen';
import { loadHistoryNews } from '../../data/historyNews';
import ActivityPage from '../../pages/activity/ActivityPage';
import HistoryPage from '../../pages/history/HistoryPage';
import { AppShell } from './AppShell';

const T = { timeout: 4000 };
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  resetHistorySeen();
  window.matchMedia = originalMatchMedia;
});

/** A screen `width` px wide, for MUI's breakpoint queries. */
function screenWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      sizes.every(([, edge, value]) =>
        edge === 'min' ? width >= Number(value) : width <= Number(value)
      );
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

/** This device last saw History up to `height`, for `address`. */
const seenAt = (address: string, height: number) => () =>
  window.localStorage.setItem(historySeenKey(address), JSON.stringify({ v: 1, height }));

const decisionSearches = () =>
  fetchCallsFor('/transactions/search').filter((p) => p.includes('txGroupId=694'));

describe('what is new in History (data/historyNews)', () => {
  // The world's recent changes: approvals at TIP − 8,100 and TIP − 5,200, and invites that
  // expired at TIP − 5,452 and TIP − 4,919.
  it('counts the changes decided after the height last seen, from one search', async () => {
    installWorld('admin');
    expect(await loadHistoryNews(TIP - 6_000)).toBe(3);
    expect(await loadHistoryNews(TIP - 9_000)).toBe(4);
    expect(await loadHistoryNews(TIP - 5_000)).toBe(1);
    const searches = decisionSearches();
    expect(searches.some((p) => p.includes(`startBlock=${TIP - 6_000 - 10_081}`))).toBe(true);
    expect(searches.every((p) => /limit=100/.test(p))).toBe(true);
  });

  it('reads nothing once History was seen up to the tip', async () => {
    installWorld('admin');
    expect(await loadHistoryNews(TIP)).toBe(0);
    expect(decisionSearches()).toEqual([]);
  });
});

describe('the History tab', () => {
  it('shows a Minter Admin how many changes were decided since they last looked', async () => {
    await renderPage(<AppShell />, { persona: 'admin', setup: seenAt(ADDR.admin, TIP - 6_000) });
    await waitFor(
      () =>
        expect(screen.getAllByRole('button', { name: /^History, 3 new$/ }).length).toBeGreaterThan(
          0
        ),
      T
    );
  });

  it('the first time, counts from now: no old news', async () => {
    await renderPage(<AppShell />, { persona: 'admin' });
    await waitFor(() => expect(readHistorySeen(ADDR.admin)).toBe(TIP), T);
    expect(screen.getAllByRole('button', { name: /^History$/ }).length).toBeGreaterThan(0);
  });

  it('counts nothing for someone who isn’t a Minter Admin', async () => {
    await renderPage(<AppShell />, {
      persona: 'nominator',
      setup: seenAt(ADDR.nominator, TIP - 6_000),
    });
    await screen.findAllByRole('button', { name: /^Nominations$/ }, T);
    expect(screen.queryAllByRole('button', { name: /^History, / })).toEqual([]);
    expect(decisionSearches().some((p) => p.includes(`startBlock=${TIP - 6_000 - 10_081}`))).toBe(
      false
    );
  });

  it('opening History makes what its list reaches seen', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'admin',
      path: '/history',
      setup: seenAt(ADDR.admin, TIP - 6_000),
    });
    await screen.findByRole('group', { name: 'MINTER events, newest first' }, T);
    await waitFor(() => expect(readHistorySeen(ADDR.admin)).toBe(TIP), T);
  });

  it('on a Minter Admin’s phone, where the bar has no History, Activity’s History button counts', async () => {
    screenWidth(390);
    await renderPage(<ActivityPage />, {
      persona: 'admin',
      path: '/activity',
      setup: seenAt(ADDR.admin, TIP - 6_000),
    });
    expect(
      await screen.findByRole('link', { name: 'History, 3 new' }, { timeout: 6000 })
    ).toBeVisible();
  });

  it('on a wider screen the rail has History, so Activity’s button doesn’t repeat the count', async () => {
    screenWidth(1280);
    await renderPage(<ActivityPage />, {
      persona: 'admin',
      path: '/activity',
      setup: seenAt(ADDR.admin, TIP - 6_000),
    });
    expect(await screen.findByRole('link', { name: 'History' }, T)).toBeVisible();
  });
});
