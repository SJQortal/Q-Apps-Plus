/**
 * A decision this Minter Admin answered (signed or rejected, in a block or
 * on its way) waits for them nowhere: not in "Waiting for your answer"
 * (Decisions and Home), not in the Decisions badge, not in Sign several.
 * "Hide already voted on" hides both kinds of answer, and keeps the device's
 * choice from when it was "Hide what I signed".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { mockQortalRequest } from '../../test/setup';
import { ADDR, type InstalledWorld } from '../../test/world';
import { base58Encode } from '../../qortal/base58';
import { STORAGE_PREFIX } from '../../constants/plus';
import { AppShell } from '../../components/layout/AppShell';
import HomePage from '../home/HomePage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

type World = InstalledWorld['world'];

/** Avery Admin rejects the kick (in a block) and the ban (still on its way). */
function averyRejects(world: World) {
  const publicKey = world.accounts.get(ADDR.admin).publicKey;
  const reject = (type: string, confirmed: boolean, seed: number) => {
    const tx = world.pending.find((t: { type: string }) => t.type === type);
    const row = {
      type: 'GROUP_APPROVAL',
      timestamp: confirmed ? tx.timestamp + 120_000 : Date.now() - 30_000,
      signature: base58Encode(new Uint8Array(64).fill(seed)),
      txGroupId: 0,
      ...(confirmed ? { blockHeight: tx.blockHeight + 2 } : {}),
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: ADDR.admin,
      adminPublicKey: publicKey,
      pendingSignature: tx.signature,
      approval: false,
    };
    (confirmed ? world.approvals : world.unconfirmedApprovals).push(row);
  };
  reject('GROUP_KICK', true, 41);
  reject('GROUP_BAN', false, 42);
}

async function openQueue() {
  const rendered = await renderPage(<DecisionsPage />, {
    persona: 'admin',
    path: '/decisions',
    route: '/decisions',
    setup: averyRejects,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return rendered;
}

const card = (name: RegExp) => screen.getByRole('article', { name });
const KICK = /^Remove from MINTER, Kai Target/;
const BAN = /^Ban from MINTER, Ben Target/;

describe('Rejected decisions stay out of the waiting lists', () => {
  it('Decisions: the summary and Approve several leave them out', async () => {
    const u = user();
    await openQueue();
    expect(within(card(KICK)).getByText('You rejected')).toBeInTheDocument();
    expect(within(card(BAN)).getByText('You rejected (confirming…)')).toBeInTheDocument();
    // Six without the rejections; one in a block and one on its way leave four.
    expect(screen.getByText('4 decisions waiting for your answer')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Approve several' }));
    expect(within(card(KICK)).queryByRole('checkbox')).toBeNull();
    expect(within(card(BAN)).queryByRole('checkbox')).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('4 of 4 selected')).toBeInTheDocument();
  });

  it('Home: the headline and the rows leave them out', async () => {
    await renderPage(<HomePage />, { persona: 'admin', setup: averyRejects });
    await screen.findByRole(
      'heading',
      { level: 2, name: 'Avery Admin, 4 decisions are waiting for your answer' },
      T
    );
    const waiting = screen.getByRole('region', { name: 'Waiting for your answer' });
    expect(within(waiting).queryByRole('link', { name: /Kai Target/ })).toBeNull();
    expect(within(waiting).queryByRole('link', { name: /Ben Target/ })).toBeNull();
  });

  it('the Decisions badge leaves them out', async () => {
    await renderPage(<AppShell />, { persona: 'admin', setup: averyRejects });
    await waitFor(
      () =>
        expect(
          screen.getAllByRole('button', { name: /^Decisions, 4 waiting for you$/ }).length
        ).toBeGreaterThan(0),
      T
    );
  });
});

describe('Hide already voted on', () => {
  it('hides signed and rejected ones, in a block or on their way', async () => {
    const u = user();
    await openQueue();
    await u.click(screen.getByRole('switch', { name: 'Hide already voted on' }));
    expect(screen.queryByRole('article', { name: KICK })).toBeNull();
    expect(screen.queryByRole('article', { name: BAN })).toBeNull();
    expect(screen.queryByRole('article', { name: /Uma Urgent/ })).toBeNull();
    // Uma Urgent and Eli Early (signed), the kick and the ban (rejected).
    expect(screen.getByText(/4 decisions you already voted on are hidden/)).toBeVisible();
    expect(card(/bob\+builder/)).toBeInTheDocument();
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}decisions-hide-signed`)).toBe('true');
    await u.click(
      screen.getByRole('button', { name: 'Show them: the decisions you already voted on' })
    );
    expect(await screen.findByRole('article', { name: KICK })).toBeInTheDocument();
  });

  it('keeps the choice this device made as "Hide what I signed"', async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}decisions-hide-signed`, 'true');
    await openQueue();
    expect(await screen.findByRole('switch', { name: 'Hide already voted on' }, T)).toBeChecked();
    expect(screen.queryByRole('article', { name: KICK })).toBeNull();
  });

  /** Rejects bob+builder from the keyboard, through Hub, and closes the dialog with Done. */
  async function rejectWithKeyboard(u: ReturnType<typeof user>) {
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'R1' }));
    within(card(/bob\+builder/))
      .getByRole('button', { name: /^Reject: / })
      .focus();
    await u.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Reject this decision' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await u.click(await within(dialog).findByRole('button', { name: 'Done' }, T));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
  }

  it('after answering a card it hides, focus goes to the queue, not the page', async () => {
    const u = user();
    await openQueue();
    await u.click(screen.getByRole('switch', { name: 'Hide already voted on' }));
    await rejectWithKeyboard(u);
    expect(screen.queryByRole('article', { name: /bob\+builder/ })).toBeNull();
    await waitFor(
      () => expect(screen.getByRole('region', { name: /^Collecting approvals/ })).toHaveFocus(),
      T
    );
  }, 20_000);

  it('with nothing hidden, focus goes back to the card that was answered', async () => {
    const u = user();
    await openQueue();
    await rejectWithKeyboard(u);
    expect(
      within(card(/bob\+builder/)).getByText('You rejected (confirming…)')
    ).toBeInTheDocument();
    await waitFor(() => expect(card(/bob\+builder/)).toHaveFocus(), T);
  }, 20_000);
});
