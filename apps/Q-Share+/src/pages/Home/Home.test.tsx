import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { addUser } from '../../state/features/authSlice';
import { addFiles } from '../../state/features/fileSlice';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { store } from '../../state/store';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';

function renderHome() {
  return render(
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </HubThemeProvider>
    </Provider>
  );
}

describe('Home first load', () => {
  it('runs exactly one paged search and one FETCH per row, then shows the rows', async () => {
    resetQdnSearchCache();
    const rows = [1, 2, 3].map((n) => ({
      name: 'alice',
      service: 'DOCUMENT',
      identifier: `qshare_file_share-${n}_id${n}_metadata`,
      created: Date.now() - n * 60_000,
      metadata: { title: `Share ${n}` },
    }));
    mockFetch('/arbitrary/resources/search', rows);
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => ({
      title: `Share ${String(params.identifier).match(/share-(\d)/)?.[1]}`,
      version: 1,
      fullDescription: 'hello',
      htmlDescription: '<p>hello</p>',
      commentsId: 'x',
      category: '6',
      files: [{ filename: 'a.pdf', identifier: 'f', name: 'alice', service: 'FILE', mimetype: 'application/pdf', size: 2048 }],
    }));

    renderHome();

    expect(await screen.findByText('Share 1')).toBeInTheDocument();
    await waitFor(() => expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(3));

    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.length).toBe(1);
    expect(searches[0]).toContain('limit=20');
    expect(searches[0]).toContain('identifier=qshare_file_');
    expect(searches[0]).not.toMatch(/limit=0\b/);
    // Three rows came back (fewer than a page), so the list says it is complete.
    expect(await screen.findByText("That's every share that matches.")).toBeInTheDocument();
  });

  it('the Following chip re-runs the search with followedonly=true and hidden names are filtered', async () => {
    resetQdnSearchCache();
    store.dispatch(addFiles([]));
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    localStorage.setItem('qshareplus-settings', JSON.stringify({ hiddenNames: ['spammer'] }));
    const { resetSettingsCache } = await import('../../utils/settings');
    resetSettingsCache();
    mockFetch('/arbitrary/resources/search', (url) => {
      if (url.searchParams.get('followedonly') === 'true') {
        return [{ name: 'bob', service: 'DOCUMENT', identifier: 'qshare_file_from-bob_id9_metadata', created: 1, metadata: { title: 'From Bob' } }];
      }
      return [
        { name: 'spammer', service: 'DOCUMENT', identifier: 'qshare_file_spam_id7_metadata', created: 2, metadata: { title: 'Spam' } },
        { name: 'carol', service: 'DOCUMENT', identifier: 'qshare_file_ok_id8_metadata', created: 3, metadata: { title: 'Fine' } },
      ];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => ({ title: String(params.identifier).includes('spam') ? 'Spam' : String(params.identifier).includes('bob') ? 'From Bob' : 'Fine', files: [] }));

    renderHome();
    expect(await screen.findByText('Fine')).toBeInTheDocument();
    expect(screen.queryByText('Spam')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(await screen.findByText('From Bob')).toBeInTheDocument();
    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.some((u) => u.includes('followedonly=true'))).toBe(true);
    expect(await screen.findByText('From names you follow')).toBeInTheDocument();
  });
});

describe('Home filters on a phone', () => {
  const originalMatchMedia = window.matchMedia;
  const originalObserver = globalThis.IntersectionObserver;
  // Every observed element, so the test can scroll LazyLoad's sentinel into view.
  const observed: { callback: IntersectionObserverCallback; target: Element }[] = [];
  // Row bodies wait until the test is over: it is about the searches, and forty
  // body renders only slow it down. Releasing them lets the app-wide queue drain.
  let holdBodies = true;
  const heldBodies: (() => void)[] = [];

  beforeEach(() => {
    holdBodies = true;
    // Portrait phone: the narrow and phone breakpoints match, nothing else does.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query.includes('899.95') || query.includes('599.95'),
        media: query,
        onchange: null,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() {
          return false;
        },
      }),
    });
    class CapturingObserver {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        observed.push({ callback: this.callback, target });
      }
      unobserve(target: Element) {
        const i = observed.findIndex((o) => o.target === target);
        if (i >= 0) observed.splice(i, 1);
      }
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: CapturingObserver, writable: true, configurable: true });
  });
  afterEach(() => {
    holdBodies = false;
    heldBodies.splice(0).forEach((release) => release());
    observed.length = 0;
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: originalObserver, writable: true, configurable: true });
  });

  const scrollToEnd = () =>
    act(() => {
      for (const { callback, target } of [...observed]) {
        callback([{ target, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry], {} as IntersectionObserver);
      }
    });

  it('keeps the applied category for the next page after the sheet has closed', async () => {
    resetQdnSearchCache();
    store.dispatch(addFiles([]));
    // Full pages, so the list always has more to load.
    mockFetch('/arbitrary/resources/search', (url) => {
      const offset = Number(url.searchParams.get('offset') || 0);
      return Array.from({ length: 20 }, (_, i) => ({
        name: 'alice',
        service: 'DOCUMENT',
        identifier: `qshare_file_row-${offset + i}_id${offset + i}_metadata`,
        created: 1_000_000 - (offset + i),
        metadata: { title: `Row ${offset + i}` },
      }));
    });
    const body = { title: 'Row', files: [] };
    mockQortalAction('FETCH_QDN_RESOURCE', () =>
      holdBodies ? new Promise((resolve) => heldBodies.push(() => resolve(body))) : body
    );
    // Home's list searches only (a signed-in row may also look up its collections).
    const descriptions = () =>
      fetchCallsMatching('/arbitrary/resources/search')
        .map((u) => new URL(u, 'http://localhost').searchParams)
        .filter((params) => params.get('identifier') === 'qshare_file_')
        .map((params) => ({ offset: params.get('offset') ?? '0', description: params.get('description') }));

    renderHome();
    await waitFor(() => expect(descriptions()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters and sort' });
    fireEvent.mouseDown(within(sheet).getByRole('combobox', { name: 'Category' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Software' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(descriptions()).toHaveLength(2));
    expect(descriptions()[1]).toEqual({ offset: '0', description: 'cat:1' });
    // The close slide has finished: the sheet is hidden, not gone.
    await waitFor(() => expect(screen.getByRole('dialog', { hidden: true })).not.toBeVisible());

    // Page two still carries the category.
    scrollToEnd();
    await waitFor(() => expect(descriptions()).toHaveLength(3));
    expect(descriptions()[2]).toEqual({ offset: '20', description: 'cat:1' });

    // And the sheet still shows it when it opens again.
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const reopened = await screen.findByRole('dialog', { name: 'Filters and sort' });
    expect(within(reopened).getByRole('combobox', { name: 'Category' })).toHaveTextContent('Software');
  });
});
