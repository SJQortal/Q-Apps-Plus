import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { addUser } from '../../state/features/authSlice';
import { addFiles, changefilterName, changefilterSearch, shareKey } from '../../state/features/fileSlice';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { store } from '../../state/store';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetSettingsCache, writeSettings } from '../../utils/settings';
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils';
import { readOncePerObserve } from '../../test/intersection';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';
import { OPEN_PUBLISH_EVENT } from '../../constants/events';

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

// The store and the settings cache are module singletons: start each test clean.
beforeEach(() => {
  resetQdnSearchCache();
  resetSettingsCache();
  store.dispatch(addFiles([]));
  store.dispatch(changefilterName(''));
  store.dispatch(changefilterSearch(''));
  store.dispatch(addUser(null));
});

describe('Home first load', () => {
  it('runs exactly one paged search and one FETCH per row, then shows the rows', async () => {
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
    // With metadata, so each row has its title and date before its body lands.
    expect(searches[0]).toContain('includemetadata=true');
    expect(searches[0]).not.toMatch(/limit=0\b/);
    // Three rows came back (fewer than a page), so the list says it is complete.
    expect(await screen.findByText("That's every share that matches.")).toBeInTheDocument();
  });

  it('the Following chip re-runs the search with followedonly=true and hidden names are filtered', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    localStorage.setItem('qshareplus-settings', JSON.stringify({ hiddenNames: ['spammer'] }));
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
    // A category counts as a filter, so the button now says so.
    fireEvent.click(screen.getByRole('button', { name: 'Filters on' }));
    const reopened = await screen.findByRole('dialog', { name: 'Filters and sort' });
    expect(within(reopened).getByRole('combobox', { name: 'Category' })).toHaveTextContent('Software');
  });
});

describe('Home rows before and without a body', () => {
  it('shows the metadata title at once, and a readable row when the body never comes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockFetch('/arbitrary/resources/search', [
      { name: 'dave', service: 'DOCUMENT', identifier: 'qshare_file_slow_idS1_metadata', created: 5, metadata: { title: 'Slow share' } },
      // No metadata, and the node answers "Data unavailable" (MISSING_DATA), as for Bob Arctor's share.
      { name: 'erin', service: 'DOCUMENT', identifier: 'qshare_file_qorterminator-2-visual_WiRAxt_metadata', created: 4 },
    ]);
    mockQortalAction('FETCH_QDN_RESOURCE', async (params) => {
      if (String(params.identifier).includes('slow')) {
        await gate;
        return { title: 'Slow share with its full title', files: [] };
      }
      throw { error: 1401, message: 'Data unavailable. Please try again later.' };
    });

    renderHome();

    // The title comes from the search, before the body.
    expect(await screen.findByText('Slow share')).toBeInTheDocument();
    // Three tries, then the row says why and keeps a title from the identifier.
    expect(await screen.findByText('Not available on your node right now')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Qorterminator 2 visual' })).toBeInTheDocument();
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').filter((c) => String(c.identifier).includes('WiRAxt')).length).toBe(3);
    expect(store.getState().file.unavailableFiles[shareKey('erin', 'qshare_file_qorterminator-2-visual_WiRAxt_metadata')]).toBe(true);

    release();
    expect(await screen.findByText('Slow share with its full title')).toBeInTheDocument();
  });

  it('leaves out shares whose body is not a JSON object (deleted), but keeps bare ones', async () => {
    mockFetch('/arbitrary/resources/search', [
      { name: 'Claude', service: 'DOCUMENT', identifier: 'qshare_file_torq-test_IiciuD_metadata', created: 3, metadata: { title: 'Torq Test' } },
      { name: 'openbook', service: 'DOCUMENT', identifier: 'qshare_file_book_Ob1234_metadata', created: 2, metadata: { title: 'deleted', tags: ['deleted'] } },
      { name: 'frank', service: 'DOCUMENT', identifier: 'qshare_file_bare_Fr1234_metadata', created: 1, metadata: { title: 'Bare share' } },
    ]);
    // Core hands non-JSON text back as a string: Torq's delete is "D", others publish "\n".
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => {
      const id = String(params.identifier);
      if (id.includes('torq')) return 'D';
      if (id.includes('book')) return '\n';
      return { title: 'Bare share' };
    });

    renderHome();

    expect(await screen.findByText('Bare share')).toBeInTheDocument();
    await waitFor(() => expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(3));
    await waitFor(() => expect(screen.queryByText('Torq Test')).not.toBeInTheDocument());
    expect(screen.queryByText('deleted')).not.toBeInTheDocument();
    // Missing optional fields are not a delete.
    expect(screen.getByText('Bare share')).toBeInTheDocument();
    expect(screen.getByText(/0 files/)).toBeInTheDocument();
    expect(store.getState().file.hashMapFiles['qshare_file_torq-test_IiciuD_metadata']).toMatchObject({ isValid: false, deleted: true });
  });
});

