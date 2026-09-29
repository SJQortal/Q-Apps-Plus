import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { mockQortalAction, qortalCallsFor } from '../../../test/setup';
import { BlockedNamesModal } from './BlockedNamesModal';

describe('BlockedNamesModal', () => {
  it('lists blocked names and unblocks one with DELETE_LIST_ITEM', async () => {
    mockQortalAction('GET_LIST_ITEMS', ['bob', 'carol']);
    mockQortalAction('DELETE_LIST_ITEM', true);
    renderWithProviders(<BlockedNamesModal open onClose={vi.fn()} />);

    expect(await screen.findByText('bob')).toBeInTheDocument();
    expect(qortalCallsFor('GET_LIST_ITEMS')[0]).toMatchObject({ list_name: 'blockedNames' });

    fireEvent.click(screen.getByRole('button', { name: 'Unblock bob' }));
    await waitFor(() => expect(screen.queryByText('bob')).not.toBeInTheDocument());
    expect(qortalCallsFor('DELETE_LIST_ITEM')[0]).toMatchObject({ list_name: 'blockedNames', item: 'bob' });
    expect(screen.getByText('carol')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is blocked', async () => {
    mockQortalAction('GET_LIST_ITEMS', []);
    renderWithProviders(<BlockedNamesModal open onClose={vi.fn()} />);
    expect(await screen.findByText('No blocked names')).toBeInTheDocument();
  });

  it('shows an error with Retry when the list cannot be read', async () => {
    let calls = 0;
    mockQortalAction('GET_LIST_ITEMS', () => {
      calls += 1;
      if (calls === 1) throw new Error('node down');
      return ['dave'];
    });
    renderWithProviders(<BlockedNamesModal open onClose={vi.fn()} />);

    expect(await screen.findByText('The blocked list could not be loaded.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('dave')).toBeInTheDocument();
  });
});
