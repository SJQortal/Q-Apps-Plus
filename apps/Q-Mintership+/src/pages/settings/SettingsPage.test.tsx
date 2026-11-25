import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { renderPage } from '../../test/render';
import { ABOUT_LINKS } from '../../constants/plus';
import { fullWindowMaxWidth } from '../../test/fullWindow';
import { MUTED_NAMES_KEY, mutedNamesAtom } from '../../state/comments';
import SettingsPage from './SettingsPage';
import { SETTINGS_KEYS, decisionsOrderAtom, pageWidthAtom } from '../../state/settings';
import { RECENT_KEY, recentAtom, recordRecent, resetExplorerState } from '../../state/explorer';

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  vi.useRealTimers();
  getDefaultStore().set(pageWidthAtom, 'comfortable');
  window.matchMedia = originalMatchMedia;
});

/** matchMedia for a frame of `width` × `height` (as DecisionsTabs.test.tsx does). */
function frame(width: number, height: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-(width|height):\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      sizes.every(([, edge, side, value]) => {
        const size = side === 'width' ? width : height;
        return edge === 'min' ? size >= Number(value) : size <= Number(value);
      });
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
}

describe('Settings', () => {
  it('chooses the Decisions order for everyone: most urgent first, or by type', async () => {
    const u = userEvent.setup();
    getDefaultStore().set(decisionsOrderAtom, 'urgency');
    await renderPage(<SettingsPage />, { persona: 'learner', path: '/settings' });
    const order = await screen.findByRole('combobox', { name: 'Decisions order' });
    expect(order).toHaveTextContent('Most urgent first');
    await u.click(order);
    await u.click(await screen.findByRole('option', { name: 'By type' }));
    expect(order).toHaveTextContent('By type');
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEYS.decisionsOrder) ?? 'null')).toBe(
      'type'
    );
  });

  it('chooses the Page width: Comfortable, or Full window with the sections side by side', async () => {
    const u = userEvent.setup();
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    const width = await screen.findByRole('combobox', { name: 'Page width' });
    expect(width).toHaveTextContent('Comfortable');
    const page = screen.getByRole('region', { name: 'Account' }).parentElement!;
    expect(getComputedStyle(page).maxWidth).toBe('720px');
    expect(fullWindowMaxWidth(page)).toBeNull();
    await u.click(width);
    await u.click(await screen.findByRole('option', { name: 'Full window' }));
    expect(width).toHaveTextContent('Full window');
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_KEYS.pageWidth) ?? 'null')).toBe('full');
    // Settings itself follows at once: across the window, its sections side by side.
    expect(fullWindowMaxWidth(page)).toBe('none');
    expect(getComputedStyle(page).display).toBe('grid');
  });

  it('leaves Page width out on a phone, upright or sideways, where it changes nothing', async () => {
    for (const [width, height] of [
      [390, 844],
      [844, 390],
    ]) {
      frame(width, height);
      const { unmount } = await renderPage(<SettingsPage />, {
        persona: 'admin',
        path: '/settings',
      });
      expect(await screen.findByRole('combobox', { name: 'Motion' })).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Page width' })).toBeNull();
      unmount();
    }
  });

  it('shows the signed-in account with its MINTER roles', async () => {
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    expect(await screen.findByText('Avery Admin')).toBeInTheDocument();
    expect(await screen.findByText('Minter Admin')).toBeInTheDocument();
    expect(screen.getByText('Level 7')).toBeInTheDocument();
    expect(screen.getByText(/Hide already voted on/)).toBeInTheDocument();
  });

  it('offers Sign in when Hub declined the account request', async () => {
    await renderPage(<SettingsPage />, { persona: 'signedOut', path: '/settings' });
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText(/Hide already voted on/)).toBeNull();
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
      [
        'Hide already voted on',
        'Decisions you approved or rejected, and Minter Admin polls you voted on: keep Decisions to what still needs you.',
      ],
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
    // The last of the build's About links (constants/plus.ts).
    const { title } = ABOUT_LINKS[ABOUT_LINKS.length - 1];
    await u.click(await screen.findByRole('button', { name: `Copy the ${title} link` }));
    expect(await screen.findByText('Copied: paste it in your browser.')).toBeVisible();
    expect(screen.getByRole('button', { name: `${title} link copied` })).toBeVisible();
    expect(writeText).toHaveBeenCalled();
  });
});

