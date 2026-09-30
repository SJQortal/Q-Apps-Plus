import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { mockQortalAction, qortalCallsFor } from '../../../test/setup';
import { store } from '../../../state/store';
import { setNotification } from '../../../state/features/notificationsSlice';
import { BlockedNamesModal, RECHECK_AFTER_TIMEOUT_MS } from './BlockedNamesModal';

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

  it('stays quiet when the unblock is declined in Hub, and says so when it fails', async () => {
    mockQortalAction('GET_LIST_ITEMS', ['bob', 'carol']);
    let answer: unknown = { error: 'Benutzer hat das Löschen aus der Liste abgelehnt', message: '' };
    mockQortalAction('DELETE_LIST_ITEM', () => {
      throw answer;
    });
    store.dispatch(setNotification({ msg: '', alertType: 'error' }));
    renderWithProviders(<BlockedNamesModal open onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Unblock bob' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unblock bob' })).toBeEnabled());
    expect(store.getState().notifications.alertTypes.alertError).toBe('');
    expect(screen.getByText('bob')).toBeInTheDocument();

    answer = { error: 'Failed to add to list', message: 'Failed to add to list' };
    fireEvent.click(screen.getByRole('button', { name: 'Unblock bob' }));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertError).toBe('Could not unblock bob'));
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it("reads the list again once Hub's dialog has gone after a timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let list = ['bob', 'carol'];
      mockQortalAction('GET_LIST_ITEMS', () => list);
      mockQortalAction('DELETE_LIST_ITEM', () => {
        // Hub gave up at 30 s; the user accepts later and the node drops bob.
        list = ['carol'];
        throw { error: 'Request timed out after 30000 ms (action: DELETE_LIST_ITEM)', message: '' };
      });
      store.dispatch(setNotification({ msg: '', alertType: 'error' }));
      renderWithProviders(<BlockedNamesModal open onClose={vi.fn()} />);

      fireEvent.click(await screen.findByRole('button', { name: 'Unblock bob' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Unblock bob' })).toBeEnabled());
      expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1);

      await act(() => vi.advanceTimersByTimeAsync(RECHECK_AFTER_TIMEOUT_MS));
      await waitFor(() => expect(screen.queryByText('bob')).not.toBeInTheDocument());
      expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(2);
      expect(store.getState().notifications.alertTypes.alertError).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes without an error when reading the list is declined in Hub', async () => {
    mockQortalAction('GET_LIST_ITEMS', () => {
      throw { error: 'User declined to share list', message: 'User declined to share list' };
    });
    const onClose = vi.fn();
    renderWithProviders(<BlockedNamesModal open onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByText('The blocked list could not be loaded.')).not.toBeInTheDocument();
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
