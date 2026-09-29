import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../../test/setup';
import { store } from '../../../state/store';
import { addUser } from '../../../state/features/authSlice';
import { clearMine } from '../../../state/features/collectionsSlice';
import { resetQdnSearchCache } from '../../../utils/qdnSearch';
import { resetCollectionCaches } from '../../../utils/collections';
import { SaveToCollectionButton } from './SaveToCollectionButton';
import { resetMyCollectionsLoader } from './useMyCollections';

const COLLECTION_ID = 'qshare_collection_my-docs_ab12cd';
const share = { name: 'bob', identifier: 'qshare_file_report_x1y2z3_metadata', title: 'Report' };

function signIn(name: string | null) {
  store.dispatch(addUser(name ? { address: 'Qabc', publicKey: 'k', name, names: [{ name, owner: 'Qabc' }] } : null));
}

describe('SaveToCollectionButton', () => {
  beforeEach(() => {
    resetQdnSearchCache();
    resetCollectionCaches();
    resetMyCollectionsLoader();
    store.dispatch(clearMine());
  });

  it('renders nothing when not signed in', () => {
    signIn(null);
    renderWithProviders(<SaveToCollectionButton share={share} />);
    expect(screen.queryByRole('button', { name: 'Save to collection' })).not.toBeInTheDocument();
  });

  it('saves the share into a collection with one PUBLISH_QDN_RESOURCE of the same identifier', async () => {
    signIn('alice');
    mockFetch('/arbitrary/resources/search', [
      { name: 'alice', service: 'DOCUMENT', identifier: COLLECTION_ID, updated: 10, metadata: { title: 'My docs', description: '' } },
    ]);
    mockQortalAction('FETCH_QDN_RESOURCE', { version: 1, title: 'My docs', description: '', items: [], created: 5, updated: 5 });
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);

    renderWithProviders(<SaveToCollectionButton share={share} />);

    const trigger = await screen.findByRole('button', { name: 'Save to collection' });
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await waitFor(() => expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(1));
    fireEvent.click(trigger);

    const row = await screen.findByRole('menuitemcheckbox', { name: /My docs/ });
    expect(row).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(row);

    await waitFor(() => expect(qortalCallsFor('PUBLISH_QDN_RESOURCE').length).toBe(1));
    const publish = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(publish).toMatchObject({
      service: 'DOCUMENT',
      name: 'alice',
      identifier: COLLECTION_ID,
      tag1: 'qshare_collection_',
      filename: 'collection.json',
      title: 'My docs',
    });
    const body = JSON.parse(atob(String(publish.data64)));
    expect(body.version).toBe(1);
    expect(body.title).toBe('My docs');
    expect(body.created).toBe(5);
    expect(body.items).toEqual([{ name: share.name, identifier: share.identifier }]);

    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe('Saved to My docs'));
    expect(trigger).toHaveAttribute('aria-pressed', 'true');

    // One paged search by my name, no per-item searches, no unlimited search.
    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.length).toBe(1);
    expect(searches[0]).toContain('name=alice');
    expect(searches[0]).toContain('identifier=qshare_collection_');
    expect(searches[0]).toContain('limit=20');
    expect(searches[0]).not.toMatch(/limit=0\b/);
  });

  it('rolls back when Hub refuses the publish', async () => {
    signIn('alice');
    mockFetch('/arbitrary/resources/search', [
      { name: 'alice', service: 'DOCUMENT', identifier: COLLECTION_ID, updated: 10, metadata: { title: 'My docs', description: '' } },
    ]);
    mockQortalAction('FETCH_QDN_RESOURCE', { version: 1, title: 'My docs', description: '', items: [], created: 5, updated: 5 });
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw new Error('User declined');
    });

    renderWithProviders(<SaveToCollectionButton share={share} />);
    const trigger = await screen.findByRole('button', { name: 'Save to collection' });
    await waitFor(() => expect(qortalCallsFor('FETCH_QDN_RESOURCE').length).toBe(1));
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: /My docs/ }));

    await waitFor(() => expect(store.getState().notifications.alertTypes.alertError).toBe('Could not update My docs'));
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    expect(store.getState().collections.byKey[`alice/${COLLECTION_ID}`].items).toEqual([]);
  });
});
