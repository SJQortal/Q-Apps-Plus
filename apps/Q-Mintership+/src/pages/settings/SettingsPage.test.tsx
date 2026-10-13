import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('a switch turns with a tap anywhere on its row (the switch alone is under 44 px)', async () => {
    const u = userEvent.setup();
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    for (const [name, hint] of [
      ['Celebrate joining MINTER', 'A small burst on Home when you become a minter.'],
      ['Hide decisions I signed', 'Keep the Decisions queue to what still needs you.'],
      ['Since your last visit', /^Home lists what changed since you last opened the app/],
    ] as const) {
      const toggle = await screen.findByRole('switch', { name });
      const before = (toggle as HTMLInputElement).checked;
      await u.click(screen.getByText(hint));
      expect((toggle as HTMLInputElement).checked).toBe(!before);
      // Its name stays the title, not the whole row.
      expect(toggle).toHaveAccessibleName(name);
      await u.click(screen.getByText(hint));
      expect((toggle as HTMLInputElement).checked).toBe(before);
    }
  });

  it('confirms a copied web link on screen, not only in a tooltip', async () => {
    const u = userEvent.setup();
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await u.click(await screen.findByRole('button', { name: 'Copy the Q-Apps+ source link' }));
    expect(await screen.findByText('Copied: paste it in your browser.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Q-Apps+ source link copied' })).toBeVisible();
    expect(writeText).toHaveBeenCalled();
  });
});
