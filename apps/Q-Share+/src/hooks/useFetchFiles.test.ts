import { describe, expect, it } from 'vitest';
import { categoriesFromQdnDescription, shareTitleFromIdentifier, summaryToVideo } from './useFetchFiles';

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