describe('Home chips and empty states', () => {
  const signIn = () =>
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
  const other = { name: 'bob', service: 'DOCUMENT', identifier: 'qshare_file_other_Ot1234_metadata', created: 1, metadata: { title: 'Someone else' } };
  const lastSearch = () => new URL(fetchCallsMatching('/arbitrary/resources/search').at(-1)!, 'http://localhost').searchParams;

  it('My shares with nothing published invites you to share, and a second tap turns it off', async () => {
    signIn();
    mockFetch('/arbitrary/resources/search', (url) => (url.searchParams.get('name') === 'alice' ? [] : [other]));
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Someone else', files: [] });

    renderHome();
    expect(await screen.findByText('Someone else')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'My shares' }));
    expect(await screen.findByText("You haven't shared anything yet")).toBeInTheDocument();
    expect(lastSearch().get('name')).toBe('alice');
    expect(screen.getByRole('button', { name: 'My shares' })).toHaveAttribute('aria-pressed', 'true');

    const onOpen = vi.fn();
    window.addEventListener(OPEN_PUBLISH_EVENT, onOpen);
    fireEvent.click(screen.getByRole('button', { name: 'Share files' }));
    window.removeEventListener(OPEN_PUBLISH_EVENT, onOpen);
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'My shares' }));
    expect(await screen.findByText('Someone else')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My shares' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastSearch().has('name')).toBe(false);
  });

  it('the Following empty state goes back to the latest shares', async () => {
    signIn();
    mockFetch('/arbitrary/resources/search', (url) => (url.searchParams.get('followedonly') === 'true' ? [] : [other]));
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Someone else', files: [] });

    renderHome();
    expect(await screen.findByText('Someone else')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(await screen.findByText('Nothing from the names you follow yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show latest shares' }));
    expect(await screen.findByText('Someone else')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'false');
    expect(lastSearch().has('followedonly')).toBe(false);
  });
});

