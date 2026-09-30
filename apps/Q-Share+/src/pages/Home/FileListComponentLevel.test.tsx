import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { FileListComponentLevel } from './FileListComponentLevel';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';

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
  });
});
