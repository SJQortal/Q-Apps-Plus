import { afterEach, describe, expect, it } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { store } from '../../../state/store';
import { setNotification } from '../../../state/features/notificationsSlice';
import Notification from './Notification';

const originalMatchMedia = window.matchMedia;

/** Every media query matches: the phone layout, in landscape (compact bar). */
function mockLandscapePhone() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

describe('Notification', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: originalMatchMedia });
  });

  it('shows a toast for a notification and clears it from the store', async () => {
    renderWithProviders(<Notification />);

    act(() => {
      store.dispatch(setNotification({ alertType: 'success', msg: 'Share published' }));
    });

    expect(await screen.findByText('Share published')).toBeInTheDocument();
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe(''));
  });

  it("on a landscape phone cancels bottom-center's half-width shift, so the toast stays on screen", async () => {
    mockLandscapePhone();
    renderWithProviders(<Notification />);

    act(() => {
      store.dispatch(setNotification({ alertType: 'error', msg: 'Could not copy the link' }));
    });

    const toast = await screen.findByText('Could not copy the link');
    const container = toast.closest<HTMLElement>('.Toastify__toast-container');
    expect(container).toHaveClass('Toastify__toast-container--bottom-center');
    // react-toastify's CSS adds translateX(-50%) here and only resets it at 480 px or less.
    expect(container?.style.transform).toBe('none');
    expect(container?.style.left).toBe('0px');
    expect(container?.style.width).toBe('100%');
  });
});
