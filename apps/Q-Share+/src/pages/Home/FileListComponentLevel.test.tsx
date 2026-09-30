import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { FileListComponentLevel } from './FileListComponentLevel';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { QDN_SEARCH_TTL_MS, resetQdnSearchCache } from '../../utils/qdnSearch';
import { resetSettingsCache, writeSettings } from '../../utils/settings';
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

  it('in the grid layout, loads with placeholder cards and then shows a card per share', async () => {
    resetQdnSearchCache();
    writeSettings({ listView: 'grid' });
    onTestFinished(() => resetSettingsCache());
    let answer!: (rows: unknown) => void;
    const rows = new Promise((resolve) => (answer = resolve));
    mockFetch('/arbitrary/resources/search', () => rows);
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Grid one', files: [{ size: 10 }] });

    const { container } = renderProfile('Gina');
    const loading = await screen.findByRole('list', { name: 'Loading shares' });
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading.querySelectorAll('li')).toHaveLength(6);

    answer([{ name: 'Gina', service: 'DOCUMENT', identifier: 'qshare_file_grid-one_Gi0001_metadata', created: 1, metadata: { title: 'Grid one' } }]);
    expect(await screen.findByRole('button', { name: 'Open Grid one' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Loading shares' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('li.share-card')).toHaveLength(1);
    expect(await screen.findByText(/1 file · 10 B/)).toBeInTheDocument();
  });
});

describe('profile share bodies', () => {
  const share = (name: string, slug: string, title: string) => ({
    name,
    service: 'DOCUMENT',
    identifier: `qshare_file_${slug}_${slug.slice(-6).padStart(6, 'x')}_metadata`,
    created: 1,
    metadata: { title },
  });
  const fetchesOf = (slug: string) =>
    qortalCallsFor('FETCH_QDN_RESOURCE').filter((c) => String(c.identifier).includes(slug)).length;
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

  it('does not queue a body again that is still on its way after Back', async () => {
    resetQdnSearchCache();
    mockFetch('/arbitrary/resources/search', [share('Dana', 'dana-slow', 'Slow body')]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockQortalAction('FETCH_QDN_RESOURCE', async () => {
      await gate;
      return { title: 'Slow body', files: [] };
    });

    const first = renderProfile('Dana');
    await waitFor(() => expect(fetchesOf('dana-slow')).toBe(1));
    // Open a share and come back while the body is still on its way.
    first.unmount();
    renderProfile('Dana');
    expect(await screen.findByText('Slow body')).toBeInTheDocument();
    await settle();
    expect(fetchesOf('dana-slow')).toBe(1);

    release();
    expect(await screen.findByText(/0 files/)).toBeInTheDocument();
  });

  it('coming back soon after does not try a share again that just ran out of tries', async () => {
    resetQdnSearchCache();
    mockFetch('/arbitrary/resources/search', [share('Erin', 'erin-gone', 'Gone share')]);
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Data unavailable. Please try again later.' };
    });

    const first = renderProfile('Erin');
    expect(await screen.findByText('Not available on your node right now')).toBeInTheDocument();
    expect(fetchesOf('erin-gone')).toBe(3);

    first.unmount();
    const second = renderProfile('Erin');
    expect(await screen.findByText('Not available on your node right now')).toBeInTheDocument();
    await settle();
    expect(fetchesOf('erin-gone')).toBe(3);

    // A visit after the search cache has expired is a new look: three more tries.
    const realNow = Date.now.bind(Date);
    const later = vi.spyOn(Date, 'now').mockImplementation(() => realNow() + QDN_SEARCH_TTL_MS + 1000);
    onTestFinished(() => later.mockRestore());
    second.unmount();
    renderProfile('Erin');
    await waitFor(() => expect(fetchesOf('erin-gone')).toBe(6));
  });

  it("a hidden name's own profile still loads its bodies", async () => {
    resetQdnSearchCache();
    localStorage.setItem('qshareplus-settings', JSON.stringify({ hiddenNames: ['Hank'] }));
    resetSettingsCache();
    onTestFinished(() => resetSettingsCache());
    mockFetch('/arbitrary/resources/search', [share('Hank', 'hank-one', 'Hank share')]);
    mockQortalAction('FETCH_QDN_RESOURCE', { title: 'Hank share', files: [] });

    renderProfile('Hank');
    expect(await screen.findByText(/0 files/)).toBeInTheDocument();
    expect(fetchesOf('hank-one')).toBe(1);
  });

  it("a hidden name's profile keeps the same rules after Back", async () => {
    resetQdnSearchCache();
    localStorage.setItem('qshareplus-settings', JSON.stringify({ hiddenNames: ['Ivy'] }));
    resetSettingsCache();
    onTestFinished(() => resetSettingsCache());
    mockFetch('/arbitrary/resources/search', [share('Ivy', 'ivy-slow', 'Slow Ivy'), share('Ivy', 'ivy-gone', 'Gone Ivy')]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockQortalAction('FETCH_QDN_RESOURCE', async (params) => {
      if (String(params.identifier).includes('ivy-gone')) throw { error: 1401, message: 'Data unavailable. Please try again later.' };
      await gate;
      return { title: 'Slow Ivy', files: [] };
    });

    const first = renderProfile('Ivy');
    expect(await screen.findByText('Not available on your node right now')).toBeInTheDocument();
    expect(fetchesOf('ivy-gone')).toBe(3);
    expect(fetchesOf('ivy-slow')).toBe(1);

    // Back while one body is still on its way and the other just ran out of tries.
    first.unmount();
    renderProfile('Ivy');
    expect(await screen.findByText('Not available on your node right now')).toBeInTheDocument();
    await settle();
    expect(fetchesOf('ivy-slow')).toBe(1);
    expect(fetchesOf('ivy-gone')).toBe(3);

    release();
    expect(await screen.findByText(/0 files/)).toBeInTheDocument();
  });
});
