import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { ADMIN_POLL_IDS } from '../../../e2e/world.mjs';
import { loadAdminPolls } from '../../data/adminPolls';
import { resetPendingPollWrites, setPendingVote } from '../../state/adminPolls';
import { withAdminPolls } from '../../test/adminPolls';
import { renderPage } from '../../test/render';
import { fetchCalls, qortalCallsFor } from '../../test/setup';
import HomePage from './HomePage';

beforeEach(() => resetPendingPollWrites());
afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const T = { timeout: 6000 };
const privateReads = () =>
  fetchCalls.filter((p) => p.includes('DOCUMENT_PRIVATE') || p.startsWith('/addresses/publickey'));

describe('Home: Minter Admin polls waiting for your vote', () => {
  it('says nothing, and reads nothing, until Decisions has read the polls', async () => {
    await renderPage(<HomePage />, { persona: 'admin', setup: withAdminPolls('admin') });
    expect(await screen.findByText('Waiting for your signature', {}, T)).toBeVisible();
    expect(screen.queryByText(/waiting for your vote/)).toBeNull();
    expect(privateReads()).toHaveLength(0);
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(0);
  });

  it('once read: how many open polls wait for the vote, linking to Decisions', async () => {
    const { address } = await renderPage(<HomePage />, {
      persona: 'admin',
      setup: withAdminPolls('admin'),
    });
    expect(await screen.findByText('Waiting for your signature', {}, T)).toBeVisible();
    // What Decisions read this session (Avery voted on one of the three open polls).
    await act(async () => {
      await loadAdminPolls(address);
    });
    const reads = privateReads().length;
    expect(
      await screen.findByText('2 Minter Admin polls are waiting for your vote', {}, T)
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Decisions' })).toHaveAttribute(
      'href',
      '/decisions'
    );
    // Home itself read nothing more.
    expect(privateReads()).toHaveLength(reads);
    // A vote on its way from this device counts as voted.
    act(() =>
      setPendingVote(ADMIN_POLL_IDS.open, { vote: 'yes', status: 'confirming', at: Date.now() })
    );
    expect(
      await screen.findByText('1 Minter Admin poll is waiting for your vote', {}, T)
    ).toBeVisible();
  });

  it('members never see it', async () => {
    await renderPage(<HomePage />, { persona: 'nominator', setup: withAdminPolls('nominator') });
    await screen.findByRole('heading', { level: 1 }, T);
    expect(screen.queryByText(/waiting for your vote/)).toBeNull();
    expect(privateReads()).toHaveLength(0);
  });
});
