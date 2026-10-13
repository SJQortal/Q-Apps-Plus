/**
 * One decision's own page (/decisions/<signature>), its shareable link:
 * waiting (the queue's card, Sign for Minter Admins) and decided (how it
 * ended, who signed), plus old /decisions?d= links.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { HubThemeProvider } from '../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme';
import { renderPage } from '../../test/render';
import { fetchCalls } from '../../test/setup';
import { ADDR, addOtherPending, type InstalledWorld } from '../../test/world';
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
    expect(within(card).getByRole('button', { name: /^Sign: Remove from MINTER/ })).toBeVisible();
    // The header copies the link; the card on its own page doesn't repeat it.
    expect(screen.getByRole('button', { name: 'Copy a link to this decision' })).toBeVisible();
    expect(within(card).queryByRole('button', { name: /^Copy link/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Decision' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All decisions' })).toHaveAttribute(
      'href',
      '/decisions'
    );
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
    expect(within(card).queryByRole('button', { name: /^Sign/ })).toBeNull();
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
    expect(within(card).getByRole('button', { name: /^Sign: / })).toBeVisible();
  });
});

describe('A decision’s own page: decided', () => {
  it('says how it ended, when, and who signed', async () => {
    await open('learner', (world) => addDecidedSignatures(world));
    const card = await screen.findByRole('article', { name: 'Add to MINTER, Nora Nominator' }, T);
    expect(within(card).getByText('Approved')).toBeVisible();
    expect(
      within(card).getByText('Enough Minter Admins signed, and Core applied it.')
    ).toBeVisible();
    expect(within(card).getByText(/^Decided in block 2,301,400, /)).toBeVisible();
    expect(await within(card).findByText('Signed by 8 Minter Admins.', {}, T)).toBeVisible();
    expect(within(card).getByRole('list', { name: 'Signed by 8 Minter Admins' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'The nomination' })).toHaveAttribute(
      'href',
      `/nominations/${ADDR.nominator}`
    );
    // Its own blocks only: one bounded search, never the whole history.
    const searches = fetchCalls.filter((p) => p.includes('txType=GROUP_APPROVAL'));
    expect(searches.some((p) => /startBlock=2299990&blockLimit=1411/.test(p))).toBe(true);
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
      within(card).getByText('Not enough signatures in time. They can be nominated again.')
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
    expect(within(card).getByText('Approved')).toBeVisible();
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
    expect(screen.queryByRole('button', { name: /^Sign/ })).toBeNull();
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
