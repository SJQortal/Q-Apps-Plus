import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { clearMine } from '../../state/features/collectionsSlice';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetCollectionCaches } from '../../utils/collections';
import { resetInAppHistory } from '../../hooks/useSafeBack';
import { CollectionsPage } from './CollectionsPage';

const alice = { name: 'alice', service: 'DOCUMENT', identifier: 'qshare_collection_docs_ab12cd', updated: 10, metadata: { title: 'Docs', description: 'Handy files' } };
const bob = { name: 'bob', service: 'DOCUMENT', identifier: 'qshare_collection_picks_zz99yy', updated: 20, metadata: { title: "Bob's picks", description: '' } };
const carol = { name: 'carol', service: 'DOCUMENT', identifier: 'qshare_collection_empty_cc00dd', updated: 30, metadata: { title: 'Emptied', description: '' } };
const bodies: Record<string, { title: string; items: Array<{ name: string; identifier: string }> }> = {
  [alice.identifier]: { title: 'Docs', items: [{ name: 'x', identifier: 'a' }, { name: 'x', identifier: 'b' }] },
  [bob.identifier]: { title: "Bob's picks", items: [{ name: 'y', identifier: 'c' }] },
  [carol.identifier]: { title: 'Emptied', items: [] },
};

const realMatchMedia = window.matchMedia;

describe('CollectionsPage', () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  beforeEach(() => {
    resetInAppHistory();
    resetQdnSearchCache();
    resetCollectionCaches();
    store.dispatch(clearMine());
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
  });

  it('lists my collections with one paged search, then everyone’s on the All tab', async () => {
    mockFetch('/arbitrary/resources/search', (url) => (url.searchParams.get('name') === 'alice' ? [alice] : [alice, bob, carol]));
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => ({
      version: 1,
      description: '',
      created: 1,
      updated: 2,
      ...bodies[String(params.identifier)],
    }));

    renderWithProviders(<CollectionsPage />, { initialEntries: ['/collections'] });

    expect(await screen.findByRole('button', { name: 'Open Docs' })).toBeInTheDocument();
    expect(await screen.findByText('2 items')).toBeInTheDocument();
    const [first] = fetchCallsMatching('/arbitrary/resources/search');
    expect(first).toContain('name=alice');
    expect(first).toContain('identifier=qshare_collection_');
    expect(first).toContain('limit=20');
    expect(first).not.toMatch(/limit=0\b/);
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(1);
    // The first page is shared with the Save-to-collection buttons.
    expect(store.getState().collections.mine?.length).toBe(1);

    fireEvent.click(screen.getByRole('tab', { name: 'All' }));
    expect(await screen.findByRole('button', { name: "Open Bob's picks" })).toBeInTheDocument();
    expect(await screen.findByText('1 item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Docs' })).toBeInTheDocument();
    // Carol's collection was "deleted" (republished with no items): once its body is known it stays out of All.
    await waitFor(() => expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(3));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Emptied' })).not.toBeInTheDocument());
    // Bodies came from the search rows: one search per tab, none per collection, none unlimited.
    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.length).toBe(2);
    expect(searches[1]).not.toContain('name=');
    expect(searches[1]).toContain('limit=20');
  });

  it('shows the empty state and the New collection button when I have none', async () => {
    mockFetch('/arbitrary/resources/search', []);
    renderWithProviders(<CollectionsPage />, { initialEntries: ['/collections'] });
    expect(await screen.findByText('No collections yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'New collection' }).length).toBeGreaterThan(0);
  });

  it('shows an error state with Retry when the search fails', async () => {
    let calls = 0;
    mockFetch('/arbitrary/resources/search', () => {
      calls += 1;
      if (calls === 1) throw new Error('node down');
      return [alice];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { version: 1, title: 'Docs', description: '', items: [], created: 1, updated: 2 });
    renderWithProviders(<CollectionsPage />, { initialEntries: ['/collections'] });
    expect(await screen.findByText("Couldn't load collections")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Open Docs' })).toBeInTheDocument();
  });

  it('on a phone, Back goes Home when Collections was opened directly', async () => {
    // Every media query matches, so usePhoneLayout() is true.
    window.matchMedia = ((query: string) => ({ ...realMatchMedia(query), matches: true })) as typeof window.matchMedia;
    // Other Hub tabs' entries share window.history, so its length says nothing about this app.
    window.history.pushState(null, '', '/other-tab');
    mockFetch('/arbitrary/resources/search', []);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/collections" element={<CollectionsPage />} />
      </Routes>,
      { initialEntries: ['/collections'] }
    );
    await screen.findByText('No collections yet');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});
