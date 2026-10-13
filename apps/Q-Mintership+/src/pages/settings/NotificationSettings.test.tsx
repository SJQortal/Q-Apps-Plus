/** Settings → Notifications: the in-app panel switch. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { SINCE_LAST_VISIT_KEY, sinceLastVisitAtom } from '../../state/notifications';
import { renderPage } from '../../test/render';
import { NotificationSettings } from './NotificationSettings';

afterEach(() => {
  vi.useRealTimers();
  getDefaultStore().set(sinceLastVisitAtom, true);
});

describe('Settings → Notifications', () => {
  it('turns the "Since your last visit" panel off and on, in this browser', async () => {
    const u = userEvent.setup();
    await renderPage(<NotificationSettings />, { persona: 'admin', path: '/settings' });
    const panel = screen.getByRole('switch', { name: 'Since your last visit' });
    expect(panel).toBeChecked();
    await u.click(panel);
    expect(panel).not.toBeChecked();
    expect(window.localStorage.getItem(SINCE_LAST_VISIT_KEY)).toBe('false');
    await u.click(panel);
    expect(panel).toBeChecked();
  });
});
