/**
 * The + Propose pages (Simon, 2026-10-18: "Make all of these "+ Propose"
 * windows in the style of the "+ Propose" Nomination", each with a list of
 * the accounts it is about, and a Minter Admin whose removal is ongoing
 * crossed out): who can use them, each kind's list, picking someone and the
 * check, the reason and a ban's length, the Hub steps, and what the page says
 * once it is proposed. Declining a join request is in JoinRequests.test.tsx
 * and Declines.test.tsx, its note in AdminNotes.test.tsx.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { fakeAddress } from '../../../../e2e/world.mjs';
import { base58Decode, base58Encode } from '../../../qortal/base58';
import { proposePath, type ProposePageKind } from '../../../routes/paths';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { mockQortalRequest, qortalCallsFor } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { shortAddress } from '../../../utils/format';
import { PROPOSE_KINDS } from '../proposeKinds';
import { SUBMIT_LABEL } from './proposePageWords';
import ProposePage from './ProposePage';

// Each flow renders a whole page and its Hub steps: a few seconds alone, more under the suite.
vi.setConfig({ testTimeout: 30_000 });
afterEach(() => vi.useRealTimers());

const T = { timeout: 4000 };
const user = () => userEvent.setup();

function Where() {
  const location = useLocation();
  return (
    <output data-testid="at">
      {location.pathname}
      {location.search}
    </output>
  );
}
const at = () => screen.getByTestId('at').textContent ?? '';

async function openPropose(
  kind: ProposePageKind,
  options: { persona?: string; who?: string; setup?: RenderPageOptions['setup'] } = {}
) {
  const rendered = await renderPage(
    <>
      <ProposePage />
      <Where />
    </>,
    {
      persona: options.persona ?? 'admin',
      path: proposePath(kind, options.who),
      route: '/propose/:kind',
      setup: options.setup,
    }
  );
  await screen.findByRole('heading', { level: 1, name: PROPOSE_KINDS[kind].label }, T);
  return rendered;
}

type World = Awaited<ReturnType<typeof openPropose>>['world'];

/** A proposal Hub just sent: on the node at once (unconfirmed), and returned to the app. */
function newProposal(
  world: World,
  admin: { address: string; publicKey: string },
  signature: string,
  fields: Record<string, unknown>
) {
  const tx = {
    timestamp: Date.now(),
    reference: base58Encode(new Uint8Array(64).fill(1)),
    signature,
    txGroupId: 694,
    groupId: 694,
    approvalStatus: 'PENDING',
    creatorAddress: admin.address,
    adminPublicKey: admin.publicKey,
    ...fields,
  };
  world.pending.push(tx);
  return tx;
}

/** The list a page picks from, and the names on its rows (by their links). */
const list = (name: string) => screen.findByRole('list', { name }, T);
const rowNames = (ul: HTMLElement) =>
  within(ul)
    .getAllByRole('link', { name: /: open their page$/ })
    .map((a) => a.getAttribute('aria-label')?.replace(/: open their page$/, '') ?? '');
const rowOf = async (ul: HTMLElement, name: string) =>
  (await within(ul).findByRole('link', { name: `${name}: open their page` }, T)).closest(
    'li'
  ) as HTMLElement;
const submitButton = (kind: ProposePageKind, name?: string) =>
  screen.getByRole('button', {
    name: name ? SUBMIT_LABEL[kind].named(name) : SUBMIT_LABEL[kind].short,
  });

