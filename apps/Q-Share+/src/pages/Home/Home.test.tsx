import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { addUser } from '../../state/features/authSlice';
import { addFiles } from '../../state/features/fileSlice';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { Home } from './Home';
import { store } from '../../state/store';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';

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

describe('Home first load', () => {
  it('runs exactly one paged search and one FETCH per row, then shows the rows', async () => {
    resetQdnSearchCache();
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
    expect(searches[0]).not.toMatch(/limit=0\b/);
    // Three rows came back (fewer than a page), so the list says it is complete.
    expect(await screen.findByText("That's every share that matches.")).toBeInTheDocument();
  });

  it('the Following chip re-runs the search with followedonly=true and hidden names are filtered', async () => {
    resetQdnSearchCache();
    store.dispatch(addFiles([]));
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
    localStorage.setItem('qshareplus-settings', JSON.stringify({ hiddenNames: ['spammer'] }));
    const { resetSettingsCache } = await import('../../utils/settings');
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
