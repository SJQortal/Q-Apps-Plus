import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockQortalAction, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { readSettings, resetSettingsCache, writeSettings } from '../../utils/settings';
import { SETTINGS_IDENTIFIER } from '../../utils/settingsQdn';
import { Settings } from './Settings';

const signIn = () =>
  store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));

describe('Settings → Sync', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsCache();
    signIn();
  });

  it('Save to QDN publishes one DOCUMENT with the settings and the theme', async () => {
    writeSettings({ defaultSort: 'oldest', hiddenNames: ['spammer'] });
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /save to qdn/i }));
    await waitFor(() => expect(qortalCallsFor('PUBLISH_QDN_RESOURCE').length).toBe(1));
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0] as any;
    expect(call).toMatchObject({ service: 'DOCUMENT', name: 'alice', identifier: SETTINGS_IDENTIFIER });
    const stored = JSON.parse(atob(call.data64));
    expect(stored.defaultSort).toBe('oldest');
    expect(stored.hiddenNames).toEqual(['spammer']);
    expect(stored.uiTheme).toBe('hub30');
    expect(await screen.findByRole('status')).toHaveTextContent(/Saved to QDN/);
  });

  it('Restore applies the stored settings and theme, and says so when nothing is stored', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', {
      version: 1,
      defaultSort: 'oldest',
      followingFeed: false,
      hiddenNames: ['x'],
      uiTheme: 'black',
      updatedAt: 1700000000000,
    });
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^restore/i }));
    await waitFor(() => expect(readSettings().defaultSort).toBe('oldest'));
    expect(readSettings().followingFeed).toBe(false);
    expect(readSettings().hiddenNames).toEqual(['x']);
    expect(JSON.parse(localStorage.getItem('qshareplus-ui-theme') || '""')).toBe('black');
    expect(await screen.findByRole('status')).toHaveTextContent(/Restored the settings saved/);

    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw new Error('404');
    });
    fireEvent.click(screen.getByRole('button', { name: /^restore/i }));
    expect(await screen.findByText(/No settings saved on QDN for alice/)).toBeInTheDocument();
  });
});
