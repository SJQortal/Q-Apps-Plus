import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HomePage } from './HomePage';
import { APPS } from '../apps/manifest';
import { renderWithProviders } from '../test/render';
import { callsFor, installQortalMock } from '../test/setup';

const now = Date.now();
const rows = [
  { name: 'Q-Mail+', service: 'APP', size: 2_100_000, created: now - 86_400_000, updated: now - 3 * 86_400_000 },
  { name: 'Q-Tube+', service: 'APP', size: 7_000_000, updated: now - 3_600_000 },
];

describe('HomePage', () => {
  it('renders every app from the manifest and makes exactly one search on first load', async () => {
    const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
    renderWithProviders(<HomePage />);
    for (const app of APPS) expect(screen.getByTestId(`app-card-${app.slug}`)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByTestId('status-skeleton')).toHaveLength(0));
    expect(callsFor(fn, 'SEARCH_QDN_RESOURCES')).toHaveLength(1);
    const mail = within(screen.getByTestId('app-card-q-mail-plus'));
    expect(mail.getByText(/Updated 3 d ago · 2\.0 MB/)).toBeInTheDocument();
    const shop = within(screen.getByTestId('app-card-q-shop-plus'));
    expect(shop.getByText('Not on QDN yet')).toBeInTheDocument();
  });

  it('opens an app through OPEN_NEW_TAB and remembers it in Recently opened', async () => {
    const fn = installQortalMock({ SEARCH_QDN_RESOURCES: () => rows, OPEN_NEW_TAB: () => true });
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);
    const card = within(screen.getByTestId('app-card-q-tube-plus'));
    await user.click(card.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(fn).toHaveBeenCalledWith({ action: 'OPEN_NEW_TAB', qortalLink: 'qortal://APP/Q-Tube%2B' })
    );
    const recent = await screen.findByRole('region', { name: 'Recently opened' });
    expect(within(recent).getByRole('button', { name: 'Open Q-Tube+' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('qappsplus-recent') ?? '[]')[0].name).toBe('Q-Tube+');
  });

  it('filters by search text and by category', async () => {
    installQortalMock({ SEARCH_QDN_RESOURCES: () => rows });
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);
    await user.type(screen.getByRole('searchbox', { name: 'Search apps' }), 'video');
    expect(screen.getByTestId('app-card-q-tube-plus')).toBeInTheDocument();
    expect(screen.queryByTestId('app-card-q-mail-plus')).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search apps' }), 'zzz');
    expect(screen.getByText(/No apps match/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all apps' }));
    await user.click(screen.getByRole('button', { name: 'Commerce' }));
    expect(screen.getByTestId('app-card-q-shop-plus')).toBeInTheDocument();
    expect(screen.getByTestId('app-card-q-trade-plus')).toBeInTheDocument();
    expect(screen.queryByTestId('app-card-q-tube-plus')).not.toBeInTheDocument();
  });

  it('explains itself outside Hub instead of failing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);
    expect(screen.getByText(/outside Qortal Hub/)).toBeInTheDocument();
    expect(screen.queryAllByTestId('status-skeleton')).toHaveLength(0);
    const card = within(screen.getByTestId('app-card-q-mail-plus'));
    await user.click(card.getByRole('button', { name: 'Open' }));
    expect(await screen.findByText(/inside Qortal Hub or GO to launch Q-Mail\+/)).toBeInTheDocument();
  });

  it('shows a retry when the search fails', async () => {
    let fail = true;
    installQortalMock({
      SEARCH_QDN_RESOURCES: () => {
        if (fail) throw new Error('node offline');
        return rows;
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<HomePage />);
    expect(await screen.findByText(/Couldn't load app details from QDN: node offline/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByText(/Couldn't load app details/)).not.toBeInTheDocument());
  });
});
