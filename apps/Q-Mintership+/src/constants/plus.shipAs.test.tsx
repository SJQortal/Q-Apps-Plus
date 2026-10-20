/**
 * The upstream "Ship as Q-Mintership" commit (docs/RELEASE.md, stage 4) only
 * changes the values in constants/plus.ts. With Q-Mintership's own values, no
 * screen says "Q-Mintership+" or "the original app", and the original app's
 * links are gone while it has none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderPage } from '../test/render';
import { qortalCallsFor } from '../test/setup';
import HistoryPage from '../pages/history/HistoryPage';
import LegacyCardPage from '../pages/history/LegacyCardPage';
import SettingsPage from '../pages/settings/SettingsPage';

vi.mock('./plus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./plus')>()),
  APP_NAME: 'Q-Mintership',
  LINK_APP_NAME: 'Q-Mintership',
  ORIGINAL_APP_NAME: 'Q-Mintership 3',
  ORIGINAL_APP_LINK: null,
  ORIGINAL_WORDS: {
    app: 'Q-Mintership 3',
    named: 'Q-Mintership 3',
    adjective: 'Q-Mintership 3',
    adminBoard: "Q-Mintership 3's Minter Admin board",
    card: 'Q-Mintership 3 card',
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

function saysNoPlusName() {
  expect(document.body).not.toHaveTextContent('Q-Mintership+');
  expect(document.body).not.toHaveTextContent(/original app|original Q-Mintership/i);
}

describe('shipped as Q-Mintership', () => {
  it('History names Q-Mintership 3 and offers no link to it', async () => {
    await renderPage(<HistoryPage />, { persona: 'admin', path: '/history' });
    expect(
      await screen.findByRole('list', { name: 'Cards from Q-Mintership 3, newest first' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Q-Mintership 3's Minter Admin board was encrypted to Minter Admins, so it isn't shown here."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
    saysNoPlusName();
  });

  it("an encrypted card's page isn't decrypted and has no link out", async () => {
    await renderPage(<LegacyCardPage />, {
      persona: 'admin',
      path: `/history/card/${encodeURIComponent('card-MAC-NC-1780000000000-a1B2c3')}`,
      route: '/history/card/:card',
    });
    expect(await screen.findByText('Encrypted to Minter Admins')).toBeInTheDocument();
    expect(
      screen.getByText(/^This card is from Q-Mintership 3's Minter Admin board/)
    ).toHaveTextContent("Q-Mintership doesn't decrypt it.");
    expect(screen.queryByRole('button', { name: /^Open in/ })).toBeNull();
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
    saysNoPlusName();
  });

  it('Settings → About shows Q-Mintership and no row for the original', async () => {
    await renderPage(<SettingsPage />, { persona: 'learner', path: '/settings' });
    expect(await screen.findByText(/^Q-Mintership \d+\.\d+\.\d+$/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Q-Mintership 3/ })).toBeNull();
    expect(
      screen.getByText(/Q-Mintership 3's boards stay readable in History\./)
    ).toBeInTheDocument();
    saysNoPlusName();
  });
});
