import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { ADDR } from '../../test/world';
import { addConsidering } from '../../../e2e/world.mjs';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import HomePage from '../home/HomePage';
import PersonPage from '../person/PersonPage';
import DecisionsPage from './DecisionsPage';

afterEach(() => vi.useRealTimers());

const user = () => userEvent.setup();
const T = { timeout: 4000 };

async function openDecisions(persona = 'admin', setup?: RenderPageOptions['setup']) {
  const rendered = await renderPage(<DecisionsPage />, {
    persona,
    path: '/decisions',
    route: '/decisions',
    setup,
  });
  await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
  return rendered;
}

describe('Considering on the Decisions page', () => {
  it('shows who is considering next to the signers, with notes, to everyone', async () => {
    await openDecisions('learner', (world) => addConsidering(world));
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    const line = await within(card).findByText(/^Considering:/, {}, T);
    // (Each name follows its avatar's letter.)
    expect(line).toHaveTextContent(
      /^Considering: A?Admin K \(“Waiting to hear back from them in Q-Chat about their node\.”\), A?Admin L$/
    );
    expect(within(line).getByRole('link', { name: 'Admin K: open their page' })).toBeVisible();
    // Not the admin who cleared theirs, nor the one who signed since, nor a member.
    expect(line).not.toHaveTextContent('Admin N');
    expect(line).not.toHaveTextContent('Admin B');
    expect(line).not.toHaveTextContent('Nora');
    // The waiting nomination shows the count.
    expect(await screen.findByText('1 Minter Admin is considering', {}, T)).toBeVisible();
    // Members can't mark anything.
    expect(screen.queryByRole('button', { name: /^Considering: / })).toBeNull();
    // One search for all the cards, paged at 100.
    const searches = fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
      p.includes('qmp-considering-')
    );
    expect(new Set(searches).size).toBe(1);
    expect(searches.every((p) => /limit=100/.test(p))).toBe(true);
  });

  it('an admin marks a decision as considering: the fee first, then Considering (publishing…)', async () => {
    const u = user();
    const { world } = await openDecisions('admin');
    const pending = world.pending.find(
      (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
    ).signature as string;
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'C1' }));
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    await u.click(within(card).getByRole('button', { name: /^Considering: / }));
    const dialog = await screen.findByRole('dialog', { name: 'Mark as considering' });
    expect(within(dialog).getByText(/It changes nothing on chain/)).toBeVisible();
    expect(within(dialog).getByText(/Fee: 0.01 QORT/)).toBeInTheDocument();
    await u.type(within(dialog).getByRole('textbox', { name: 'A note (optional)' }), 'Soon.');
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Marked as considering', {}, T)).toBeInTheDocument();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call.identifier).toBe(`qmp-considering-${pending.slice(0, 40)}`);
    expect(JSON.parse(atob(String(call.data64)))).toEqual({
      v: 1,
      pendingSignature: pending,
      note: 'Soon.',
    });
    await u.click(within(dialog).getByRole('button', { name: 'Done' }));
    const after = await screen.findByRole('article', { name: /Add to MINTER, bob\+builder/ });
    expect(await within(after).findByText('Considering (publishing…)')).toBeInTheDocument();
    expect(within(after).getByRole('button', { name: /^No longer considering: / })).toBeDisabled();
  }, 20_000);

  it('an admin who is considering can say they no longer are', async () => {
    const u = user();
    await openDecisions('admin', (world) => {
      const invite = world.pending.find(
        (t: { invitee?: string }) => t.invitee === ADDR.nominatedSigning
      );
      world.records.push({
        name: 'Avery Admin',
        identifier: `qmp-considering-${invite.signature.slice(0, 40)}`,
        created: Date.now() - 60_000,
        body: { v: 1, pendingSignature: invite.signature },
      });
    });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', () => ({ type: 'ARBITRARY', signature: 'C2' }));
    const card = screen.getByRole('article', { name: /Add to MINTER, bob\+builder/ });
    expect(await within(card).findByText('Considering', {}, T)).toBeInTheDocument();
    expect(within(card).getByText(/^Considering:/)).toHaveTextContent('Avery Admin');
    await u.click(within(card).getByRole('button', { name: /^No longer considering: / }));
    const dialog = await screen.findByRole('dialog', { name: 'No longer considering' });
    expect(within(dialog).getByText(/QDN can’t delete a record/)).toBeVisible();
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Updated', {}, T)).toBeInTheDocument();
    expect(
      JSON.parse(atob(String(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0].data64)))
    ).toMatchObject({
      cleared: true,
    });
  }, 20_000);

  it('offers Considering on a nomination waiting for its first signature', async () => {
    await openDecisions('admin');
    expect(
      await screen.findByRole('button', { name: 'Considering: Nomination of Wren Waiting' }, T)
    ).toBeVisible();
  });
});

describe('Considering for the nominee and on person pages', () => {
  it("the nominee's Home says how many Minter Admins are considering", async () => {
    await renderPage(<HomePage />, {
      persona: 'nominatedSigning',
      setup: (world) => addConsidering(world),
    });
    expect(
      await screen.findByText(/^2 Minter Admins are considering: they’ve looked at it/, {}, T)
    ).toBeVisible();
  });

  it("a person's page shows the count on their nomination", async () => {
    await renderPage(<PersonPage />, {
      persona: 'learner',
      path: `/people/${ADDR.nominatedWaiting}`,
      route: '/people/:address',
      setup: (world) => addConsidering(world),
    });
    expect(await screen.findByText('1 Minter Admin is considering', {}, T)).toBeVisible();
  });
});
