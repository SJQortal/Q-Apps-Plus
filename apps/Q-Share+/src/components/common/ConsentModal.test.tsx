import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import localForage from 'localforage';
import { renderWithProviders } from '../../test/renderWithProviders';
import ConsentModal from './ConsentModal';

describe('ConsentModal', () => {
  it('opens on first visit and records consent only when the button is pressed', async () => {
    await localForage.removeItem('general-consent');
    renderWithProviders(<ConsentModal />);

    expect(await screen.findByRole('heading', { name: 'Welcome to Q-Share+' })).toBeInTheDocument();
    // Opening alone must not count as consent.
    expect(await localForage.getItem('general-consent')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
    await waitFor(async () => expect(await localForage.getItem('general-consent')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Welcome to Q-Share+' })).not.toBeInTheDocument());
  });

  it('stays closed once consent is stored', async () => {
    await localForage.setItem('general-consent', true);
    renderWithProviders(<ConsentModal />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading', { name: 'Welcome to Q-Share+' })).not.toBeInTheDocument();
  });
});
