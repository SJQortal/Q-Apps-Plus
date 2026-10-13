import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PROPOSE_NOMINATION, proposeNominationFor } from '../../constants/words';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockFetchRoute, qortalCalls, qortalCallsFor } from '../../test/setup';
import { addTargetShift, fakeAddress } from '../../../e2e/world.mjs';
import { ADDR, NOW, PEOPLE } from '../../test/world';
import { CoreHttpError } from '../../qortal/client';
import { formatDate } from '../../utils/format';
import PersonPage from './PersonPage';
import { isInvalidAddress } from './personWords';

const ROUTE = '/people/:address';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

function visit(who: string, persona = 'admin') {
  return renderPage(<PersonPage />, {
    persona,
    path: `/people/${encodeURIComponent(who)}`,
    route: ROUTE,
  });
}

function section(name: string) {
  return screen.findByRole('region', { name });
}

describe('Person page', () => {
  it('shows a nominee being signed for, as a Minter Admin sees them', async () => {
    const { posts } = await visit(ADDR.nominatedSigning, 'admin');
    expect(
      await screen.findByRole('heading', { level: 2, name: PEOPLE.nominatedSigning.name as string })
    ).toBeInTheDocument();
    expect(screen.getByText('Level 0')).toBeInTheDocument();
    expect(screen.getByText('Nominated')).toBeInTheDocument();
    expect(screen.getByText('Join request sent')).toBeInTheDocument();
    expect(
      screen.getByText("Nominated for MINTER, and they're ready: approval adds them at once.")
    ).toBeInTheDocument();
    expect(screen.getByText('7,200 blocks')).toBeInTheDocument();
    // Admins are already signing: no Propose nomination button, a way to the decision instead.
    expect(screen.queryByRole('link', { name: new RegExp(`^${PROPOSE_NOMINATION}`) })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open in Decisions' }).getAttribute('href')).toMatch(
      /^\/decisions\/\w+$/
    );
    expect(
      screen.getByText('Minter Admins are already signing a nomination for this person.')
    ).toBeInTheDocument();
    const nomination = await section('Nomination');
    expect(within(nomination).getByText('Collecting signatures')).toBeInTheDocument();
    const timeline = await section('MINTER timeline');
    expect(await within(timeline).findByText('Nominated for MINTER')).toBeInTheDocument();
    const original = await section('From the original app');
    expect(
      await within(original).findByText(`${PEOPLE.nominatedSigning.name} for the MINTER group`)
    ).toBeInTheDocument();
    expect(within(original).getByText('Looked through all 27 cards.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy a link to this person' })).toBeInTheDocument();
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('gives a nominee their next step on their own page (the link a nominator sends)', async () => {
    await visit(ADDR.nominatedWaiting, 'nominatedWaiting');
    const nomination = await section('Nomination');
    expect(
      await within(nomination).findByRole('button', { name: 'Accept nomination' })
    ).toBeVisible();
    const timeline = await section('MINTER timeline');
    expect(
      await within(timeline).findByText('No MINTER transactions about you on chain yet.')
    ).toBeVisible();
    expect(screen.queryByText(/haven't been nominated/)).toBeNull();
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('offers Join now to an approved nominee on their own page', async () => {
    await visit(ADDR.approved, 'approved');
    expect(await screen.findByRole('button', { name: 'Join now' })).toBeVisible();
  });

  it('shows a removed member: when, what they keep, and their history', async () => {
    await visit(ADDR.kicked, 'nominator');
    expect(await screen.findByText('Former member')).toBeInTheDocument();
    expect(
      screen.getByText(
        /^Removed from MINTER on .* They keep their level and can be nominated again\.$/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Level 3')).toBeInTheDocument();
    const timeline = await section('MINTER timeline');
    const titles = within(timeline)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('p')?.textContent);
    expect(titles).toEqual(['Removed from MINTER', 'Approved for MINTER']);
    expect(within(timeline).getByText(/Reason: “Kicked by Minter Admins”/)).toBeInTheDocument();
    // A level 5+ member can nominate them again.
    expect(
      screen.getByRole('link', { name: proposeNominationFor(PEOPLE.kicked.name as string) })
    ).toHaveAttribute('href', `/nominate?who=${ADDR.kicked}`);
    const original = await section('From the original app');
    expect(await within(original).findByText('Please invite me to MINTER')).toBeInTheDocument();
    expect(within(original).getByText(/Posted by Kit Kicked for themselves/)).toBeInTheDocument();
  });

  it('never calls an account that was never a member a former member', async () => {
    await renderPage(<PersonPage />, {
      persona: 'nominator',
      path: `/people/${ADDR.kicked}`,
      route: ROUTE,
      setup: (world) => {
        world.decided = world.decided.filter(
          (tx: { type: string; invitee?: string }) =>
            !(tx.type === 'GROUP_INVITE' && tx.invitee === ADDR.kicked)
        );
      },
    });
    expect(
      await screen.findByText(/^Removed from MINTER's join list on .+\. They can be nominated\.$/)
    ).toBeInTheDocument();
    expect(screen.getByText('Not in MINTER')).toBeInTheDocument();
    expect(screen.queryByText('Former member')).toBeNull();
  });

  it('tells a member below level 5 why they cannot nominate', async () => {
    await visit(ADDR.kicked, 'learner');
    expect(await screen.findByText('Former member')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(`^${PROPOSE_NOMINATION}`) })).toBeNull();
    expect(
      screen.getByText("Members can nominate from level 5. You're level 2.")
    ).toBeInTheDocument();
  });

  it('shows a ban and that it must be lifted first', async () => {
    await visit(ADDR.banned, 'nominator');
    expect((await screen.findAllByText('Banned from MINTER')).length).toBeGreaterThan(1);
    expect(screen.getByText(/^Banned from MINTER on .*, permanently\./)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Banned from MINTER: Minter Admins must lift the ban before a nomination can go ahead.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(`^${PROPOSE_NOMINATION}`) })).toBeNull();
    const timeline = await section('MINTER timeline');
    expect(
      within(timeline).getByText(/^Permanent · Reason: “Banned by Minter Admins”/)
    ).toBeInTheDocument();
  });

  it('says how a former member’s ban ended, or that it was lifted, not that they were removed', async () => {
    let ended = 0;
    const timed = await renderPage(<PersonPage />, {
      persona: 'nominator',
      path: `/people/${ADDR.banned}`,
      route: ROUTE,
      setup: (world) => {
        const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
        ban.timeToLive = 3 * 86_400;
        ended = ban.timestamp + 3 * 86_400_000;
        world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ADDR.banned);
      },
    });
    expect(
      await screen.findByText(
        new RegExp(
          `^Was banned from MINTER on .+; the ban ended on ${formatDate(ended)}, so they can be nominated again\\.$`
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Former member')).toBeInTheDocument();
    timed.unmount();

    await renderPage(<PersonPage />, {
      persona: 'nominator',
      path: `/people/${ADDR.banned}`,
      route: ROUTE,
      setup: (world) => {
        const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
        world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ADDR.banned);
        world.decided.push({
          ...ban,
          type: 'CANCEL_GROUP_BAN',
          signature: `${ban.signature.slice(0, -4)}Lift`,
          member: ban.offender,
          offender: undefined,
          timeToLive: undefined,
          blockHeight: ban.approvalHeight + 1000,
          approvalHeight: ban.approvalHeight + 1500,
        });
      },
    });
    expect(
      await screen.findByText(
        /^Was banned from MINTER on .+; Minter Admins lifted the ban on .+, so they can be nominated again\.$/
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Removed from MINTER on/)).toBeNull();
  });

  it('lets an eligible viewer support an open nomination', async () => {
    await visit(ADDR.nominatedWaiting, 'admin');
    expect(await screen.findByText('Nominated')).toBeInTheDocument();
    const nomination = await section('Nomination');
    expect(within(nomination).getByText('Waiting for a Minter Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your support' })).toHaveAttribute(
      'href',
      `/nominate?who=${ADDR.nominatedWaiting}`
    );
  });

  it('tells the nominator and supporters their part instead of offering support again', async () => {
    await visit(ADDR.nominatedWaiting, 'nominator');
    expect(await screen.findByText('You nominated them.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add your support' })).toBeNull();
  });

  it('knows a supporter', async () => {
    await visit(ADDR.nominatedWaiting, 'adminL4');
    expect(await screen.findByText('You support this nomination.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add your support' })).toBeNull();
  });

  it('shows a Minter Admin their own page with what they proposed', async () => {
    await visit(ADDR.admin, 'admin');
    expect(await screen.findByText('Minter Admin')).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Minter Admin and MINTER member.')).toBeInTheDocument();
    const proposals = await section('As a Minter Admin');
    expect(
      within(proposals).getByText(
        /^Proposed \d+ changes for others: \d+ approved, 1 collecting signatures/
      )
    ).toBeInTheDocument();
    expect(within(proposals).getByText(PEOPLE.early.name as string)).toBeInTheDocument();
    expect(
      within(proposals).getByRole('link', { name: 'Signatures and activity' })
    ).toHaveAttribute('href', '/activity');
  });

  it('shows a level 5+ member (no join on record, so no start date)', async () => {
    await visit(ADDR.nominator, 'learner');
    expect(await screen.findByText('MINTER member')).toBeInTheDocument();
    expect(
      screen.getByText('In MINTER. At level 6, they can nominate new minters.')
    ).toBeInTheDocument();
    expect(screen.queryByText('In MINTER since')).toBeNull();
  });

  it('says so for an address that never made a transaction', async () => {
    await visit(fakeAddress('never-used'), 'learner');
    expect(await screen.findByText('No activity on Qortal yet.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No registered name' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'MINTER timeline' })).toBeNull();
  });

  it('opens a name’s owner when the link holds a name', async () => {
    await visit(PEOPLE.nominator.name as string, 'learner');
    expect(
      await screen.findByRole('heading', { level: 2, name: PEOPLE.nominator.name as string })
    ).toBeInTheDocument();
    expect(fetchCallsFor('/names/Nora%20Nominator')).toHaveLength(1);
  });

  it('offers Retry when a name could not be looked up, instead of "no one found"', async () => {
    await renderPage(<PersonPage />, {
      persona: 'learner',
      path: `/people/${encodeURIComponent('Nora Nominator')}`,
      route: ROUTE,
      setup: () => mockFetchRoute(/^\/names\//, () => new Response('down', { status: 503 })),
    });
    expect(
      await screen.findByText("Couldn't look up “Nora Nominator” on your node.")
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.queryByText('No one found.')).toBeNull();
  });

  it('says no one was found for something that is neither an address nor a name', async () => {
    await visit('not a person', 'learner');
    expect(await screen.findByText('No one found.')).toBeInTheDocument();
    expect(screen.getByLabelText('Find a person')).toBeInTheDocument();
  });

  it('looks further back through the original app’s cards on request', async () => {
    const { world } = await visit(fakeAddress('member-21'), 'learner');
    // Push the cards about Member 22 past the first look.
    for (let i = 0; i < 45; i++) {
      world.legacy.resources.push({
        service: 'BLOG_POST',
        name: 'Admin F',
        identifier: `Minter-board-card-new${String(i).padStart(3, '0')}`,
        created: NOW - i * 1000,
        body: { header: `Filler ${i}`, nominee: `Someone ${i}`, content: '<p>x</p>' },
      });
    }
    const original = await section('From the original app');
    expect(
      await within(original).findByText(/Looked through the newest 40 of \d+ cards/)
    ).toBeInTheDocument();
    expect(within(original).queryByText('Member 22 for MINTER')).toBeNull();
    await userEvent.click(within(original).getByRole('button', { name: 'Search older cards' }));
    expect(await within(original).findByText('Member 22 for MINTER')).toBeInTheDocument();
    expect(within(original).getByText(/Looked through all \d+ cards/)).toBeInTheDocument();
  });
});

describe('Person page: one’s own admin role', () => {
  it('offers Become a Minter Admin on a member’s own page only', async () => {
    const own = await visit(ADDR.learner, 'learner');
    expect(
      await screen.findByRole('button', { name: 'Become a Minter Admin' }, { timeout: 3000 })
    ).toBeInTheDocument();
    own.unmount();
    await visit(ADDR.learner, 'nominator');
    await screen.findByRole('heading', { level: 2, name: PEOPLE.learner.name as string });
    expect(screen.queryByRole('button', { name: 'Become a Minter Admin' })).toBeNull();
  });

  it('suggests level 5+ beside Become below it, and nothing from it', async () => {
    const own = await visit(ADDR.learner, 'learner');
    const become = await screen.findByRole(
      'button',
      { name: 'Become a Minter Admin' },
      { timeout: 3000 }
    );
    expect(
      screen.getByText(
        'Level 5+ is suggested for Minter Admins, and you’re level 2. You can still propose yourself.'
      )
    ).toBeVisible();
    // A note, not a block.
    await waitFor(() => expect(become).toBeEnabled());
    own.unmount();
    await visit(ADDR.nominator, 'nominator');
    const again = await screen.findByRole(
      'button',
      { name: 'Become a Minter Admin' },
      { timeout: 3000 }
    );
    await waitFor(() => expect(again).toBeEnabled());
    expect(screen.queryByText(/is suggested for Minter Admins/)).toBeNull();
  });

  it('offers Step down as Minter Admin on an admin’s own page, and nobody else’s', async () => {
    const own = await visit(ADDR.admin, 'admin');
    expect(
      await screen.findByRole('button', { name: 'Step down as Minter Admin' }, { timeout: 3000 })
    ).toBeInTheDocument();
    own.unmount();
    await visit(ADDR.adminL4, 'admin');
    await screen.findByRole('heading', { level: 2, name: PEOPLE.adminL4.name as string });
    expect(screen.queryByRole('button', { name: 'Step down as Minter Admin' })).toBeNull();
  });

  it('steps down: their proposal and their signature, worded as a resignation', async () => {
    await visit(ADDR.adminL4, 'adminL4');
    const button = await screen.findByRole(
      'button',
      { name: 'Step down as Minter Admin' },
      { timeout: 3000 }
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Step down as Minter Admin' },
      { timeout: 3000 }
    );
    expect(
      within(dialog).getByText(
        /This proposes that you step down: you give up your Minter Admin role\./
      )
    ).toBeVisible();
    expect(within(dialog).getByText(/You stay a MINTER member/)).toBeVisible();
    expect(within(dialog).getByText('Step 2 of 2: Sign it')).toBeInTheDocument();
    expect(within(dialog).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    // Declined in Hub: nothing is signed.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/cancelled/i, {}, { timeout: 3000 })).toBeVisible();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(1);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });

  it('a step-down that would tip a waiting decision over needs “I’ve checked these” before Hub', async () => {
    // 21 admin rows, 9 needed: stepping down leaves 20, and 8 are enough for Mia Met's invite.
    await renderPage(<PersonPage />, {
      persona: 'adminL4',
      path: `/people/${ADDR.adminL4}`,
      route: ROUTE,
      setup: (world) => addTargetShift(world),
    });
    const button = await screen.findByRole(
      'button',
      { name: 'Step down as Minter Admin' },
      { timeout: 3000 }
    );
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    const dialog = await screen.findByRole(
      'dialog',
      { name: 'Step down as Minter Admin' },
      { timeout: 3000 }
    );
    const note = within(dialog).getByRole('note');
    expect(note).toHaveTextContent(
      /^If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures\./
    );
    expect(within(note).getByText('Add to MINTER: Mia Met (8 of 9)')).toBeVisible();
    // Not without the tick: Hub isn't asked, and the box takes focus.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(0);
    const box = within(dialog).getByRole('checkbox', { name: 'I’ve checked these' });
    expect(box).toHaveFocus();
    await userEvent.click(box);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/cancelled/i, {}, { timeout: 3000 })).toBeVisible();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(1);
  });

  it('says when a step-down someone else proposed is waiting, instead of the button', async () => {
    // Dex Demote's removal was proposed by another admin.
    await visit(ADDR.demote, 'demote');
    expect(
      await screen.findByText(
        'A proposal to remove your Minter Admin role is waiting for the Minter Admins’ signatures.',
        {},
        { timeout: 3000 }
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Step down as Minter Admin' })).toBeNull();
  });
});

describe('person page words', () => {
  it('recognises Core’s answer for an address that fails its checksum', () => {
    expect(
      isInvalidAddress(
        new CoreHttpError('/addresses/Q1', 400, '{"error":102,"message":"invalid address"}')
      )
    ).toBe(true);
    expect(isInvalidAddress(new CoreHttpError('/addresses/Q1', 500, 'boom'))).toBe(false);
    expect(isInvalidAddress(new Error('invalid address'))).toBe(false);
  });
});
