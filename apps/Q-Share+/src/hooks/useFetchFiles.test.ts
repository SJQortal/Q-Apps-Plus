import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { categoriesFromQdnDescription, shareTitleFromIdentifier, summaryToVideo, useFetchFiles, useListedFiles } from './useFetchFiles';
import { store } from '../state/store';
import { addFiles, addToHashMap, heldShare, markUnavailable, shareKey, type Video } from '../state/features/fileSlice';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../test/setup';
import { resetQdnSearchCache } from '../utils/qdnSearch';

describe('share rows from search summaries', () => {
  it('derives a readable title from the identifier when there is no metadata', () => {
    expect(shareTitleFromIdentifier('qshare_file_qorterminator-2-visual_WiRAxt_metadata')).toBe('Qorterminator 2 visual');
    expect(shareTitleFromIdentifier('qshare_file_test-publish-zip-file-to-qdn_iqW728_metadata')).toBe('Test publish zip file to qdn');
    expect(shareTitleFromIdentifier('qshare_file__abc123_metadata')).toBe('Untitled share');
  });

  it('reads the category ids Q-Share writes at the start of the QDN description', () => {
    expect(categoriesFromQdnDescription('**cat:4;sub:421**154MB, 1h6m35s')).toEqual({ category: '4', subcategory: '421' });
    expect(categoriesFromQdnDescription('**cat:1;sub:102;sub2:10201**text')).toEqual({
      category: '1',
      subcategory: '102',
      subcategory2: '10201',
    });
    expect(categoriesFromQdnDescription('no prefix here')).toEqual({});
    expect(categoriesFromQdnDescription(undefined)).toEqual({});
  });

  it('builds a row with the metadata title, date and category', () => {
    const row = summaryToVideo({
      name: 'PixelMage',
      service: 'DOCUMENT',
      identifier: 'qshare_file_x_QZCTvL_metadata',
      created: 1790736155034,
      metadata: { title: 'Pastor J.B. Hixson - Calvinism 002 - Part 1 - Depr', description: '**cat:4;sub:421**154MB' },
    });
    expect(row).toMatchObject({
      title: 'Pastor J.B. Hixson - Calvinism 002 - Part 1 - Depr',
      created: 1790736155034,
      user: 'PixelMage',
      id: 'qshare_file_x_QZCTvL_metadata',
      category: '4',
      subcategory: '421',
    });
  });
});

describe('queued body fetches', () => {
  it('skip a share the store got while they waited, unless the row is newer', async () => {
    const id = 'qshare_file_opened-early_Op1234_metadata';
    const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
    const { result } = renderHook(() => useFetchFiles(), { wrapper });
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Newer', files: [] });

    // The share page fetched it after the row was queued.
    store.dispatch(addToHashMap({ id, user: 'alice', title: 'Opened early', files: [], updated: 5 }));
    await result.current.getFile('alice', id, { id, user: 'alice', updated: 5 });
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toEqual([]);

    // A search that says the share changed since still fetches it.
    await result.current.getFile('alice', id, { id, user: 'alice', updated: 6 });
    expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(1);
    expect(store.getState().file.hashMapFiles[id]).toMatchObject({ title: 'Newer', isValid: true });
  });
});

