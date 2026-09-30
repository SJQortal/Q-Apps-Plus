import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { FileContent } from './FileContent';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetSettingsCache } from '../../utils/settings';
import { store } from '../../state/store';
import { addToHashMap } from '../../state/features/fileSlice';
import { addUser } from '../../state/features/authSlice';
import { resetInAppHistory } from '../../hooks/useSafeBack';

const NAME = 'alice b';
const ID = 'qshare_file_holiday-pics_abcdefghijkl_metadata';
const PATH = `/share/${encodeURIComponent(NAME)}/${encodeURIComponent(ID)}`;

const searchRow = {
  name: NAME,
  service: 'DOCUMENT',
  identifier: ID,
  created: Date.now() - 3_600_000,
  updated: Date.now() - 3_600_000,
  metadata: { title: 'Holiday pics', description: '**cat:6;sub:1**' },
};

const body = {
  title: 'Holiday pics',
  version: 1,
  fullDescription: 'Photos from the trip',
  htmlDescription: '<p>Photos from the trip</p>',
  commentsId: 'qshare_file__cm_abcdefghijkl',
  category: '6',
  files: [
    { filename: 'beach.jpg', identifier: 'qshare_file_holiday-pics_f1', name: NAME, service: 'FILE', mimetype: 'image/jpeg', size: 6 * 1024 * 1024 },
    { filename: 'notes.txt', identifier: 'qshare_file_holiday-pics_f2', name: NAME, service: 'FILE', mimetype: 'text/plain', size: 900 },
    { filename: 'trip.zip', identifier: 'qshare_file_holiday-pics_f3', name: NAME, service: 'FILE', mimetype: 'application/zip', size: 40_000 },
  ],
};

function setMatchMedia(phone: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: phone && query.includes('599.95'),
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
}

/** Under fake timers: let the chained qortalRequest promises settle. */
async function flush() {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0);
}

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
  document.dispatchEvent(new Event('visibilitychange'));
}

function renderShare(path = PATH) {
  return renderWithProviders(
    <Routes>
      <Route path="/share/:name/:id" element={<FileContent />} />
    </Routes>,
    { initialEntries: [path] }
  );
}

function mockCommentSearches() {
  mockFetch(/service=BLOG_COMMENT/, []);
}

