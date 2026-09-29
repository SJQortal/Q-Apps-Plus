import { describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { store } from '../../../state/store';
import { setNotification } from '../../../state/features/notificationsSlice';
import Notification from './Notification';

describe('Notification', () => {
  it('shows a toast for a notification and clears it from the store', async () => {
    renderWithProviders(<Notification />);

    act(() => {
      store.dispatch(setNotification({ alertType: 'success', msg: 'Share published' }));
    });

    expect(await screen.findByText('Share published')).toBeInTheDocument();
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe(''));
  });
});
