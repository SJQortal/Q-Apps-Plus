import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetCollectionCaches } from '../../utils/collections';
import { readSettings, resetSettingsCache } from '../../utils/settings';
import { IndividualProfile } from './IndividualProfile';

describe('IndividualProfile', () => {
  beforeEach(() => {
    resetQdnSearchCache();
    resetCollectionCaches();
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'me', names: [{ name: 'me', owner: 'Qabc' }] }));
    mockQortalAction('GET_LIST_ITEMS', []);
  });

  it('loads collections only when the Collections tab is opened, with one search for that name', async () => {
    mockFetch('/arbitrary/resources/search', (url) => {
      if ((url.searchParams.get('identifier') || '').startsWith('qshare_collection_')) {
        return [
          { name: 'alice', service: 'DOCUMENT', identifier: 'qshare_collection_photos_ab12cd', updated: 10, metadata: { title: 'Photos', description: '' } },
        ];
      }
      return [];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { version: 1, title: 'Photos', description: '', items: [{ name: 'alice', identifier: 'qshare_file_x_metadata' }], created: 1, updated: 10 });

    renderWithProviders(
      <Routes>
        <Route path="/channel/:name" element={<IndividualProfile />} />
      </Routes>,
      { initialEntries: ['/channel/alice'] }
    );
    expect(await screen.findByRole('heading', { name: 'alice' })).toBeInTheDocument();
    await waitFor(() => expect(fetchCallsMatching(/identifier=qshare_file_/).length).toBe(1));
    expect(fetchCallsMatching(/identifier=qshare_collection_/).length).toBe(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Collections' }));
    expect(await screen.findByRole('button', { name: 'Open Photos' })).toBeInTheDocument();
    const searches = fetchCallsMatching(/identifier=qshare_collection_/);
    expect(searches.length).toBe(1);
    expect(searches[0]).toContain('name=alice');
    expect(await screen.findByText("That's every collection by alice.")).toBeInTheDocument();
  });

  it('switches the shares between rows and cards from the Shares tab, with no new search', async () => {
    resetSettingsCache();
    try {
      mockFetch('/arbitrary/resources/search', [
        { name: 'dave', service: 'DOCUMENT', identifier: 'qshare_file_maps_Dv0001_metadata', created: 2, metadata: { title: 'Maps' } },
      ]);
      mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Maps', files: [{ size: 10 }] });
      const { container } = renderWithProviders(
        <Routes>
          <Route path="/channel/:name" element={<IndividualProfile />} />
        </Routes>,
        { initialEntries: ['/channel/dave'] }
      );
      expect(await screen.findByRole('button', { name: 'Open Maps' })).toBeInTheDocument();
      expect(container.querySelectorAll('li.share-card')).toHaveLength(0);
      // On a phone too narrow for both, the toggle wraps under the tabs instead of covering Collections.
      const tabsRow = screen.getByRole('tablist').closest('.MuiTabs-root')!.parentElement!;
      expect(getComputedStyle(tabsRow).flexWrap).toBe('wrap');
      expect(tabsRow).toContainElement(screen.getByRole('button', { name: 'Grid' }));

      fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
      expect(readSettings().listView).toBe('grid');
      expect(container.querySelectorAll('li.share-card')).toHaveLength(1);
      // Every card here is dave's: no publisher link on each.
      expect(screen.getByRole('button', { name: 'Open Maps' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Shares by dave' })).not.toBeInTheDocument();
      expect(fetchCallsMatching(/identifier=qshare_file_/).length).toBe(1);

      // Collections have their own list: no layout toggle there.
      mockFetch('/arbitrary/resources/search', []);
      fireEvent.click(screen.getByRole('tab', { name: 'Collections' }));
      expect(screen.queryByRole('button', { name: 'Grid' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Shares' }));
      expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    } finally {
      resetSettingsCache();
    }
  });
});