describe('FileContent (share page)', () => {
  beforeEach(() => {
    resetQdnSearchCache();
    resetSettingsCache();
    setMatchMedia(false);
    mockQortalAction('GET_LIST_ITEMS', []);
  });

  afterEach(() => {
    setMatchMedia(false);
  });

  it('cold open: one limit-1 search plus one FETCH_QDN_RESOURCE, then the title and files', async () => {
    mockFetch('/arbitrary/resources/search', [searchRow]);
    mockCommentSearches();
    mockQortalAction('FETCH_QDN_RESOURCE', body);

    renderShare();

    expect(screen.getByLabelText('Loading share')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Holiday pics' })).toBeInTheDocument();
    expect(screen.getByText('beach.jpg')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByText('trip.zip')).toBeInTheDocument();
    expect(screen.getByText('3 files')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shares by alice b' })).toBeInTheDocument();

    const documentSearches = fetchCallsMatching(/service=DOCUMENT/);
    expect(documentSearches.length).toBe(1);
    expect(documentSearches[0]).toContain('limit=1');
    expect(documentSearches[0]).toContain('name=alice+b');
    expect(documentSearches[0]).toContain(`identifier=${ID}`);
    expect(documentSearches[0]).not.toMatch(/limit=0\b/);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(1);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')[0]).toMatchObject({ name: NAME, service: 'DOCUMENT', identifier: ID });
    // Nothing on the page fetched a file: the image is over 5 MB and text waits for a tap.
    expect(fetchCallsMatching('/arbitrary/FILE/').length).toBe(0);
    // Every row starts with a Download button; nothing polls until one is pressed.
    expect(screen.getAllByRole('button', { name: /^Download / }).length).toBe(3);
    expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS').length).toBe(0);
    expect(screen.getByRole('button', { name: 'Fetch all files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('warm open: a share already in hashMapFiles renders with no search and no FETCH', async () => {
    mockCommentSearches();
    store.dispatch(addToHashMap({ ...body, id: ID, user: NAME, created: searchRow.created }));

    renderShare();

    expect(await screen.findByRole('heading', { level: 1, name: 'Holiday pics' })).toBeInTheDocument();
    expect(screen.getByText('beach.jpg')).toBeInTheDocument();
    expect(fetchCallsMatching(/service=DOCUMENT/).length).toBe(0);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(0);
  });

  it('shows "Share not found" with a way home when the node returns nothing', async () => {
    store.dispatch({ type: 'file/removeFromHashMap', payload: ID });
    mockFetch('/arbitrary/resources/search', []);
    mockCommentSearches();

    renderShare();

    expect(await screen.findByText('Share not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to all shares' })).toBeInTheDocument();
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(0);
  });

  it('shows an error state with Retry when the search fails, and recovers', async () => {
    let fail = true;
    mockFetch('/arbitrary/resources/search', () => {
      if (fail) throw new Error('node down');
      return [searchRow];
    });
    mockCommentSearches();
    mockQortalAction('FETCH_QDN_RESOURCE', body);

    renderShare();

    expect(await screen.findByText('This share could not be loaded')).toBeInTheDocument();
    fail = false;
    resetQdnSearchCache();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Holiday pics' })).toBeInTheDocument();
  });

  describe('when the JSON is not on the node yet', () => {
    const unavailable = { error: 1401, message: 'Data unavailable. Please try again later.' };

    beforeEach(() => {
      store.dispatch({ type: 'file/removeFromHashMap', payload: ID });
      mockFetch('/arbitrary/resources/search', [searchRow]);
      mockCommentSearches();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });

    afterEach(() => {
      vi.useRealTimers();
      setVisibility('visible');
    });

    it('says it is fetching from peers, re-checks the status with backoff and loads once it is local', async () => {
      let local = false;
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        if (!local) throw unavailable;
        return body;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () =>
        local ? { status: 'READY', percentLoaded: 100 } : { status: 'MISSING_DATA', percentLoaded: 50 }
      );

      renderShare();
      await flush();
      expect(screen.getByText('Not on your node yet')).toBeInTheDocument();
      expect(screen.getByText('Fetching it from peers… 50%')).toBeInTheDocument();
      expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toHaveLength(1);
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(1);

      // Still missing after 2 s: only the status is asked again, not the FETCH.
      await vi.advanceTimersByTimeAsync(2_000);
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(2);
      expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toHaveLength(1);

      local = true;
      await vi.advanceTimersByTimeAsync(4_000);
      expect(screen.getByRole('heading', { level: 1, name: 'Holiday pics' })).toBeInTheDocument();
      expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toHaveLength(2);
      // One search in all: the retries reuse it.
      expect(fetchCallsMatching(/service=DOCUMENT/)).toHaveLength(1);
    });

    it('gives up after the last wait with a Retry, and holds the checks while the tab is hidden', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw unavailable;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'PUBLISHED', percentLoaded: 0 });

      renderShare();
      await flush();
      expect(screen.getByText('Fetching it from peers…')).toBeInTheDocument();

      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(1);
      setVisibility('visible');
      await flush();
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(2);

      await vi.advanceTimersByTimeAsync(4_000 + 8_000 + 16_000);
      await flush();
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(5);
      expect(screen.getByText("This share isn't on your node yet")).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(qortalCallsFor('GET_QDN_RESOURCE_STATUS')).toHaveLength(5);

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await flush();
      expect(screen.getByText('Not on your node yet')).toBeInTheDocument();
      expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toHaveLength(2);
    });

    it('shows "Share not found" when the node says it was never published', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw unavailable;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'NOT_PUBLISHED' });
      renderShare();
      await flush();
      expect(screen.getByText('Share not found')).toBeInTheDocument();
    });

    it('keeps the node-down error when the status cannot be read either', async () => {
      mockQortalAction('FETCH_QDN_RESOURCE', () => {
        throw unavailable;
      });
      mockQortalAction('GET_QDN_RESOURCE_STATUS', () => {
        throw new Error('offline');
      });
      renderShare();
      await flush();
      expect(screen.getByText('This share could not be loaded')).toBeInTheDocument();
    });
  });

  it('says a share was deleted when its body is a delete marker such as "D"', async () => {
    store.dispatch({ type: 'file/removeFromHashMap', payload: ID });
    mockFetch('/arbitrary/resources/search', [searchRow]);
    mockCommentSearches();
    mockQortalAction('FETCH_QDN_RESOURCE', 'D');

    renderShare();

    expect(await screen.findByText('This share was deleted by its publisher')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to all shares' })).toBeInTheDocument();
    expect(screen.queryByText('No files in this share')).not.toBeInTheDocument();
  });

  it('says a share was deleted when the list already marked it so, with no calls', async () => {
    mockCommentSearches();
    store.dispatch(addToHashMap({ id: ID, user: NAME, title: 'Torq Test', isValid: false, deleted: true }));

    renderShare();

    expect(await screen.findByText('This share was deleted by its publisher')).toBeInTheDocument();
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toHaveLength(0);
    store.dispatch({ type: 'file/removeFromHashMap', payload: ID });
  });

  describe('action row', () => {
    const single = { ...body, files: [body.files[0]] };

    afterEach(() => {
      store.dispatch(addUser(null));
      store.dispatch({ type: 'file/removeFromHashMap', payload: ID });
    });

    it('has no header Fetch button for a single file (its row has Download)', async () => {
      mockCommentSearches();
      store.dispatch(addToHashMap({ ...single, id: ID, user: NAME, created: searchRow.created }));
      renderShare();
      expect(await screen.findByRole('heading', { level: 1, name: 'Holiday pics' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Fetch/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download beach.jpg' })).toBeInTheDocument();
    });

    it('on phones puts Copy link, Add to collection and Follow in one compact row', async () => {
      setMatchMedia(true);
      store.dispatch(addUser({ address: 'Qc', publicKey: 'k', name: 'carol', names: [{ name: 'carol', owner: 'Qc' }] }));
      mockFetch('/arbitrary/resources/search', []);
      mockCommentSearches();
      store.dispatch(addToHashMap({ ...single, id: ID, user: NAME, created: searchRow.created }));
      renderShare();

      const group = await screen.findByRole('group', { name: 'Share actions' });
      const buttons = within(group).getAllByRole('button');
      expect(buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
        'Copy link',
        'Add to collection',
        'Follow alice b',
      ]);
      expect(within(group).getByRole('button', { name: 'Add to collection' })).toHaveTextContent('Collect');
      expect(screen.queryByRole('button', { name: /^Fetch/ })).not.toBeInTheDocument();
    });

    it("on phones offers Edit for the signed-in user's own share", async () => {
      setMatchMedia(true);
      store.dispatch(addUser({ address: 'Qa', publicKey: 'k', name: NAME, names: [{ name: NAME, owner: 'Qa' }] }));
      mockFetch('/arbitrary/resources/search', []);
      mockCommentSearches();
      store.dispatch(addToHashMap({ ...body, id: ID, user: NAME, created: searchRow.created }));
      renderShare();

      const group = await screen.findByRole('group', { name: 'Share actions' });
      expect(within(group).getByRole('button', { name: 'Edit share' })).toHaveTextContent('Edit');
      expect(within(group).queryByRole('button', { name: /Follow/ })).not.toBeInTheDocument();
      // Three files: Fetch all stays a full-width button above the row.
      expect(screen.getByRole('button', { name: 'Fetch all files' })).toBeInTheDocument();
    });
  });

  it('on phone width shows the sticky Back button with the title', async () => {
    setMatchMedia(true);
    mockCommentSearches();
    store.dispatch(addToHashMap({ ...body, id: ID, user: NAME, created: searchRow.created }));

    renderShare();

    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Holiday pics').length).toBeGreaterThanOrEqual(2));
  });

  it('Back on a deep-linked share goes to Home, not through the history Hub tabs share', async () => {
    setMatchMedia(true);
    resetInAppHistory();
    mockCommentSearches();
    store.dispatch(addToHashMap({ ...body, id: ID, user: NAME, created: searchRow.created }));
    // Other tabs' entries make history.length > 1 even on a first load, and
    // the entry before this one is not the app's (here: some other page).
    const length = vi.spyOn(window.history, 'length', 'get').mockReturnValue(5);

    renderWithProviders(
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/elsewhere" element={<p>Not this app</p>} />
        <Route path="/share/:name/:id" element={<FileContent />} />
      </Routes>,
      { initialEntries: ['/elsewhere', PATH] }
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Not this app')).not.toBeInTheDocument();
    length.mockRestore();
  });

  it("the body can't change whose share it is, its identifier or its dates", async () => {
    const id = 'qshare_file_spoofed_Sp1234_metadata';
    mockFetch('/arbitrary/resources/search', [{ ...searchRow, identifier: id }]);
    mockQortalAction('FETCH_QDN_RESOURCE', {
      ...body,
      id: ID,
      user: 'mallory',
      updated: 9_999_999_999_999,
      deleted: true,
    });
    mockCommentSearches();

    renderShare(`/share/${encodeURIComponent(NAME)}/${id}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Holiday pics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shares by alice b' })).toBeInTheDocument();
    const held = store.getState().file.hashMapFiles[id];
    expect(held).toMatchObject({ id, user: NAME, updated: searchRow.updated, isValid: true });
    expect(held.deleted).toBeUndefined();
    expect(store.getState().file.hashMapFiles[ID]?.user).not.toBe('mallory');
    store.dispatch({ type: 'file/removeFromHashMap', payload: id });
  });

  it('an error page instead of the body offers Retry rather than "deleted", and stores nothing', async () => {
    const id = 'qshare_file_error-page_Er1234_metadata';
    mockFetch('/arbitrary/resources/search', [{ ...searchRow, identifier: id }]);
    mockQortalAction('FETCH_QDN_RESOURCE', '<html><body><h1>502 Bad Gateway</h1></body></html>');
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' });
    mockCommentSearches();

    renderShare(`/share/${encodeURIComponent(NAME)}/${id}`);

    expect(await screen.findByText('This share could not be loaded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByText(/deleted by its publisher/)).not.toBeInTheDocument();
    expect(store.getState().file.hashMapFiles[id]).toBeUndefined();
  });

  it('a name with "/" fetches its body with the name encoded, as a deep link or reload opens it', async () => {
    const name = 'Vallot-/8/';
    const id = 'qshare_file_qortal-corei-settingsjson-fail_WGvzlh_metadata';
    mockFetch('/arbitrary/resources/search', [{ ...searchRow, name, identifier: id, metadata: { title: "Qortal Core'i settings.json faili asukoht" } }]);
    mockFetch('/arbitrary/DOCUMENT/', {
      title: "Qortal Core'i settings.json faili asukoht",
      files: [{ filename: 'juhend.pdf', identifier: 'qshare_file_x_f1', name, service: 'FILE', mimetype: 'application/pdf', size: 628_000 }],
    });
    mockCommentSearches();

    renderShare(`/share/${encodeURIComponent(name)}/${id}`);

    expect(await screen.findByText('juhend.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 file')).toBeInTheDocument();
    expect(fetchCallsMatching('/arbitrary/DOCUMENT/')).toEqual([`/arbitrary/DOCUMENT/Vallot-%2F8%2F/${id}`]);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toEqual([]);
    expect(store.getState().file.hashMapFiles[id]).toMatchObject({ user: name, files: [{ filename: 'juhend.pdf' }] });
  });
});