describe('Settings → Muted names', () => {
  const mute = (names: string[]) => getDefaultStore().set(mutedNamesAtom, names);
  const stored = () => JSON.parse(window.localStorage.getItem(MUTED_NAMES_KEY) ?? '[]');
  const EMPTY = "No muted names. Mute a name from a comment's menu.";

  it('lists each muted name with Unmute, says it is per device, and keeps focus in the list', async () => {
    const u = userEvent.setup();
    mute(['Loud One', 'Member 7', 'Spam Bot']);
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    const section = await screen.findByRole('region', { name: 'Muted names' });
    expect(within(section).getByText(/folded away on this device only/)).toBeInTheDocument();
    const rows = within(within(section).getByRole('list')).getAllByRole('listitem');
    // Avatar (hidden from screen readers), name, Unmute.
    expect(
      rows.map((li) => [
        li.querySelector('[aria-hidden="true"]') !== null,
        li.querySelector('p')?.textContent,
        within(li).getByRole('button').textContent,
      ])
    ).toEqual([
      [true, 'Loud One', 'Unmute'],
      [true, 'Member 7', 'Unmute'],
      [true, 'Spam Bot', 'Unmute'],
    ]);

    // The middle one: focus moves to the next name's Unmute.
    await u.click(within(section).getByRole('button', { name: 'Unmute Member 7' }));
    expect(within(section).queryByText('Member 7')).toBeNull();
    expect(within(section).getByRole('button', { name: 'Unmute Spam Bot' })).toHaveFocus();
    expect(within(section).getByRole('status')).toHaveTextContent('Unmuted Member 7.');
    expect(stored()).toEqual(['Loud One', 'Spam Bot']);

    // The last one in the list: focus moves back to the one before it.
    await u.click(within(section).getByRole('button', { name: 'Unmute Spam Bot' }));
    expect(within(section).getByRole('button', { name: 'Unmute Loud One' })).toHaveFocus();

    // The only one left: focus moves to the empty note, never to the page.
    await u.click(within(section).getByRole('button', { name: 'Unmute Loud One' }));
    expect(within(section).getByText(EMPTY)).toHaveFocus();
    expect(within(section).getByRole('status')).toHaveTextContent('Unmuted Loud One.');
    expect(stored()).toEqual([]);
  });

  it('says how to mute a name when none is muted', async () => {
    mute([]);
    await renderPage(<SettingsPage />, { persona: 'signedOut', path: '/settings' });
    const section = await screen.findByRole('region', { name: 'Muted names' });
    expect(within(section).getByText(EMPTY)).toBeInTheDocument();
    expect(within(section).queryByRole('button')).toBeNull();
  });

  it('shows 20 names at a time', async () => {
    const u = userEvent.setup();
    mute(Array.from({ length: 25 }, (_, i) => `Name ${i + 1}`));
    await renderPage(<SettingsPage />, { persona: 'admin', path: '/settings' });
    const section = await screen.findByRole('region', { name: 'Muted names' });
    expect(within(section).getAllByRole('listitem')).toHaveLength(20);
    await u.click(within(section).getByRole('button', { name: 'Show 5 more' }));
    expect(within(section).getAllByRole('listitem')).toHaveLength(25);
    // The button is gone: focus moves to the first name it added.
    expect(within(section).getByRole('button', { name: 'Unmute Name 21' })).toHaveFocus();
  });
});

describe('Settings → Explorer', () => {
  const A = `Q${'a'.repeat(33)}`;
  const B = `Q${'b'.repeat(33)}`;

  it('remembers explored accounts by default; Clear forgets them', async () => {
    const u = userEvent.setup();
    resetExplorerState();
    recordRecent(A);
    recordRecent(B);
    await renderPage(<SettingsPage />, { persona: 'learner', path: '/settings' });
    const section = await screen.findByRole('region', { name: 'Explorer' });
    const remember = within(section).getByRole('switch', {
      name: 'Remember accounts I explore on this device',
    });
    expect(remember).toBeChecked();
    expect(within(section).getByText('2 accounts remembered on this device.')).toBeVisible();
    await u.click(within(section).getByRole('button', { name: 'Clear recent explorations' }));
    expect(within(section).getByText('None remembered on this device.')).toBeVisible();
    expect(
      within(section).getByRole('button', { name: 'Clear recent explorations' })
    ).toBeDisabled();
    expect(window.localStorage.getItem(RECENT_KEY)).toBeNull();
  });

  it('turning it off forgets them and remembers no more', async () => {
    const u = userEvent.setup();
    resetExplorerState();
    recordRecent(A);
    await renderPage(<SettingsPage />, { persona: 'learner', path: '/settings' });
    const section = await screen.findByRole('region', { name: 'Explorer' });
    await u.click(
      within(section).getByRole('switch', { name: 'Remember accounts I explore on this device' })
    );
    expect(window.localStorage.getItem(SETTINGS_KEYS.explorerRemember)).toBe('false');
    expect(window.localStorage.getItem(RECENT_KEY)).toBeNull();
    expect(within(section).getByText('None remembered on this device.')).toBeVisible();
    recordRecent(B);
    expect(getDefaultStore().get(recentAtom)).toEqual([]);
  });
});
