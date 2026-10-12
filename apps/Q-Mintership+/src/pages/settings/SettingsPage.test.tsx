import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../../test/render';
import SettingsPage from './SettingsPage';

afterEach(() => vi.useRealTimers());

describe('Settings', () => {
  it('shows the signed-in account with its MINTER roles', async () => {
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    expect(await screen.findByText('Avery Admin')).toBeInTheDocument();
    expect(await screen.findByText('Minter Admin')).toBeInTheDocument();
    expect(screen.getByText('Level 7')).toBeInTheDocument();
    expect(screen.getByText(/Hide decisions I signed/)).toBeInTheDocument();
  });

  it('offers Sign in when Hub declined the account request', async () => {
    await renderPage(<SettingsPage />, { persona: 'signedOut', path: '/settings' });
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/Hide decisions I signed/)).toBeNull();
  });

  it('explains what works outside Hub', async () => {
    await renderPage(<SettingsPage />, { persona: 'outside', path: '/settings' });
    expect(await screen.findByText('Open in Qortal Hub or GO')).toBeInTheDocument();
  });
});