describe('The + Propose pages', () => {
  it('are for Minter Admins: anyone else reads why, with Decisions to follow', async () => {
    const member = await renderPage(<ProposePage />, {
      persona: 'nominator',
      path: proposePath('cancelBan'),
      route: '/propose/:kind',
    });
    expect(await screen.findByText('Only Minter Admins propose this', {}, T)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Decisions' })).toHaveAttribute(
      'href',
      '/decisions?show=decisions'
    );
    expect(screen.queryByRole('list', { name: 'Bans in force' })).toBeNull();
    member.unmount();
    await renderPage(<ProposePage />, {
      persona: 'signedOut',
      path: proposePath('cancelBan'),
      route: '/propose/:kind',
    });
    expect(await screen.findByText('Sign in to propose', {}, T)).toBeVisible();
  });

  it('a kind it doesn’t know goes on to Decisions', async () => {
    await renderPage(<ProposePage />, {
      persona: 'admin',
      path: '/propose/no-such-thing',
      route: '/propose/:kind',
    });
    expect(await screen.findByTestId('navigated-away', {}, T)).toBeInTheDocument();
  });
});

describe('Remove a member', () => {
  it('lists everyone in MINTER but you, A–Z, Minter Admins marked, a waiting removal crossed out', async () => {
    const u = user();
    const { world } = await openPropose('kick');
    expect(screen.getByText('Pick the member, say why.')).toBeVisible();
    const members = await list('MINTER members');
    await waitFor(() => expect(rowNames(members)).toHaveLength(20));
    expect(rowNames(members).slice(0, 2)).toEqual(['Admin A', 'Admin B']);
    expect(rowNames(members)).not.toContain('Avery Admin');
    expect(screen.getByText(/^20 of \d+ shown$/)).toBeVisible();
    const adminA = await rowOf(members, 'Admin A');
    expect(within(adminA).getByText(/^Minter Admin · in MINTER since /)).toBeVisible();
    expect(
      within(adminA).getByRole('button', { name: 'Remove Admin A from MINTER' })
    ).toHaveTextContent('Remove');
    // Kai Target's removal already waits: no Remove, a link to it instead.
    const kick = world.pending.find(
      (t: { type: string; member?: string }) =>
        t.type === 'GROUP_KICK' && t.member === ADDR.kickTarget
    );
    const kai = await rowOf(members, 'Kai Target');
    expect(within(kai).queryByRole('button')).toBeNull();
    expect(
      within(kai).getByRole('link', {
        name: 'A removal is waiting for approvals: open the decision about Kai Target',
      })
    ).toHaveAttribute('href', `/decisions/${kick.signature}`);
    // Searched by name.
    await u.type(
      screen.getByRole('searchbox', { name: 'Search MINTER members, by name or address' }),
      'leo'
    );
    await waitFor(() => expect(rowNames(members)).toEqual(['Leo Learner']), T);
  });

  it('picks someone: their card and the check, then the reason, and the button says what is missing', async () => {
    const u = user();
    await openPropose('kick');
    const members = await list('MINTER members');
    await u.type(
      screen.getByRole('searchbox', { name: 'Search MINTER members, by name or address' }),
      'leo'
    );
    await waitFor(() => expect(rowNames(members)).toEqual(['Leo Learner']), T);
    await u.click(screen.getByRole('button', { name: 'Remove Leo Learner from MINTER' }));
    // The card takes the list's place, and focus.
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    expect(screen.getByText('Level 2 · 90,500 blocks minted · In MINTER')).toBeVisible();
    expect(screen.queryByRole('list', { name: 'MINTER members' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toContainElement(screen.getByText('Leo Learner'))
    );
    expect(at()).toBe(proposePath('kick', ADDR.learner));
    // A reason is required: the button says so and puts focus there.
    const reason = screen.getByRole('textbox', { name: 'Reason' });
    expect(reason).toBeRequired();
    await u.click(submitButton('kick', 'Leo Learner'));
    expect(reason).toHaveFocus();
    expect(reason).toHaveAccessibleDescription(/Say why, in a few words/);
    expect(
      screen.getByText(
        'Can’t propose yet: Say why, in a few words: the other Minter Admins see it.'
      )
    ).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    // Change: back to the list, focus on its search.
    await u.click(screen.getByRole('button', { name: 'Change: pick someone else' }));
    expect(await list('MINTER members')).toBeVisible();
    expect(
      screen.getByRole('searchbox', { name: 'Search MINTER members, by name or address' })
    ).toHaveFocus();
    expect(at()).toBe(proposePath('kick'));
  });

  it('offers removing the admin role first when the member is a Minter Admin', async () => {
    const u = user();
    const { world, address, publicKey } = await openPropose('kick');
    const removal = base58Encode(new Uint8Array(64).fill(3));
    mockQortalRequest('REMOVE_GROUP_ADMIN', (req: Record<string, unknown>) =>
      newProposal(world, { address, publicKey }, removal, {
        type: 'REMOVE_GROUP_ADMIN',
        admin: req.qortalAddress,
      })
    );
    let shownInStep2 = '';
    mockQortalRequest('SIGN_TRANSACTION', () => {
      const step2 = screen.getByText('Step 2 of 2: Approve it').closest('li') as HTMLElement;
      shownInStep2 = step2.textContent ?? '';
      return { type: 'GROUP_APPROVAL', signature: 'OWN' };
    });
    const members = await list('MINTER members');
    await u.click(
      within(await rowOf(members, 'Admin B')).getByRole('button', {
        name: 'Remove Admin B from MINTER',
      })
    );
    expect(await screen.findByText(/This is a Minter Admin/, {}, T)).toBeVisible();
    expect(screen.getByText('Propose removing their admin role first.')).toBeVisible();

    await u.click(screen.getByRole('button', { name: 'Propose removing their admin role' }));
    // Remove a Minter Admin, for the same person: a page of its own.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Remove a Minter Admin' }, T)
    ).toBeVisible();
    expect(at()).toMatch(/^\/propose\/remove-minter-admin\?who=Q/);
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.click(submitButton('removeAdmin', 'Admin B'));

    const hub = await screen.findByRole('dialog', { name: /Remove a Minter Admin: Admin B/ }, T);
    // Two Hub confirmations, both fees up front.
    expect(within(hub).getByText('Step 1 of 2: Propose it')).toBeVisible();
    expect(within(hub).getByText('Step 2 of 2: Approve it')).toBeVisible();
    expect(within(hub).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    expect(
      within(hub).getByText(/^Hub shows Admin B \(Q\w{5}…\) and the group MINTER\.$/)
    ).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Proposed and approved', {}, T)).toBeVisible();
    expect(within(hub).getByText(/After yours it needs 7 more approvals/)).toBeVisible();
    // While Hub asked for step 2, the step showed the proposal's first characters.
    expect(shownInStep2).toContain(
      `For this proposal, "pendingSignature" starts with ${removal.slice(0, 8)}.`
    );
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')[0]).toMatchObject({
      groupId: 694,
      txGroupId: 694,
    });
    expect(qortalCallsFor('KICK_FROM_GROUP')).toHaveLength(0);
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(removal);

    // Done: the page says it is proposed, with its tab in Decisions.
    await u.click(within(hub).getByRole('button', { name: 'Done' }));
    const done = await screen.findByRole('heading', { level: 2, name: /^Proposed: / }, T);
    expect(done).toHaveTextContent('Proposed: Remove a Minter Admin: Admin B');
    await waitFor(() => expect(done).toHaveFocus());
    expect(screen.getByRole('link', { name: 'Open Decisions' })).toHaveAttribute(
      'href',
      '/decisions?show=removeAdmins'
    );
    // Propose another: the list again, where the row says it is on its way.
    await u.click(screen.getByRole('button', { name: 'Propose another' }));
    const admins = await list('Minter Admins');
    expect(
      await within(await rowOf(admins, 'Admin B')).findByText('Proposed ✓ (confirming…)', {}, T)
    ).toBeVisible();
  });

  it('says plainly when the proposal went through and the own approval did not', async () => {
    const u = user();
    const { world, address, publicKey } = await openPropose('kick', { who: ADDR.learner });
    mockQortalRequest('KICK_FROM_GROUP', (req: Record<string, unknown>) =>
      newProposal(world, { address, publicKey }, base58Encode(new Uint8Array(64).fill(4)), {
        type: 'GROUP_KICK',
        member: req.qortalAddress,
        reason: req.reason,
      })
    );
    // SIGN_TRANSACTION keeps the world's answer: declined.
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.type(screen.getByRole('textbox', { name: 'Reason' }), 'Not minting');
    await u.click(submitButton('kick', 'Leo Learner'));
    const hub = await screen.findByRole('dialog', { name: /Remove from MINTER: Leo Learner/ }, T);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Step 1 done: proposed', {}, T)).toBeVisible();
    expect(within(hub).getByText(/You cancelled step 2 in Hub/)).toBeVisible();
    expect(
      within(hub).getByText(
        /Your proposal is waiting for approvals. Once it is in a block, approve/
      )
    ).toBeVisible();
    expect(qortalCallsFor('KICK_FROM_GROUP')).toHaveLength(1);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(1);
    // Sent already: Done, not back to the form.
    expect(within(hub).getByRole('button', { name: 'Done' })).toHaveFocus();
    expect(within(hub).queryByRole('button', { name: 'Back to the form' })).toBeNull();
  });
});

