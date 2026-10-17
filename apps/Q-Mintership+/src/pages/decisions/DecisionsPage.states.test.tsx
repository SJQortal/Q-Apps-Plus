import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import DecisionsPage from './DecisionsPage';

// The decisions read fails until `failing` is switched off: the error state, then Retry.
const state = vi.hoisted(() => ({ failing: true }));
vi.mock('../../data/decisions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/decisions')>();
  const { fetchQuery } = await import('../../data/query');
  return {
    ...actual,
    loadDecisions: (options: { force?: boolean } = {}) =>
      state.failing
        ? fetchQuery('decisions:queue', () => Promise.reject(new Error('Node unreachable')), {
            force: options.force,
          })
        : actual.loadDecisions(options),
  };
});

afterEach(() => {
  vi.useRealTimers();
  state.failing = true;
});

describe('Decisions: loading and errors', () => {
  it('shows skeletons first, then the error with Retry, then the queue', async () => {
    await renderPage(<DecisionsPage />, { persona: 'admin', path: '/decisions?show=decisions' });
    expect(screen.getByRole('status', { name: 'Loading decisions' })).toBeInTheDocument();
    expect(await screen.findByText('Couldn’t load the decisions.')).toBeVisible();
    state.failing = false;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ })
    ).toBeInTheDocument();
  });
});