describe('Home applied filters', () => {
  const lastSearch = () => new URL(fetchCallsMatching('/arbitrary/resources/search').at(-1)!, 'http://localhost').searchParams;

  it('a category-only search counts as filtered', async () => {
    mockFetch('/arbitrary/resources/search', (url) =>
      url.searchParams.get('description')
        ? []
        : [{ name: 'bob', service: 'DOCUMENT', identifier: 'qshare_file_any_An1234_metadata', created: 1, metadata: { title: 'Any share' } }]
    );
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Any share', files: [] });

    renderHome();
    expect(await screen.findByText('Any share')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest shares' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Software' }));
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No shares match these filters')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shares in Software' })).toBeInTheDocument();
    expect(lastSearch().get('description')).toBe('cat:1');
    expect(screen.getByRole('button', { name: 'Reset filters' })).toBeInTheDocument();
  });

  it('the next page uses the filters of the last search, not unsent edits', async () => {
    mockFetch('/arbitrary/resources/search', (url) => {
      const offset = Number(url.searchParams.get('offset'));
      return Array.from({ length: offset === 0 ? 20 : 2 }, (_, i) => ({
        name: 'bob',
        service: 'DOCUMENT',
        identifier: `qshare_file_page-${offset + i}_Pg${String(offset + i).padStart(4, '0')}_metadata`,
        created: 1000 - offset - i,
        metadata: { title: `Page row ${offset + i}` },
      }));
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    renderHome();
    expect(await screen.findByText('Page row 0')).toBeInTheDocument();
    // Typed, not applied.
    fireEvent.change(screen.getByLabelText('Search titles'), { target: { value: 'unsent' } });
    await waitFor(() => {
      mockAllIsIntersecting(true);
      expect(fetchCallsMatching(/[?&]offset=20&/).length).toBe(1);
    }, { timeout: 5000 });
    expect(lastSearch().has('query')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Latest shares' })).toBeInTheDocument();
  });
});

describe('Home next page errors', () => {
  it('a failed next page keeps the rows, stops the pager and offers Retry for that page', async () => {
    readOncePerObserve();
    const row = (slug: string, created: number, title: string) => ({
      name: 'bob',
      service: 'DOCUMENT',
      identifier: `qshare_file_${slug}_${slug.slice(-6).padStart(6, 'x')}_metadata`,
      created,
      metadata: { title },
    });
    let nodeDown = true;
    mockFetch('/arbitrary/resources/search', (url) => {
      if (url.searchParams.get('offset') === '0') return Array.from({ length: 20 }, (_, i) => row(`home-${i}`, 100 - i, `Home share ${i}`));
      if (nodeDown) throw new Error('node down');
      return [row('home-last', 1, 'Home last share')];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });
    const searchesAt = (offset: number) => fetchCallsMatching(new RegExp(`[?&]offset=${offset}&`)).length;

    renderHome();

    expect(await screen.findByText('Could not load more shares.', {}, { timeout: 4000 })).toBeInTheDocument();
    // The sentinel stays in view, but a failed page is tried once, not five times back to back.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(searchesAt(20)).toBe(1);
    expect(screen.getByText('Home share 0')).toBeInTheDocument();
    expect(screen.queryByText('Could not load shares')).not.toBeInTheDocument();

    nodeDown = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Home last share', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(searchesAt(20)).toBe(2);
    // Retry loads that page, not the list again from the top.
    expect(searchesAt(0)).toBe(1);
    expect(screen.getByText('Home share 0')).toBeInTheDocument();
    expect(screen.queryByText('Could not load more shares.')).not.toBeInTheDocument();
  });

  it('a failed new search still takes the whole list, with Retry from the top', async () => {
    let nodeDown = false;
    mockFetch('/arbitrary/resources/search', () => {
      if (nodeDown) throw new Error('node down');
      return [{ name: 'bob', service: 'DOCUMENT', identifier: 'qshare_file_old_Old123_metadata', created: 1, metadata: { title: 'Newest first' } }];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    renderHome();
    expect(await screen.findByText('Newest first')).toBeInTheDocument();
    nodeDown = true;
    fireEvent.click(screen.getByRole('button', { name: 'Oldest' }));
    expect(await screen.findByText('Could not load shares')).toBeInTheDocument();
    // The newest-first rows are still in the store, but not shown under the new sort.
    expect(screen.queryByText('Newest first')).not.toBeInTheDocument();
  });

  it('Retry keeps focus: on the button while its page loads and fails again, then on the first row it adds', async () => {
    readOncePerObserve();
    const row = (slug: string, created: number, title: string) => ({
      name: 'bob',
      service: 'DOCUMENT',
      identifier: `qshare_file_${slug}_${slug.slice(-6).padStart(6, 'x')}_metadata`,
      created,
      metadata: { title },
    });
    // Page two: fails, fails again once released, then lands.
    let pageTwoCalls = 0;
    let open: (() => void) | undefined;
    mockFetch('/arbitrary/resources/search', async (url) => {
      if (url.searchParams.get('offset') === '0') return Array.from({ length: 20 }, (_, i) => row(`home-${i}`, 100 - i, `Home share ${i}`));
      pageTwoCalls += 1;
      if (pageTwoCalls === 2) await new Promise<void>((resolve) => (open = resolve));
      if (pageTwoCalls <= 2) throw new Error('node down');
      return [row('home-last', 1, 'Home last share')];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    renderHome();
    const retry = await screen.findByRole('button', { name: 'Retry' }, { timeout: 4000 });
    retry.focus();
    fireEvent.click(retry);
    // While the page loads, the button stays (busy, not disabled) and keeps focus.
    await waitFor(() => expect(open).toBeDefined());
    expect(screen.getByRole('button', { name: 'Loading…' })).toBe(retry);
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(document.activeElement).toBe(retry);

    open!();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBe(retry);
    expect(document.activeElement).toBe(retry);

    fireEvent.click(retry);
    const added = (await screen.findByText('Home last share', {}, { timeout: 4000 })).closest('button');
    await waitFor(() => expect(document.activeElement).toBe(added));
    expect(screen.queryByText('Could not load more shares.')).not.toBeInTheDocument();
    expect(pageTwoCalls).toBe(3);
  });
});

describe('Home after Back', () => {
  const listSearches = () =>
    fetchCallsMatching('/arbitrary/resources/search')
      .map((u) => new URL(u, 'http://localhost').searchParams)
      .filter((params) => params.get('identifier') === 'qshare_file_');
  const nextPage = async () => {
    await waitFor(() => {
      mockAllIsIntersecting(true);
      expect(fetchCallsMatching(/[?&]offset=20&/).length).toBe(1);
    }, { timeout: 5000 });
    return listSearches().at(-1)!;
  };
  // A full first page and a short second one, titled after the list they belong to.
  const pages = (label: (url: URL) => string) => (url: URL) => {
    const offset = Number(url.searchParams.get('offset'));
    const kind = label(url);
    return Array.from({ length: offset === 0 ? 20 : 2 }, (_, i) => ({
      name: 'bob',
      service: 'DOCUMENT',
      identifier: `qshare_file_${kind.toLowerCase()}-${offset + i}_${kind.slice(0, 2)}${String(offset + i).padStart(4, '0')}_metadata`,
      created: 1000 - offset - i,
      metadata: { title: `${kind} ${offset + i}` },
    }));
  };

  it('keeps the Following list, its heading and its next page', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    mockFetch('/arbitrary/resources/search', pages((url) => (url.searchParams.get('followedonly') === 'true' ? 'Followed' : 'Latest')));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    const first = renderHome();
    expect(await screen.findByText('Latest 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(await screen.findByText('Followed 0')).toBeInTheDocument();

    // Open a share, then Back: a new Home over the rows still in the store.
    first.unmount();
    renderHome();
    expect(screen.getByText('Followed 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'From names you follow' })).toBeInTheDocument();

    expect((await nextPage()).get('followedonly')).toBe('true');
    expect(await screen.findByText('Followed 21')).toBeInTheDocument();
    expect(screen.queryByText(/^Latest/)).not.toBeInTheDocument();
  });

  it('keeps a category search and its sort, and leaves out text typed but not applied', async () => {
    mockFetch('/arbitrary/resources/search', pages((url) => (url.searchParams.get('description') === 'cat:1' ? 'Software' : 'Any')));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    const first = renderHome();
    expect(await screen.findByText('Any 0')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Software' }));
    // Changing the sort searches with the category picked.
    fireEvent.click(screen.getByRole('button', { name: 'Oldest' }));
    expect(await screen.findByText('Software 0')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search titles'), { target: { value: 'unsent' } });

    first.unmount();
    renderHome();
    expect(screen.getByRole('heading', { name: 'Shares in Software' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oldest' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Software');

    const page = await nextPage();
    expect(page.get('description')).toBe('cat:1');
    expect(page.get('reverse')).toBe('false');
    expect(page.has('query')).toBe(false);
    expect(await screen.findByText('Software 21')).toBeInTheDocument();
  });

  it('starts from the defaults once the rows are gone', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    mockFetch('/arbitrary/resources/search', pages((url) => (url.searchParams.get('followedonly') === 'true' ? 'Followed' : 'Latest')));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    const first = renderHome();
    expect(await screen.findByText('Latest 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(await screen.findByText('Followed 0')).toBeInTheDocument();
    first.unmount();

    store.dispatch(addFiles([]));
    renderHome();
    expect(await screen.findByText('Latest 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'false');
    expect(listSearches().at(-1)!.has('followedonly')).toBe(false);
  });
});

// A list restored after Back, then changed from Settings or by the layout.
describe('Home after Back, once Settings or the layout changed', () => {
  const listSearches = () =>
    fetchCallsMatching('/arbitrary/resources/search')
      .map((u) => new URL(u, 'http://localhost').searchParams)
      .filter((params) => params.get('identifier') === 'qshare_file_');
  // One row a list, titled after the list it belongs to.
  const oneRow = (label: (url: URL) => string) => (url: URL) => {
    const kind = label(url);
    return [
      {
        name: 'bob',
        service: 'DOCUMENT',
        identifier: `qshare_file_${kind.toLowerCase()}-0_${kind.slice(0, 2)}0000_metadata`,
        created: 1000,
        metadata: { title: `${kind} 0` },
      },
    ];
  };

  it('loads the latest shares over a Following list whose chip was switched off in Settings', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    mockFetch('/arbitrary/resources/search', oneRow((url) => (url.searchParams.get('followedonly') === 'true' ? 'Followed' : 'Latest')));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    const first = renderHome();
    expect(await screen.findByText('Latest 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Following' }));
    expect(await screen.findByText('Followed 0')).toBeInTheDocument();
    first.unmount();

    // Settings, "Following feed" off, then back to Home over the followed rows.
    writeSettings({ followingFeed: false });
    renderHome();
    expect(await screen.findByText('Latest 0')).toBeInTheDocument();
    expect(screen.queryByText('Followed 0')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest shares' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Following' })).not.toBeInTheDocument();
    expect(listSearches().at(-1)!.has('followedonly')).toBe(false);
  });

  it('a picker that mounts again with the layout shows the applied categories, not the restored ones', async () => {
    // A window that can cross the 900 px breakpoint, which moves the filter form to the phone sheet.
    const originalMatchMedia = window.matchMedia;
    let narrow = false;
    const listeners = new Set<() => void>();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        get matches() {
          return narrow && query.includes('899.95');
        },
        media: query,
        onchange: null,
        addListener: (listener: () => void) => listeners.add(listener),
        removeListener: (listener: () => void) => listeners.delete(listener),
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        dispatchEvent: () => false,
      }),
    });
    onTestFinished(() => {
      Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
    });
    mockFetch('/arbitrary/resources/search', oneRow((url) => (url.searchParams.get('description') === 'cat:1' ? 'Software' : 'Any')));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    const first = renderHome();
    expect(await screen.findByText('Any 0')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Category' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Software' }));
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('Software 0')).toBeInTheDocument();

    // Back to the Software list, then Reset.
    first.unmount();
    renderHome();
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveTextContent('Software');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText('Any 0')).toBeInTheDocument();

    // Hub is resized across 900 px: a new picker, in the phone sheet.
    act(() => {
      narrow = true;
      listeners.forEach((listener) => listener());
    });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filters and sort' });
    expect(within(sheet).getByRole('combobox', { name: 'Category' })).not.toHaveTextContent('Software');
    // The next search reads that picker: still no category.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Oldest' }));
    await waitFor(() => expect(listSearches().at(-1)!.get('reverse')).toBe('false'));
    expect(listSearches().at(-1)!.has('description')).toBe(false);
  });
});

describe('Home with hidden names', () => {
  const hide = (names: string[]) => {
    localStorage.setItem('qshareplus-settings', JSON.stringify({ hiddenNames: names }));
    resetSettingsCache();
  };
  const row = (name: string, slug: string, created: number) => ({
    name,
    service: 'DOCUMENT',
    identifier: `qshare_file_${slug}_${slug.slice(-6).padStart(6, 'x')}_metadata`,
    created,
    metadata: { title: slug },
  });
  const spamPage = (offset: number, count = 20) =>
    Array.from({ length: count }, (_, i) => row('spammer', `spam-${offset + i}`, 10_000 - offset - i));
  const searchAt = (offset: number) => fetchCallsMatching(new RegExp(`[?&]offset=${offset}&`)).length;

  it('keeps paging while hidden rows leave the end of the list in view, and skips their bodies', async () => {
    // PixelMage fills ~92% of Latest on the real node; hiding it left 1-3 rows and a stalled list.
    hide(['spammer']);
    readOncePerObserve();
    mockFetch('/arbitrary/resources/search', (url) => {
      const offset = Number(url.searchParams.get('offset'));
      if (offset === 0) return [...spamPage(0, 19), row('carol', 'keep-one', 1)];
      if (offset === 20) return spamPage(20);
      if (offset === 40) return [row('carol', 'keep-two', 0)];
      return [];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => ({ title: String(params.identifier).includes('keep-one') ? 'Keep one' : 'Keep two', files: [] }));

    renderHome();
    expect(await screen.findByText('Keep one')).toBeInTheDocument();

    // The short list leaves the sentinel in view: its one reading loads page 2 without a scroll.
    // Page 2 (all hidden) leaves it in view again, and only observing a new sentinel element
    // when loading ends gets a browser to read it again and load page 3.
    await waitFor(() => expect(searchAt(40)).toBe(1), { timeout: 5000 });
    expect(await screen.findByText('Keep two')).toBeInTheDocument();
    expect(searchAt(20)).toBe(1);
    expect(await screen.findByText("That's every share that matches.")).toBeInTheDocument();
    // Rows of hidden names never cost a FETCH.
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').map((c) => String(c.identifier)).filter((id) => id.includes('spam'))).toEqual([]);
  });

  it('stops after five automatic pages and offers Load more, which keeps focus', async () => {
    hide(['spammer']);
    readOncePerObserve();
    mockFetch('/arbitrary/resources/search', (url) => spamPage(Number(url.searchParams.get('offset'))));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    renderHome();
    expect(await screen.findByText('Every share loaded so far is from a name you hid in Settings.')).toBeInTheDocument();
    const loadMore = await screen.findByRole('button', { name: 'Load more' }, { timeout: 5000 });
    // Page 1, then five pages from the sentinel.
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(6);

    loadMore.focus();
    fireEvent.click(loadMore);
    await waitFor(() => expect(searchAt(120)).toBe(1));
    // The sentinel carries on for another five pages; the button stays put and focused throughout.
    await waitFor(() => expect(searchAt(220)).toBe(1), { timeout: 5000 });
    expect(await screen.findByRole('button', { name: 'Load more' })).toBe(loadMore);
    expect(document.activeElement).toBe(loadMore);
    expect(searchAt(240)).toBe(0);
  });

  it('a new search starts a fresh budget of automatic pages', async () => {
    hide(['spammer']);
    readOncePerObserve();
    mockFetch('/arbitrary/resources/search', (url) => spamPage(Number(url.searchParams.get('offset'))));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    renderHome();
    expect(await screen.findByRole('button', { name: 'Load more' }, { timeout: 5000 })).toBeInTheDocument();
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(6);

    // The old rows stay up while the new search runs, so only a new pager starts over.
    fireEvent.click(screen.getByRole('button', { name: 'Oldest' }));
    await waitFor(() => expect(fetchCallsMatching(/[?&]reverse=false/).length).toBe(6), { timeout: 5000 });
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
  });

  it('says so when every share is from a hidden name', async () => {
    hide(['spammer']);
    mockFetch('/arbitrary/resources/search', spamPage(0, 3));
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });

    renderHome();
    expect(await screen.findByText('Every share here is from a name you hid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings' })).toBeInTheDocument();
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(0);
  });
});
