import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { clearMine } from '../../state/features/collectionsSlice';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetCollectionCaches } from '../../utils/collections';
import { resetInAppHistory } from '../../hooks/useSafeBack';
import { CollectionPage } from './CollectionPage';

const COLLECTION_ID = 'qshare_collection_docs_ab12cd';
const items = [
  { name: 'bob', identifier: 'qshare_file_first_aaa111_metadata' },
  { name: 'carol', identifier: 'qshare_file_second_bbb222_metadata' },
];

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/collection/:name/:id" element={<CollectionPage />} />
      <Route path="/collections" element={<p>Collections list</p>} />
    </Routes>,
    { initialEntries: [`/collection/alice/${COLLECTION_ID}`] }
  );
}

const realMatchMedia = window.matchMedia;
/** Every media query matches, so usePhoneLayout() is true. */
const phoneScreen = () => {
  window.matchMedia = ((query: string) => ({ ...realMatchMedia(query), matches: true })) as typeof window.matchMedia;
};

describe('CollectionPage', () => {
  afterEach(() => {
    window.matchMedia = realMatchMedia;
  });

  beforeEach(() => {
    resetInAppHistory();
    resetQdnSearchCache();
    resetCollectionCaches();
    store.dispatch(clearMine());
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => {
      if (params.identifier === COLLECTION_ID) {
        return { version: 1, title: 'Docs', description: 'Handy files', items, created: 1, updated: 2 };
      }
      return {
        title: String(params.identifier).includes('first') ? 'First share' : 'Second share',
        files: [{ filename: 'a.pdf', identifier: 'f', name: 'bob', service: 'FILE', mimetype: 'application/pdf', size: 10 }],
      };
    });
  });

  it('fetches the collection and one body per item, with no search at all', async () => {
    store.dispatch(addUser(null));
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Docs' })).toBeInTheDocument();
    expect(await screen.findByText('First share')).toBeInTheDocument();
    expect(await screen.findByText('Second share')).toBeInTheDocument();
    expect(screen.getByText('· 2 items')).toBeInTheDocument();
    const fetches = qortalCallsFor('FETCH_QDN_RESOURCE');
    expect(fetches.length).toBe(3);
    expect(fetches.filter((c) => c.identifier === COLLECTION_ID).length).toBe(1);
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(0);
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('lets the owner remove an item by republishing the collection without it', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    await screen.findByText('First share');
    fireEvent.click(screen.getByRole('button', { name: 'Remove First share from collection' }));
    expect(await screen.findByText('Remove from collection?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(qortalCallsFor('PUBLISH_QDN_RESOURCE').length).toBe(1));
    const publish = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(publish).toMatchObject({ service: 'DOCUMENT', name: 'alice', identifier: COLLECTION_ID, tag1: 'qshare_collection_', filename: 'collection.json' });
    const body = JSON.parse(atob(String(publish.data64)));
    expect(body.items).toEqual([items[1]]);
    expect(body.created).toBe(1);
    await waitFor(() => expect(screen.queryByText('First share')).not.toBeInTheDocument());
    expect(screen.getByText('· 1 item')).toBeInTheDocument();
  });

  it('on a phone, Back goes to Collections when the page was opened from a link', async () => {
    phoneScreen();
    // Other Hub tabs' entries share window.history, so its length says nothing about this app.
    window.history.pushState(null, '', '/other-tab');
    store.dispatch(addUser(null));
    renderPage();
    await screen.findByRole('heading', { name: 'Docs' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Collections list')).toBeInTheDocument();
  });
});
