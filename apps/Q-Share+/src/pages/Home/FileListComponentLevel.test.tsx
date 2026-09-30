import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { FileListComponentLevel } from './FileListComponentLevel';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { readOncePerObserve } from '../../test/intersection';

function renderProfile(name: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/channel/:name" element={<FileListComponentLevel />} />
    </Routes>,
    { initialEntries: [`/channel/${encodeURIComponent(name)}`] }
  );
}

describe('profile share list', () => {
  it('searches with metadata and says the name is empty when every share was deleted', async () => {
    resetQdnSearchCache();
    mockFetch('/arbitrary/resources/search', [
      { name: 'Claude', service: 'DOCUMENT', identifier: 'qshare_file_torq-test_Pr0f1a_metadata', created: 2, metadata: { title: 'Torq Test' } },
      { name: 'Claude', service: 'DOCUMENT', identifier: 'qshare_file_torq-test_Pr0f1b_metadata', created: 1, metadata: { title: 'Torq Test 2' } },
    ]);
    mockQortalAction('FETCH_QDN_RESOURCE', 'D');

    renderProfile('Claude');

    expect(await screen.findByText('No shares from this name yet')).toBeInTheDocument();
    expect(screen.queryByText('Torq Test')).not.toBeInTheDocument();
    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.length).toBe(1);
    expect(searches[0]).toContain('includemetadata=true');
    expect(searches[0]).toContain('name=Claude');
    // Prefix match on the identifier, like Home, not a free-text query.
    const params = new URL(searches[0], 'http://localhost').searchParams;
    expect(params.get('identifier')).toBe('qshare_file_');
    expect(params.has('query')).toBe(false);
    expect(params.get('limit')).toBe('20');
  });

  it('a failed next page stops the pager and offers Retry instead of repeating the search', async () => {
    resetQdnSearchCache();
    readOncePerObserve();
    const row = (slug: string, created: number, title: string) => ({
      name: 'Bob',
      service: 'DOCUMENT',
      identifier: `qshare_file_${slug}_${slug.slice(-6).padStart(6, 'x')}_metadata`,
      created,
      metadata: { title },
    });
    let nodeDown = true;
    mockFetch('/arbitrary/resources/search', (url) => {
      if (url.searchParams.get('offset') === '0') return Array.from({ length: 20 }, (_, i) => row(`bob-${i}`, 100 - i, `Bob share ${i}`));
      if (nodeDown) throw new Error('node down');
      return [row('bob-last', 1, 'Bob last share')];
    });
    mockQortalAction('FETCH_QDN_RESOURCE', { files: [] });
    const pageTwo = () => fetchCallsMatching(/[?&]offset=20&/).length;

    renderProfile('Bob');

    // Twenty rows and their bodies render first, which is slow in jsdom under a full parallel run.
    expect(await screen.findByText('Could not load more shares.', {}, { timeout: 4000 })).toBeInTheDocument();
    // The sentinel stays in view, but a failed page is tried once, not five times back to back.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pageTwo()).toBe(1);
    expect(screen.getByText('Bob share 0')).toBeInTheDocument();

    nodeDown = false;
    const retry = screen.getByRole('button', { name: 'Retry' });
    retry.focus();
    fireEvent.click(retry);
    expect(await screen.findByText('Bob last share', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(pageTwo()).toBe(2);
    expect(screen.queryByText('Could not load more shares.')).not.toBeInTheDocument();
    // Focus moves on to the row that page added, not to the top of the document.
    expect(document.activeElement).toBe(screen.getByText('Bob last share').closest('button'));
  });
});
