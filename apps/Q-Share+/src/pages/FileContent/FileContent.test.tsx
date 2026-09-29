import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { FileContent } from './FileContent';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetSettingsCache } from '../../utils/settings';
import { store } from '../../state/store';
import { addToHashMap } from '../../state/features/fileSlice';

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
      matches: phone && query === '(max-width:599.95px)',
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

function renderShare() {
  return renderWithProviders(
    <Routes>
      <Route path="/share/:name/:id" element={<FileContent />} />
    </Routes>,
    { initialEntries: [PATH] }
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

  it('on phone width shows the sticky Back button with the title', async () => {
    setMatchMedia(true);
    mockCommentSearches();
    store.dispatch(addToHashMap({ ...body, id: ID, user: NAME, created: searchRow.created }));

    renderShare();

    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Holiday pics').length).toBeGreaterThanOrEqual(2));
  });
});