describe('Ban an account', () => {
  it('keeps everything typed when Hub’s step goes back, or after a cancel in Hub', async () => {
    const u = user();
    await openPropose('ban', { who: ADDR.learner });
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.type(screen.getByRole('textbox', { name: 'Reason' }), 'Spam in the chat');
    await u.click(screen.getByRole('radio', { name: /A number of days/ }));
    await u.click(submitButton('ban', 'Leo Learner'));

    let hub = await screen.findByRole('dialog', { name: /Ban from MINTER: Leo Learner/ }, T);
    await u.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveValue('Spam in the chat');
    expect(screen.getByRole('radio', { name: /A number of days/ })).toBeChecked();

    // The mock world declines every write, as a cancel in Hub would.
    await u.click(submitButton('ban', 'Leo Learner'));
    hub = await screen.findByRole('dialog', { name: /Ban from MINTER: Leo Learner/ }, T);
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(hub).findByText('Cancelled in Hub. Nothing was sent.', {}, T)
    ).toBeVisible();
    await u.click(within(hub).getByRole('button', { name: 'Back to the form' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), T);
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveValue('Spam in the chat');
    // Nothing went out, so the page didn't move on.
    expect(screen.queryByRole('heading', { level: 2, name: /^Proposed: / })).toBeNull();
  });

  it('refuses a ban longer than 24 days before Hub is asked', async () => {
    const u = user();
    await openPropose('ban', { who: ADDR.learner });
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.type(screen.getByRole('textbox', { name: 'Reason' }), 'Spam in the chat');
    await u.click(screen.getByRole('radio', { name: /A number of days/ }));
    const days = screen.getByRole('textbox', { name: 'Days' });
    await u.clear(days);
    await u.type(days, '25');
    expect(days).toHaveAccessibleDescription(/A ban can last up to 24 days/);
    // The button says what is wrong: focus goes to the length, and Hub isn't next.
    await u.click(submitButton('ban', 'Leo Learner'));
    expect(days).toHaveFocus();
    expect(screen.queryByRole('dialog', { name: /Ban from MINTER/ })).toBeNull();
    await u.clear(days);
    await u.type(days, '24');
    // Core counts a ban from its proposal, so the form says so.
    expect(
      screen.getByText(/^24 days, counted from when it is proposed, not from approval/)
    ).toBeVisible();
    await u.click(submitButton('ban', 'Leo Learner'));
    const hub = await screen.findByRole('dialog', { name: /Ban from MINTER: Leo Learner/ }, T);
    expect(
      within(hub).getByText(/24 days, counted from when it is proposed, not from approval/)
    ).toBeInTheDocument();
    expect(qortalCallsFor('BAN_FROM_GROUP')).toHaveLength(0);
  });

  it('lists the members, and looks up anyone outside MINTER too', async () => {
    const u = user();
    await openPropose('ban');
    expect(await list('MINTER members')).toBeVisible();
    const outside = screen.getByRole('region', { name: 'Someone outside MINTER' });
    await u.type(within(outside).getByRole('combobox'), `${ADDR.newcomer}{Enter}`);
    expect(await screen.findByText(/· Not in MINTER$/, {}, T)).toBeVisible();
    expect(at()).toBe(proposePath('ban', ADDR.newcomer));
  });
});

