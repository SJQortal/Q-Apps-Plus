import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockFetch, mockQortalAction, qortalCallsFor } from '../../test/setup';
import { resetQdnSearchCache } from '../../utils/qdnSearch';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { removeNotification } from '../../state/features/notificationsSlice';
import { readSettings, resetSettingsCache, writeSettings } from '../../utils/settings';
import { SETTINGS_IDENTIFIER } from '../../utils/settingsQdn';
import { resetInAppHistory } from '../../hooks/useSafeBack';
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

  it('a decline in Hub, in any language, is a quiet cancel, not a failure', async () => {
    store.dispatch(removeNotification());
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw { error: 'Benutzer hat die Anfrage abgelehnt', message: 'Benutzer hat die Anfrage abgelehnt' };
    });
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /save to qdn/i }));
    expect(await screen.findByText('Save cancelled in Hub.')).toBeInTheDocument();
    expect(store.getState().notifications.alertTypes.alertError).toBe('');
  });

  it('Restore applies the stored settings and theme, and says so when nothing is stored', async () => {
    mockQortalAction('FETCH_QDN_RESOURCE', {
      version: 1,
      defaultSort: 'oldest',
      followingFeed: false,
      hiddenNames: ['x'],
      listView: 'grid',
      uiTheme: 'black',
      updatedAt: 1700000000000,
    });
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^restore/i }));
    await waitFor(() => expect(readSettings().defaultSort).toBe('oldest'));
    expect(readSettings().followingFeed).toBe(false);
    expect(readSettings().hiddenNames).toEqual(['x']);
    expect(readSettings().listView).toBe('grid');
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(localStorage.getItem('qshareplus-ui-theme') || '""')).toBe('black');
    expect(await screen.findByRole('status')).toHaveTextContent(/Restored the settings saved/);

    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Data unavailable. Please try again later.' };
    });
    mockFetch('/arbitrary/resources/search', []);
    fireEvent.click(screen.getByRole('button', { name: /^restore/i }));
    expect(await screen.findByText(/No settings saved on QDN for alice/)).toBeInTheDocument();
  });

  it('Restore says when the saved settings are not on this node yet, instead of "nothing saved"', async () => {
    resetQdnSearchCache();
    mockQortalAction('FETCH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Data unavailable. Please try again later.' };
    });
    mockFetch('/arbitrary/resources/search', [{ name: 'alice', service: 'DOCUMENT', identifier: SETTINGS_IDENTIFIER }]);
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByRole('button', { name: /^restore/i }));
    expect(await screen.findByText(/haven't reached this node yet/)).toBeInTheDocument();
    expect(screen.queryByText(/No settings saved/)).not.toBeInTheDocument();
    expect(readSettings().defaultSort).toBe('newest');
  });
});

describe('Settings → Layout', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsCache();
  });

  it('chooses rows or a grid of cards for every share list, with the words on the buttons', () => {
    renderWithProviders(<Settings />);
    const layout = screen.getByRole('group', { name: 'Layout' });
    const list = within(layout).getByRole('button', { name: 'List' });
    const grid = within(layout).getByRole('button', { name: 'Grid' });
    expect(list).toHaveAttribute('aria-pressed', 'true');
    expect(list).toHaveTextContent('List');

    fireEvent.click(grid);
    expect(readSettings().listView).toBe('grid');
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    // Pressing the chosen one again keeps it.
    fireEvent.click(grid);
    expect(readSettings().listView).toBe('grid');

    fireEvent.click(list);
    expect(readSettings().listView).toBe('list');
    expect(list).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a choice made elsewhere (the toggle on a list)', () => {
    writeSettings({ listView: 'grid' });
    renderWithProviders(<Settings />);
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Settings → Back', () => {
  beforeEach(() => resetInAppHistory());

  it('goes Home when Settings was opened directly, not to whatever the shared Hub history holds', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/settings" element={<Settings />} />
      </Routes>,
      { initialEntries: ['/settings'] }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Home page')).toBeInTheDocument();
  });
});

describe('Settings → Hidden names', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsCache();
    signIn();
  });

  it('gives each hidden name its own labelled Unhide button, and keeps focus in the list', () => {
    writeSettings({ hiddenNames: ['spammer', 'troll', 'bot'] });
    renderWithProviders(<Settings />);

    const list = screen.getByRole('list', { name: 'Hidden names' });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['spammer', 'troll', 'bot']);

    // A real button: screen readers and switch access reach it, and activating it un-hides the name.
    const unhideTroll = within(list).getByRole('button', { name: 'Unhide troll' });
    unhideTroll.focus();
    fireEvent.click(unhideTroll);
    expect(readSettings().hiddenNames).toEqual(['spammer', 'bot']);
    expect(screen.queryByRole('button', { name: 'Unhide troll' })).not.toBeInTheDocument();
    // Focus moves to the name that took its place, not back to the top of the page.
    expect(screen.getByRole('button', { name: 'Unhide bot' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'Unhide bot' }));
    expect(screen.getByRole('button', { name: 'Unhide spammer' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Unhide spammer' }));
    expect(readSettings().hiddenNames).toEqual([]);
    expect(screen.getByText('No hidden names.')).toBeInTheDocument();
    // After the last one, the section title, not the input: that would open the keyboard on a phone.
    expect(screen.getByText('Hidden names')).toHaveFocus();
  });
});

describe('Settings → Account', () => {
  const account = (names: string[], name = names[0]) =>
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name, names: names.map((n) => ({ name: n, owner: 'Qabc' })) }));

  beforeEach(() => {
    localStorage.clear();
    resetSettingsCache();
  });

  it('switches names in the same picker as the header, with avatars', async () => {
    account(['alice', 'bob', 'carol']);
    renderWithProviders(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch name' }));
    const dialog = await screen.findByRole('dialog', { name: 'Switch name' });
    const rows = within(dialog).getAllByRole('menuitemradio');
    expect(rows.map((r) => r.textContent)).toEqual(['alice', 'bob', 'carol']);
    for (const row of rows) expect(row.querySelector('.MuiAvatar-root')).toBeInTheDocument();
    expect(within(dialog).getByRole('menuitemradio', { name: 'alice' })).toHaveAttribute('aria-checked', 'true');
    // Few names: no search field.
    expect(within(dialog).queryByRole('textbox')).toBeNull();

    fireEvent.click(within(dialog).getByRole('menuitemradio', { name: 'bob' }));
    expect(store.getState().auth.user?.name).toBe('bob');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Switch name' })).toBeNull());
  });

  it('adds the search field for an account with many names', async () => {
    const names = Array.from({ length: 18 }, (_, i) => `name ${String(i).padStart(2, '0')}`);
    account([...names, 'Simon James']);
    renderWithProviders(<Settings />);
    fireEvent.click(screen.getByRole('button', { name: 'Switch name' }));
    const dialog = await screen.findByRole('dialog', { name: 'Switch name' });
    const field = within(dialog).getByRole('textbox', { name: 'Find one of your names' });
    fireEvent.change(field, { target: { value: 'james' } });
    expect(within(dialog).getAllByRole('menuitemradio').map((r) => r.textContent)).toEqual(['Simon James']);
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(store.getState().auth.user?.name).toBe('Simon James');
  });

  it('shows no Switch name button for an account with one name', () => {
    account(['alice']);
    renderWithProviders(<Settings />);
    expect(screen.queryByRole('button', { name: 'Switch name' })).toBeNull();
  });
});
