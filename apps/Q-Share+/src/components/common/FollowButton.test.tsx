import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { FollowButton, resetFollowCaches } from './FollowButton';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { removeNotification } from '../../state/features/notificationsSlice';

function signIn(name: string | null) {
  act(() => {
    store.dispatch(addUser(name ? { address: 'Qabc', publicKey: 'k', name, names: [{ name, owner: 'Qabc' }] } : null));
  });
}

describe('FollowButton', () => {
  beforeEach(() => {
    resetFollowCaches();
    store.dispatch(removeNotification());
    signIn(null);
  });

  it('does not read followedNames while signed out, so Hub shows no list dialog', async () => {
    mockQortalAction('GET_LIST_ITEMS', ['POS+']);
    renderWithProviders(<FollowButton followerName="POS+" />);
    expect(screen.getByRole('button', { name: 'Follow POS+' })).toBeInTheDocument();
    await act(async () => {});
    expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(0);

    signIn('carol');
    expect(await screen.findByRole('button', { name: 'Unfollow POS+' })).toBeInTheDocument();
    expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1);
  });

  it('reads the list for an account with no name, and not again when the active name changes', async () => {
    mockQortalAction('GET_LIST_ITEMS', ['alice']);
    act(() => {
      store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: '', names: [] }));
    });
    const first = renderWithProviders(<FollowButton followerName="alice" />);
    expect(await screen.findByRole('button', { name: 'Unfollow alice' })).toBeInTheDocument();
    expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1);
    first.unmount();

    signIn('carol');
    renderWithProviders(<FollowButton followerName="alice" />);
    expect(await screen.findByRole('button', { name: 'Unfollow alice' })).toBeInTheDocument();
    signIn('dave');
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Unfollow alice' })).toBeInTheDocument();
    expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1);
  });

  it('remembers a declined list read for the session instead of asking on every page', async () => {
    signIn('carol');
    mockQortalAction('GET_LIST_ITEMS', () => {
      throw { error: 'User declined share list', message: 'User declined share list' };
    });
    const first = renderWithProviders(<FollowButton followerName="alice" />);
    await waitFor(() => expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1));
    first.unmount();

    renderWithProviders(<FollowButton followerName="bob" />);
    await act(async () => {});
    expect(screen.getByRole('button', { name: 'Follow bob' })).toBeInTheDocument();
    expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1);
  });

  it('reads the publish size from Core with the name encoded, only when the tooltip opens', async () => {
    mockFetch(/^\/arbitrary\/resources\?/, [{ size: 1000 }, { size: 24 }]);
    renderWithProviders(<FollowButton followerName="Q&A+" />);
    expect(fetchCallsMatching(/^\/arbitrary\/resources\?/)).toHaveLength(0);

    fireEvent.mouseOver(screen.getByRole('button', { name: 'Follow Q&A+' }));
    expect(await screen.findByText(/current download size: 1 KB/)).toBeInTheDocument();
    const calls = fetchCallsMatching(/^\/arbitrary\/resources\?/);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('name=Q%26A%2B');
    expect(calls[0]).toContain('limit=100');
    expect(calls[0]).toContain('offset=0');
    expect(qortalCallsFor('LIST_QDN_RESOURCES')).toHaveLength(0);
  });

  it('stays quiet when the follow is declined, and says so when it fails', async () => {
    signIn('carol');
    mockQortalAction('GET_LIST_ITEMS', []);
    mockQortalAction('ADD_LIST_ITEMS', () => {
      throw { error: 'Benutzer hat die Anfrage abgelehnt', message: 'Benutzer hat die Anfrage abgelehnt' };
    });
    renderWithProviders(<FollowButton followerName="alice" />);
    await waitFor(() => expect(qortalCallsFor('GET_LIST_ITEMS')).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Follow alice' }));
    await waitFor(() => expect(qortalCallsFor('ADD_LIST_ITEMS')).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow alice' })).toBeEnabled());
    expect(store.getState().notifications.alertTypes.alertError).toBeFalsy();

    mockQortalAction('ADD_LIST_ITEMS', () => {
      throw 'The request timed out';
    });
    fireEvent.click(screen.getByRole('button', { name: 'Follow alice' }));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertError).toBe('Could not follow alice'));
  });
});
