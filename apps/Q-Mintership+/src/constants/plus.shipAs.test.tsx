/**
 * The upstream "Ship as Q-Mintership" commit (docs/RELEASE.md, stage 4) only
 * changes the values in constants/plus.ts. With Q-Mintership's own values, no
 * screen says "Q-Mintership+" or "the original app", and the original app's
 * links are gone while it has none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADMIN_BOARD_IDS, answerDecrypt } from '../../e2e/world.mjs';
import { renderPage } from '../test/render';
import { mockQortalRequest } from '../test/setup';
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
    era: 'before Q-Mintership 4.0.0',
  },
}));

/** Hub decrypting as Avery Admin's would. */
const decryptAsAdmin = (world: Parameters<typeof answerDecrypt>[0]) =>
  mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) =>
    answerDecrypt(world, 'admin', request)
  );

afterEach(() => {
  vi.restoreAllMocks();
});

function saysNoPlusName() {
  expect(document.body).not.toHaveTextContent('Q-Mintership+');
  expect(document.body).not.toHaveTextContent(/original app|original Q-Mintership/i);
}

describe('shipped as Q-Mintership', () => {
  it('History names Q-Mintership 3, and its Admin Board says the cards were proposed before 4.0.0', async () => {
    await renderPage(<HistoryPage />, {
      persona: 'admin',
      path: '/history',
      setup: decryptAsAdmin,
    });
    expect(
      await screen.findByRole('list', { name: 'Cards from Q-Mintership 3, newest first' })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Admin Board' }));
    expect(
      screen.getByText(
        /^Q-Mintership 3's Minter Admin board: cards proposed before Q-Mintership 4\.0\.0, encrypted to the Minter Admins/
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('Remove Member 12 from MINTER?')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Open / })).toBeNull();
    saysNoPlusName();
  });

  it("an Admin Board card's page says it was proposed before Q-Mintership 4.0.0", async () => {
    await renderPage(<LegacyCardPage />, {
      persona: 'admin',
      path: `/history/card/${encodeURIComponent(ADMIN_BOARD_IDS.removal)}`,
      route: '/history/card/:card',
      setup: decryptAsAdmin,
    });
    expect(await screen.findByRole('article')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Proposed before Q-Mintership 4.0.0. Encrypted to the Minter Admins, read-only.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Open in/ })).toBeNull();
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
