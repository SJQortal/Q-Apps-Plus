import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { clearMine } from '../../state/features/collectionsSlice';
import { removeNotification } from '../../state/features/notificationsSlice';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetCollectionCaches } from '../../utils/collections';
import { resetInAppHistory } from '../../hooks/useSafeBack';
import { CollectionPage } from './CollectionPage';

const COLLECTION_ID = 'qshare_collection_docs_ab12cd';
const items = [
  { name: 'bob', identifier: 'qshare_file_first_aaa111_metadata' },
  { name: 'carol', identifier: 'qshare_file_second_bbb222_metadata' },
];

function renderPage(path = `/collection/alice/${COLLECTION_ID}`) {
  return renderWithProviders(
    <Routes>
      <Route path="/collection/:name/:id" element={<CollectionPage />} />
      <Route path="/collections" element={<p>Collections list</p>} />
    </Routes>,
    { initialEntries: [path] }
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

  it("fetches and names each name's share when two names publish under one identifier", async () => {
    const shared = 'qshare_file_same_ccc333_metadata';
    const collectionId = 'qshare_collection_twins_cd34ef';
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    mockQortalAction('FETCH_QDN_RESOURCE', (params) => {
      if (params.identifier === collectionId) {
        const twins = [
          { name: 'bob', identifier: shared },
          { name: 'carol', identifier: shared },
        ];
        return { version: 1, title: 'Twins', description: '', items: twins, created: 1, updated: 2 };
      }
      return { title: params.name === 'bob' ? 'Bob share' : 'Carol share', files: [] };
    });
    renderWithProviders(
      <Routes>
        <Route path="/collection/:name/:id" element={<CollectionPage />} />
      </Routes>,
      { initialEntries: [`/collection/alice/${collectionId}`] }
    );

    expect(await screen.findByText('Bob share')).toBeInTheDocument();
    expect(await screen.findByText('Carol share')).toBeInTheDocument();
    const bodies = qortalCallsFor('FETCH_QDN_RESOURCE').filter((c) => c.identifier === shared);
    expect(bodies.map((c) => c.name).sort()).toEqual(['bob', 'carol']);
    expect(screen.getByRole('button', { name: 'Remove Bob share from collection' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Carol share from collection' })).toBeInTheDocument();
    store.dispatch({ type: 'file/removeFromHashMap', payload: shared });
  });

  it('keeps the item and shows no error when the owner declines the republish in Hub', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    store.dispatch(removeNotification());
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw { error: 'User declined request', message: 'User declined request' };
    });
    renderPage();
    await screen.findByText('First share');
    fireEvent.click(screen.getByRole('button', { name: 'Remove First share from collection' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(qortalCallsFor('PUBLISH_QDN_RESOURCE').length).toBe(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove' })).toBeEnabled());
    expect(store.getState().notifications.alertTypes.alertError).toBe('');
    expect(screen.getByText('· 2 items')).toBeInTheDocument();
  });

  it('keeps the edit form open with no error when the owner declines the publish in Hub', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    store.dispatch(removeNotification());
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw { error: 'User declined request', message: 'User declined request' };
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(await screen.findByText('Edit collection')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(qortalCallsFor('PUBLISH_QDN_RESOURCE').length).toBe(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    expect(screen.getByText('Edit collection')).toBeInTheDocument();
    expect(screen.queryByText('The collection was not saved.')).not.toBeInTheDocument();
    expect(store.getState().notifications.alertTypes.alertError).toBe('');
  });

  it('says the collection was not saved when the publish fails for another reason', async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw { error: 1234, message: 'Insufficient balance' };
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

    expect(await screen.findByText('The collection was not saved.')).toBeInTheDocument();
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

  describe('when the collection is not on the node yet', () => {
    // Core's answer for data it has to ask its peers for, after holding the FETCH for up to ~15 s.
    const unavailable = { error: 1401, message: 'Data unavailable. Please try again later.' };
    const collectionFetches = () => qortalCallsFor('FETCH_QDN_RESOURCE').filter((c) => c.identifier === COLLECTION_ID).length;
    const statusChecks = () => qortalCallsFor('GET_QDN_RESOURCE_STATUS').length;
    const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    beforeEach(() => {
      vi.useFakeTimers();
      store.dispatch(addUser(null));
    });
    afterEach(() => {
      vi.useRealTimers();
      delete (document as { visibilityState?: string }).visibilityState;
    });

    it('says the node is fetching it from peers, checks after 2 and 4 s, and fetches again once it is local', async () => {
      let attempts = 0;
      mockQortalAction('FETCH_QDN_RESOURCE', (params) => {
        if (params.identifier !== COLLECTION_ID) return { title: 'A share', files: [] };
        attempts += 1;
        if (attempts < 2) throw unavailable;
        return { version: 1, title: 'Docs', description: '', items: [], created: 1, updated: 2 };
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () =>
        statusChecks() < 3
          ? { status: 'MISSING_DATA', localChunkCount: 0, totalChunkCount: 2, percentLoaded: 0 }
          : { status: 'DOWNLOADED', localChunkCount: 2, totalChunkCount: 2, percentLoaded: 100 }
      );
      renderPage();
      await wait(0);
      expect(screen.getByText('Not on your node yet')).toBeInTheDocument();
      expect(screen.getByText('Fetching it from peers…')).toBeInTheDocument();
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')[0]).toMatchObject({ service: 'DOCUMENT', name: 'alice', identifier: COLLECTION_ID });

      await wait(1900);
      expect(statusChecks()).toBe(1);
      await wait(100);
      // Still MISSING_DATA: no second FETCH.
      expect(statusChecks()).toBe(2);
      expect(collectionFetches()).toBe(1);
      expect(screen.getByText('Fetching it from peers…')).toBeInTheDocument();
      await wait(4000);
      expect(statusChecks()).toBe(3);
      expect(collectionFetches()).toBe(2);
      expect(screen.getByRole('heading', { name: 'Docs' })).toBeInTheDocument();
    });

    it('waits only while the page is visible, and stops after four status checks with Retry', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw unavailable;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'PUBLISHED' });
      renderPage();
      await wait(0);
      setVisibility('hidden');
      await wait(60_000);
      expect(collectionFetches()).toBe(1);
      expect(statusChecks()).toBe(1);
      setVisibility('visible');
      for (const delay of [2000, 4000, 8000, 16000]) await wait(delay);
      // One FETCH in all: the node never had the data locally.
      expect(collectionFetches()).toBe(1);
      expect(statusChecks()).toBe(5);
      expect(screen.getByText("Your node couldn't get it from its peers yet. Try again in a minute.")).toBeInTheDocument();
      await wait(60_000);
      expect(collectionFetches()).toBe(1);
      expect(statusChecks()).toBe(5);

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await wait(0);
      expect(collectionFetches()).toBe(2);
      expect(screen.getByText('Fetching it from peers…')).toBeInTheDocument();
    });

    it('stops waiting when a status check finds it was never published', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw unavailable;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () => ({ status: statusChecks() < 2 ? 'PUBLISHED' : 'NOT_PUBLISHED' }));
      renderPage();
      await wait(0);
      expect(screen.getByText('Fetching it from peers…')).toBeInTheDocument();
      await wait(2000);
      expect(screen.getByText('Collection not found')).toBeInTheDocument();
      await wait(60_000);
      expect(statusChecks()).toBe(2);
      expect(collectionFetches()).toBe(1);
    });

    it('shows "not found" with no retries when Core has never seen it', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw unavailable;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'NOT_PUBLISHED' });
      renderPage();
      await wait(0);
      expect(screen.getByText('Collection not found')).toBeInTheDocument();
      await wait(60_000);
      expect(collectionFetches()).toBe(1);
    });

    it('asks the status with the name encoded for a name q-apps.js breaks', async () => {
      // Core's JSON 404 for data it hasn't got; q-apps.js would have read Jetty's HTML 400 page.
      mockFetch('/arbitrary/DOCUMENT/', unavailable);
      mockFetch('/arbitrary/resource/status/', { status: 'PUBLISHED', percentLoaded: 0 });
      renderPage(`/collection/${encodeURIComponent('Vallot-/8/')}/${COLLECTION_ID}`);
      await wait(0);
      expect(screen.getByText('Fetching it from peers…')).toBeInTheDocument();
      expect(fetchCallsMatching('/arbitrary/resource/status/')[0]).toBe(
        `/arbitrary/resource/status/DOCUMENT/Vallot-%2F8%2F/${COLLECTION_ID}`
      );
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toEqual([]);
    });

    it('keeps the node error when the status check fails too', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw new Error('Failed to fetch');
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () => {
        throw new Error('Failed to fetch');
      });
      renderPage();
      await wait(0);
      expect(screen.getByText("Couldn't load this collection")).toBeInTheDocument();
      expect(screen.getByText('Check that your node is running, then try again.')).toBeInTheDocument();
    });
  });
});
