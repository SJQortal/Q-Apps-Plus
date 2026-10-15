/**
 * One decision's own page (/decisions/<signature>), its shareable link:
 * waiting (the queue's card, Sign for Minter Admins) and decided (how it
 * ended, who signed), plus old /decisions?d= links.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';
import { renderPage } from '../../test/render';
import { fetchCalls } from '../../test/setup';
import { ADDR, TIP, addOtherPending, type InstalledWorld } from '../../test/world';
import { invalidate } from '../../data/query';
import { addDecidedSignatures } from '../../../e2e/world.mjs';
import DecisionPage from './DecisionPage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };

type World = InstalledWorld['world'];

function open(persona: string, pick: (world: World) => string, setup?: (world: World) => void) {
  let path = '';
  return renderPage(<DecisionPage />, {
    persona,
    route: '/decisions/:signature',
    get path() {
      return path;
    },
    setup: (world) => {
      setup?.(world);
      path = `/decisions/${pick(world)}`;
    },
  });
}

const pendingOf = (type: string) => (world: World) =>
  world.pending.find((t: { type: string }) => t.type === type).signature as string;

describe('A decision’s own page: still waiting', () => {
  it('shows the queue’s card with Sign to a Minter Admin, and a link to copy', async () => {
    await open('admin', pendingOf('GROUP_KICK'));
    const card = await screen.findByRole('article', { name: 'Remove from MINTER, Kai Target' }, T);
    expect(within(card).getByText('Not minting for 6 months')).toBeVisible();
    expect(
      within(card).getByRole('button', { name: /^Approve: Remove from MINTER/ })
    ).toBeVisible();
    // The header copies the link; the card on its own page doesn't repeat it.
    expect(screen.getByRole('button', { name: 'Copy a link to this decision' })).toBeVisible();
    expect(within(card).queryByRole('button', { name: /^Copy link/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Decision' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All decisions' })).toHaveAttribute(
      'href',
      '/decisions'
    );
  });

  it('offers what the queue offers a Minter Admin: Reject and Considering, each with its dialog', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    await open('admin', pendingOf('GROUP_KICK'));
    const card = await screen.findByRole('article', { name: 'Remove from MINTER, Kai Target' }, T);
    await user.click(within(card).getByRole('button', { name: /^Reject: Remove from MINTER/ }));
    const reject = await screen.findByRole('dialog', {}, T);
    expect(reject).toHaveTextContent(/rejection/i);
    await user.click(within(reject).getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Considering, as on the queue's card.
    await user.click(
      await within(card).findByRole('button', { name: /^Considering: Remove from MINTER/ }, T)
    );
    expect(await screen.findByRole('dialog', { name: 'Mark as considering' }, T)).toBeVisible();
  });

  it('shows an admin who is considering it “No longer considering”', async () => {
    await open('admin', pendingOf('GROUP_KICK'), (world) => {
      const kick = world.pending.find((t: { type: string }) => t.type === 'GROUP_KICK');
      world.records.push({
        name: 'Avery Admin',
        identifier: `qmp-considering-${kick.signature.slice(0, 40)}`,
        created: Date.now() - 60_000,
        body: { v: 1, pendingSignature: kick.signature },
      });
    });
    const card = await screen.findByRole('article', { name: 'Remove from MINTER, Kai Target' }, T);
    expect(
      await within(card).findByRole('button', { name: /^No longer considering: / }, T)
    ).toBeVisible();
  });

  it('says how it ended when it is decided while open, and keeps focus on the page', async () => {
    const { world } = await open('admin', pendingOf('GROUP_KICK'));
    const card = await screen.findByRole('article', { name: 'Remove from MINTER, Kai Target' }, T);
    act(() => card.focus());
    expect(card).toHaveFocus();
    // Core approves it: the queue no longer lists it, and its transaction says so.
    const at = world.pending.findIndex((t: { type: string }) => t.type === 'GROUP_KICK');
    const [kick] = world.pending.splice(at, 1);
    world.decided.push({ ...kick, approvalStatus: 'APPROVED', approvalHeight: TIP });
    vi.setSystemTime(Date.now() + 60_000);
    act(() => {
      invalidate('pending:');
      invalidate('decisions:');
    });
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('status')
            .some((el) => el.textContent === 'This decision has ended: Approved.')
        ).toBe(true),
      T
    );
    expect(screen.getByRole('heading', { name: 'Decided' })).toHaveFocus();
    expect(screen.queryByText(/doesn’t list it yet/)).toBeNull();
  });

  it('keeps an open dialog through the swap when it is decided meanwhile', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const { world } = await open('admin', pendingOf('GROUP_KICK'));
    const card = await screen.findByRole('article', { name: 'Remove from MINTER, Kai Target' }, T);
    await user.click(within(card).getByRole('button', { name: /^Reject: Remove from MINTER/ }));
    const dialog = await screen.findByRole('dialog', {}, T);
    const at = world.pending.findIndex((t: { type: string }) => t.type === 'GROUP_KICK');
    const [kick] = world.pending.splice(at, 1);
    world.decided.push({ ...kick, approvalStatus: 'APPROVED', approvalHeight: TIP });
    vi.setSystemTime(Date.now() + 60_000);
    act(() => {
      invalidate('pending:');
      invalidate('decisions:');
    });
    await waitFor(
      () =>
        expect(
          screen
            .getAllByRole('status', { hidden: true })
            .some((el) => el.textContent === 'This decision has ended: Approved.')
        ).toBe(true),
      T
    );
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBe(dialog);
  });

  it('is read-only for everyone else, and an invite links to its nomination', async () => {
    await open(
      'nominator',
      (world) =>
        world.pending.find(
          (t: { type: string; invitee?: string }) =>
            t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominatedSigning
        ).signature
    );
    const card = await screen.findByRole('article', { name: /^Add to MINTER, bob\+builder/ }, T);
    expect(within(card).queryByRole('button', { name: /^Approve/ })).toBeNull();
    expect(await within(card).findByText(/Nominated by/, {}, T)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'The nomination' })).toHaveAttribute(
      'href',
      `/nominations/${ADDR.nominatedSigning}`
    );
  });

  it('shows an admin change proposed in another app like any decision', async () => {
    await open('admin', pendingOf('ADD_GROUP_ADMIN'));
    const card = await screen.findByRole(
      'article',
      { name: 'Become a Minter Admin, Pia Promote' },
      T
    );
    expect(within(card).getByRole('button', { name: /^Approve: / })).toBeVisible();
  });
});

describe('A decision’s own page: decided', () => {
  it('says how it ended, when, and who signed', async () => {
    await open('learner', (world) => addDecidedSignatures(world));
    const card = await screen.findByRole('article', { name: 'Add to MINTER, Nora Nominator' }, T);
    expect(within(card).getByText('Approved', { selector: '.MuiChip-label' })).toBeVisible();
    expect(
      within(card).getByText('Enough Minter Admins approved, and Core applied it.')
    ).toBeVisible();
    expect(within(card).getByText(/^Decided in block 2,301,400, /)).toBeVisible();
    expect(
      await within(card).findByRole('list', { name: 'Approved by 8 Minter Admins' }, T)
    ).toBeVisible();
    // Nobody rejected it; a decided card has no Considering column.
    expect(within(card).getByRole('heading', { name: /^Rejected/ })).toHaveTextContent('Rejected0');
    expect(within(card).queryByRole('heading', { name: /^Considering/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'The nomination' })).toHaveAttribute(
      'href',
      `/nominations/${ADDR.nominator}`
    );
    // Its own blocks only, up to the one before its decision block (the last
    // whose signatures counted): one bounded search, never the whole history.
    const searches = fetchCalls.filter((p) => p.includes('txType=GROUP_APPROVAL'));
    expect(searches.some((p) => /startBlock=2299990&blockLimit=1410/.test(p))).toBe(true);
    expect(fetchCalls.some((p) => /limit=0(&|$)/.test(p))).toBe(false);
  });

  it('says an expired nomination can be nominated again', async () => {
    await open(
      'learner',
      (world) =>
        world.decided.find((t: { approvalStatus: string }) => t.approvalStatus === 'EXPIRED')
          .signature
    );
    const card = await screen.findByRole('article', { name: /^Add to MINTER, / }, T);
    expect(within(card).getByText('Expired')).toBeVisible();
    expect(
      within(card).getByText('Not enough approvals in time. They can be nominated again.')
    ).toBeVisible();
    expect(within(card).getByText(/^Expired in block /)).toBeVisible();
  });

  it('words a removal that was applied, with its reason', async () => {
    await open(
      'learner',
      (world) => world.decided.find((t: { type: string }) => t.type === 'GROUP_KICK').signature
    );
    const card = await screen.findByRole('article', { name: /^Remove from MINTER, Kit Kicked/ }, T);
    expect(within(card).getByText('Kicked by Minter Admins')).toBeVisible();
    expect(within(card).getByText('Approved', { selector: '.MuiChip-label' })).toBeVisible();
  });
});

describe('A decision’s own page: links that aren’t a MINTER decision', () => {
  it('says so for a signature the node doesn’t know', async () => {
    await open('learner', () => 'NotARealSignature');
    expect(await screen.findByText('No decision with this signature', {}, T)).toBeVisible();
  });

  it('says so for another kind of transaction', async () => {
    await open('admin', (world) => addOtherPending(world)[1]);
    expect(await screen.findByText('This isn’t a MINTER decision', {}, T)).toBeVisible();
    expect(screen.getByText(/another kind \(register name\)/)).toBeVisible();
  });

  it('shows the unusual approval route to Minter Admins only, with its neutral label', async () => {
    const pick = (world: World) => world.unusual.signature as string;
    const first = await open('admin', pick);
    expect(await screen.findByText('Unusual approval route.', {}, T)).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
    first.unmount();
    await open('learner', pick);
    expect(
      await screen.findByText('This one is listed for Minter Admins only', {}, T)
    ).toBeVisible();
    expect(screen.queryByText('Unusual approval route.')).toBeNull();
  });
});

describe('Old /decisions?d=<signature> links', () => {
  function Probe() {
    const { signature } = useParams();
    return <p>Decision page for {signature}</p>;
  }

  function at(path: string) {
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/decisions" element={<DecisionsPage />} />
            <Route path="/decisions/:signature" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </HubThemeProvider>
    );
  }

  it('open the decision’s own page', async () => {
    at('/decisions?d=Abc123');
    expect(await screen.findByText('Decision page for Abc123')).toBeInTheDocument();
  });

  it('still work when Hub appended its own query to the value', async () => {
    at('/decisions?d=Abc123?theme=dark&lang=en');
    expect(await screen.findByText('Decision page for Abc123')).toBeInTheDocument();
  });
});
