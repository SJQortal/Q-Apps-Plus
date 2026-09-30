import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { categoriesFromQdnDescription, shareTitleFromIdentifier, summaryToVideo, useFetchFiles } from './useFetchFiles';
import { store } from '../state/store';
import { addToHashMap } from '../state/features/fileSlice';
import { mockQortalAction, qortalCallsFor } from '../test/setup';

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