describe('a body another name published under the same identifier', () => {
  const id = 'qshare_file_reused_Re1234_metadata';
  const alice: Video = { id, user: 'Alice', title: 'Holiday', description: '', created: 1, updated: 5 };
  const mallory: Video = { id, user: 'mallory', title: 'Holiday', description: '', created: 2, updated: 9 };
  const rows = [mallory, alice];

  it("is not this share's: the row fetches its own body and only the other name's row is dropped", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
    const { result } = renderHook(() => ({ fetch: useFetchFiles(), listed: useListedFiles(rows) }), { wrapper });
    // mallory's copy is a delete marker; Home fetched it first.
    store.dispatch(addToHashMap({ ...mallory, isValid: false, deleted: true }));
    await waitFor(() => expect(result.current.listed).toEqual([alice]));
    expect(result.current.fetch.checkAndUpdateFile(alice)).toBe(true);

    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Holiday pics', files: [] });
    await result.current.fetch.getFile('Alice', id, alice);
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toEqual([expect.objectContaining({ name: 'Alice', identifier: id })]);
    // Both bodies stay: neither evicts the other.
    const file = store.getState().file;
    expect(heldShare(file, 'Alice', id)).toMatchObject({ user: 'Alice', title: 'Holiday pics', isValid: true });
    expect(heldShare(file, 'mallory', id)).toMatchObject({ user: 'mallory', deleted: true });
    expect(result.current.listed).toEqual([alice]);
    // Names are one name whatever their case.
    expect(result.current.fetch.checkAndUpdateFile({ ...alice, user: 'alice' })).toBe(false);
    expect(result.current.fetch.checkAndUpdateFile(mallory)).toBe(false);
    store.dispatch({ type: 'file/removeFromHashMap', payload: id });
    expect(heldShare(store.getState().file, 'Alice', id)).toBeUndefined();
  });

  it('queues a body per name, however the two land, and marks only the failing one unavailable', async () => {
    const reused = 'qshare_file_reused-queue_Rq1234_metadata';
    const a: Video = { ...alice, id: reused };
    const m: Video = { ...mallory, id: reused };
    const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
    const { result } = renderHook(() => ({ fetch: useFetchFiles(), listed: useListedFiles([m, a]) }), { wrapper });
    mockQortalAction('FETCH_QDN_RESOURCE', (params) =>
      params.name === 'mallory' ? 'D' : { title: 'Holiday pics', files: [{ filename: 'beach.jpg', size: 10 }] }
    );

    result.current.fetch.queueBodies([m, a]);

    await waitFor(() => expect(result.current.listed).toEqual([a]));
    await waitFor(() => expect(heldShare(store.getState().file, 'Alice', reused)).toMatchObject({ isValid: true }));
    const fetches = qortalCallsFor('FETCH_QDN_RESOURCE');
    expect(fetches).toHaveLength(2);
    expect(fetches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'mallory', identifier: reused }),
        expect.objectContaining({ name: 'Alice', identifier: reused }),
      ])
    );
    expect(heldShare(store.getState().file, 'mallory', reused)).toMatchObject({ isValid: false, deleted: true });

    // Coming back to the list fetches neither again.
    result.current.fetch.queueBodies([m, a], false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(qortalCallsFor('FETCH_QDN_RESOURCE')).toHaveLength(2);

    // One name's failed fetch says nothing about the other's.
    store.dispatch(markUnavailable({ user: 'mallory', id: reused }));
    expect(store.getState().file.unavailableFiles[shareKey('mallory', reused)]).toBe(true);
    expect(store.getState().file.unavailableFiles[shareKey('Alice', reused)]).toBeUndefined();
    store.dispatch({ type: 'file/removeFromHashMap', payload: reused });
  });
});

describe('a list of shares by several names', () => {
  it('searches with one name= per name, exact, paged, in place of the single name', async () => {
    resetQdnSearchCache();
    store.dispatch(addFiles([]));
    mockFetch('/arbitrary/resources/search', (url) => {
      const offset = Number(url.searchParams.get('offset'));
      return Array.from({ length: offset === 0 ? 20 : 1 }, (_, i) => ({
        name: i % 2 ? 'Simon James' : 'Q-Share+',
        service: 'DOCUMENT',
        identifier: `qshare_file_mine-${offset + i}_Mn${String(offset + i).padStart(4, '0')}_metadata`,
        created: 100 - offset - i,
      }));
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(Provider, { store, children });
    const { result } = renderHook(() => useFetchFiles(), { wrapper });
    const filters = { name: 'Simon James', names: ['Simon James', 'Q-Share+'] };

    await act(() => result.current.getFiles(filters, true));
    await act(() => result.current.getFiles(filters, false));

    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches).toEqual([
      '/arbitrary/resources/search?mode=ALL&service=DOCUMENT&identifier=qshare_file_&name=Simon+James&name=Q-Share%2B&limit=20&offset=0&includemetadata=true&reverse=true&excludeblocked=true&exactmatchnames=true',
      '/arbitrary/resources/search?mode=ALL&service=DOCUMENT&identifier=qshare_file_&name=Simon+James&name=Q-Share%2B&limit=20&offset=20&includemetadata=true&reverse=true&excludeblocked=true&exactmatchnames=true',
    ]);
    expect(store.getState().file.files).toHaveLength(21);
    store.dispatch(addFiles([]));
  });
});