describe('Make a Minter Admin', () => {
  it('lists the members who aren’t Minter Admins', async () => {
    await openPropose('addAdmin');
    const members = await list('MINTER members');
    await waitFor(() => expect(rowNames(members).length).toBeGreaterThan(0));
    expect(rowNames(members).some((name) => /^Admin [A-Z]$/.test(name))).toBe(false);
    expect(
      screen.getByRole('button', { name: `Make admin: ${rowNames(members)[0]}` })
    ).toHaveTextContent('Make admin');
  });
});

describe('Remove a Minter Admin', () => {
  it('lists the Minter Admins; one whose removal waits is crossed out, and you step down elsewhere', async () => {
    const { address } = await openPropose('removeAdmin');
    const admins = await list('Minter Admins');
    await waitFor(() => expect(rowNames(admins)).toContain('Dex Demote'));
    // Dex Demote's removal waits: no Remove, the link to it.
    const dex = await rowOf(admins, 'Dex Demote');
    expect(within(dex).queryByRole('button')).toBeNull();
    expect(
      within(dex).getByRole('link', {
        name: /^A removal is waiting for approvals: open the decision about Dex Demote$/,
      })
    ).toBeVisible();
    expect(within(dex).getByText('Dex Demote')).toHaveStyle({ textDecoration: 'line-through' });
    // Yourself: Step down, on your own Minter Profile.
    const me = await rowOf(admins, 'Avery Admin');
    expect(within(me).queryByRole('button')).toBeNull();
    expect(
      within(me).getByRole('link', { name: 'Step down on your Minter Profile' })
    ).toHaveAttribute('href', `/explorer/account/${address}/mintership`);
    expect(
      within(await rowOf(admins, 'Admin B')).getByRole('button', {
        name: 'Remove Admin B as Minter Admin',
      })
    ).toBeVisible();
  });

  it('points to Step down on your own Minter Profile, not a proposal here', async () => {
    const u = user();
    const { address } = await openPropose('removeAdmin', { who: ADDR.admin });
    expect(
      await screen.findByText(
        'That’s you. To step down, use Step down as Minter Admin on your own Minter Profile.',
        {},
        T
      )
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open your Minter Profile' })).toHaveAttribute(
      'href',
      `/explorer/account/${address}/mintership`
    );
    expect(screen.queryByText('Nothing stops this proposal.')).toBeNull();
    await u.click(submitButton('removeAdmin', 'Avery Admin'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(0);
  });
});

describe('Lift a ban', () => {
  it('lists the bans in force, newest first, with when and why; a lift that waits is crossed out', async () => {
    await openPropose('cancelBan');
    const bans = await list('Bans in force');
    await waitFor(() => expect(rowNames(bans)).toHaveLength(2));
    // The old ban ran out: not listed.
    const lift = within(bans).getAllByRole('listitem')[0];
    expect(lift).toHaveTextContent(/Banned 40 days ago, permanently/);
    expect(lift).toHaveTextContent('Reason: “Spam”');
    expect(within(lift).queryByRole('button')).toBeNull();
    expect(within(lift).getByText('Lifting it is waiting for approvals')).toBeVisible();
    const bram = await rowOf(bans, 'Bram Banned');
    expect(bram).toHaveTextContent('Reason: “Banned by Minter Admins”');
    expect(within(bram).getByRole('button', { name: 'Lift Bram Banned’s ban' })).toBeVisible();
  });

  it('checks both fees quietly: says nothing about the balance until it can’t pay them', async () => {
    const u = user();
    const { world, address } = await openPropose('cancelBan');
    const bans = await list('Bans in force');
    await u.click(
      within(await rowOf(bans, 'Bram Banned')).getByRole('button', {
        name: 'Lift Bram Banned’s ban',
      })
    );
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    // No reason for a lift: straight to Hub's steps.
    expect(screen.queryByRole('textbox', { name: 'Reason' })).toBeNull();
    await u.click(submitButton('cancelBan', 'Bram Banned'));
    const hub = await screen.findByRole('dialog', { name: /^Lift a ban: / }, T);
    expect(within(hub).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    expect(within(hub).queryByText(/balance/i)).toBeNull();

    // It can't pay both: the one message, before Hub is asked anything.
    world.accounts.get(address).balance = 0.015;
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(hub).findByText(
        'This needs 0.02 QORT for the two fees, and your confirmed balance is 0.015 QORT.',
        {},
        T
      )
    ).toBeVisible();
    expect(qortalCallsFor('CANCEL_GROUP_BAN')).toHaveLength(0);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });
});

describe('Cancel an approved invite', () => {
  const stale = (n: number) => shortAddress(fakeAddress(`stale-${n}`));

  it('lists the unused invites (the oldest approval first), then members’, and cancels the older ones in one go', async () => {
    const { world } = await openPropose('cancelInvite');
    const invites = await list('Approved invites');
    await waitFor(() => expect(rowNames(invites)).toHaveLength(5));
    // A member's invite comes last, said as such.
    const member = await rowOf(invites, 'Member 6');
    expect(member).toHaveTextContent(/· already a member/);
    expect(rowNames(invites).at(-1)).toBe('Member 6');
    // Ada's was approved recently: they may still press Join now.
    const ada = await rowOf(invites, 'Ada Approved');
    expect(
      await within(ada).findByText('Approved recently: they may still press Join now.', {}, T)
    ).toBeVisible();
    // stale-1's cancellation waits: crossed out, with a link to it.
    const cancel = [...world.cancelTargets.entries()].find(
      ([, target]: [string, { invitee: string }]) => target.invitee === fakeAddress('stale-1')
    )?.[0];
    const waiting = await rowOf(invites, stale(1));
    expect(within(waiting).queryByRole('button')).toBeNull();
    expect(
      within(waiting).getByRole('link', {
        name: `A cancellation is waiting for approvals: open the decision about ${stale(1)}`,
      })
    ).toHaveAttribute('href', `/decisions/${cancel}`);
    // Only the two older ones with nothing waiting go into "all".
    expect(
      await screen.findByRole('button', { name: 'Propose cancelling all 2 older ones' }, T)
    ).toBeVisible();
  });

  it('proposes cancelling one, picked from the list and checked, then approves it', async () => {
    const u = user();
    const { world, address, publicKey } = await openPropose('cancelInvite');
    const invitee = fakeAddress('stale-2');
    const cancel = base58Encode(new Uint8Array(64).fill(6));
    mockQortalRequest('CANCEL_GROUP_INVITE', (req: Record<string, unknown>) => {
      const tx = newProposal(world, { address, publicKey }, cancel, {
        type: 'CANCEL_GROUP_INVITE',
        groupId: undefined,
      });
      world.cancelTargets.set(cancel, { groupId: 694, invitee: req.qortalAddress });
      return tx;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN' }));
    const invites = await list('Approved invites');
    await u.click(
      within(await rowOf(invites, stale(2))).getByRole('button', {
        name: `Cancel invite for ${stale(2)}`,
      })
    );
    expect(await screen.findByText('Nothing stops this proposal.', {}, T)).toBeVisible();
    await u.click(submitButton('cancelInvite', stale(2)));
    const hub = await screen.findByRole('dialog', { name: /^Cancel an approved invite: / }, T);
    // No name: the short address once, not twice.
    expect(within(hub).getByText(`Hub shows ${stale(2)} and the group MINTER.`)).toBeVisible();
    expect(within(hub).getByText('Step 2 of 2: Approve it')).toBeVisible();
    expect(within(hub).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    await u.click(within(hub).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(hub).findByText('Proposed and approved', {}, T)).toBeVisible();
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')).toEqual([
      expect.objectContaining({ groupId: 694, qortalAddress: invitee, txGroupId: 694 }),
    ]);
    const bytes = base58Decode(String(qortalCallsFor('SIGN_TRANSACTION')[0].unsignedBytes));
    expect(base58Encode(bytes.slice(112, 176))).toBe(cancel);
  });

  it('says an invite approved recently may still be used, on its card too', async () => {
    const u = user();
    await openPropose('cancelInvite');
    const invites = await list('Approved invites');
    await u.click(
      within(await rowOf(invites, 'Ada Approved')).getByRole('button', {
        name: 'Cancel invite for Ada Approved',
      })
    );
    expect(
      await screen.findByText(/^Approved \d+ days ago: they may still press Join now\.$/, {}, T)
    ).toBeVisible();
  });

  it('"Propose cancelling all" approves each cancellation straight after proposing it', async () => {
    const u = user();
    const { world, address, publicKey } = await openPropose('cancelInvite');
    let n = 0;
    mockQortalRequest('CANCEL_GROUP_INVITE', (req: Record<string, unknown>) => {
      n++;
      const signature = base58Encode(new Uint8Array(64).fill(20 + n));
      const tx = newProposal(world, { address, publicKey }, signature, {
        type: 'CANCEL_GROUP_INVITE',
        groupId: undefined,
      });
      world.cancelTargets.set(signature, { groupId: 694, invitee: req.qortalAddress });
      return tx;
    });
    mockQortalRequest('SIGN_TRANSACTION', () => ({ type: 'GROUP_APPROVAL', signature: 'OWN' }));
    await u.click(
      await screen.findByRole('button', { name: 'Propose cancelling all 2 older ones' }, T)
    );
    const dialog = await screen.findByRole('dialog', { name: 'Cancel stale invites' });
    expect(within(dialog).getByText(/so you approve each one straight after it/)).toBeVisible();
    expect(
      within(dialog).getByText('4 Hub confirmations, two for each, one after another:')
    ).toBeVisible();
    expect(within(dialog).getByText(/Fees in total: 0.04 QORT \(4 × 0.01 QORT\)/)).toBeVisible();
    expect(within(dialog).queryByText(/balance/)).toBeNull();
    expect(qortalCallsFor('CANCEL_GROUP_INVITE')).toHaveLength(0);

    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(
      await within(dialog).findByText(
        '2 of 2 proposed and approved. Each counts once it is in a block.',
        {},
        T
      )
    ).toBeVisible();
    expect(qortalCallsFor('CANCEL_GROUP_INVITE').map((c) => c.qortalAddress)).toEqual([
      fakeAddress('stale-2'),
      fakeAddress('stale-3'),
    ]);
    // Each approval is on the cancellation just proposed.
    const signed = qortalCallsFor('SIGN_TRANSACTION').map((c) =>
      base58Encode(base58Decode(String(c.unsignedBytes)).slice(112, 176))
    );
    expect(signed).toEqual([
      base58Encode(new Uint8Array(64).fill(21)),
      base58Encode(new Uint8Array(64).fill(22)),
    ]);
    expect(within(dialog).getByRole('button', { name: 'Done' })).toHaveFocus();
  });

  it('says so when there is no approved invite to cancel', async () => {
    await openPropose('cancelInvite', {
      setup: (world) => {
        world.storedInvites.length = 0;
      },
    });
    expect(
      await screen.findByText('There are no approved invites stored right now', {}, T)
    ).toBeVisible();
    expect(screen.getByText('Pick an invite first.')).toBeVisible();
  });

  it('lists a member’s invite when it is the only one stored', async () => {
    await openPropose('cancelInvite', {
      setup: (world) => {
        world.storedInvites.splice(0, world.storedInvites.length - 1);
      },
    });
    const invites = await list('Approved invites');
    await waitFor(() => expect(rowNames(invites)).toEqual(['Member 6']), T);
    expect(screen.queryByRole('button', { name: /^Propose cancelling all/ })).toBeNull();
  });
});
