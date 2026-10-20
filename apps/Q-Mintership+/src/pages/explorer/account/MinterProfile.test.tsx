/**
 * An account's Minter Profile, its one place: the Explorer's Minter Profile
 * tab, with the profile's actions (Simon, 2026-10-17: the MINTER profile
 * page merged into it). Where it stands, its nomination in full, its
 * timeline and records, what the viewer can do for it, and on one's own
 * profile Join now and the Minter Admin role.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PROPOSE_NOMINATION, proposeNominationFor } from '../../../constants/words';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { fetchCallsFor, mockFetchRoute, qortalCalls, qortalCallsFor } from '../../../test/setup';
import {
  DECLINED,
  addDecline,
  addTargetShift,
  answerCore,
  fakeAddress,
} from '../../../../e2e/world.mjs';
import { ADDR, MS_PER_BLOCK, NOW, PEOPLE, TIP } from '../../../test/world';
import { explorerAccountPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import { formatCount, formatDate } from '../../../utils/format';
import { getDefaultStore } from 'jotai';
import { activityFirstReadAtom } from '../../../state/settings';
import { addPaymentsTo, setMintedTo } from '../../../test/qortWorld';
import { countableBlocks, percentWords } from '../../../rules/explorer/onlineShare';
import AccountPage from '../AccountPage';

const ROUTE = '/explorer/account/:who/:tab?';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;
const T = { timeout: 6000 };

afterEach(() => resetExplorerState());

/** The account's Minter Profile tab, as `persona` sees it. */
async function visit(who: string, persona = 'admin', setup?: RenderPageOptions['setup']) {
  const result = await renderPage(<AccountPage />, {
    persona,
    path: explorerAccountPath(who, 'mintership'),
    route: ROUTE,
    setup,
  });
  await screen.findByRole('tabpanel', { name: 'Minter Profile' }, T);
  return result;
}

function section(name: string) {
  return screen.findByRole('region', { name }, T);
}

/** The MINTER status section, once its sentence is in. */
async function status() {
  const region = await section('MINTER status');
  await waitFor(() => expect(within(region).queryByRole('status')).toBeNull(), T);
  return region;
}

describe('Minter Profile', () => {
  /** Answer the profile's two one-row searches: its first reward share and level moves. */
  function mintingStart(firstShare: number | null, moved: { height: number; by: string } | null) {
    return (world: Parameters<NonNullable<RenderPageOptions['setup']>>[0]) =>
      mockFetchRoute('/transactions/search', (url: URL) => {
        const sp = url.searchParams;
        if (sp.get('limit') === '1' && sp.get('txType') === 'REWARD_SHARE')
          return firstShare === null
            ? []
            : [{ type: 'REWARD_SHARE', blockHeight: firstShare, timestamp: 1, signature: 'rs1' }];
        if (sp.get('limit') === '1' && sp.get('txType') === 'TRANSFER_PRIVS')
          return moved
            ? [
                {
                  type: 'TRANSFER_PRIVS',
                  blockHeight: moved.height,
                  timestamp: 1,
                  signature: 'tp1',
                  creatorAddress: moved.by,
                },
              ]
            : [];
        const reply = answerCore(world, url.pathname, sp);
        return new Response(JSON.stringify(reply?.body ?? null), { status: reply?.status ?? 404 });
      });
  }

  /** The Node online fact's value, and what its ⓘ says: beside the label (Simon, 2026-10-18). */
  async function nodeOnline() {
    const facts = (await status()).querySelector('dl[aria-label="MINTER facts"]') as HTMLElement;
    return waitFor(() => {
      const label = within(facts).getByText('Node online');
      const value = label.nextElementSibling as HTMLElement;
      expect(value.textContent).not.toMatch(/^…/);
      const info = within(label).getByRole('button', { name: /^About node online: / });
      expect(within(value).queryByRole('button')).toBeNull();
      return [value.textContent ?? '', info.getAttribute('aria-label') ?? ''];
    }, T);
  }

  it('says how much of the time its node was online, from two one-row searches', async () => {
    const first = 609_585;
    const { world } = await visit(ADDR.admin, 'admin', mintingStart(first, null));
    const minted = Number(world.accounts.get(ADDR.admin)?.blocks ?? 0);
    const percent = (minted / countableBlocks(first, TIP)) * 100;
    expect(percent).toBeGreaterThan(1);
    expect(percent).toBeLessThan(99);
    const expected = percentWords(percent);
    const [value, info] = await nodeOnline();
    expect(value).toBe(expected);
    expect(info).toContain(
      `of the rewards since its first reward share, in block ${formatCount(first)}.`
    );
    const searches = fetchCallsFor('/transactions/search')
      .map((url) => new URL(url, 'http://x').searchParams)
      .filter((p) => p.get('address') === ADDR.admin && p.get('limit') === '1');
    expect(searches.map((p) => [p.get('txType'), p.get('reverse')]).sort()).toEqual([
      ['REWARD_SHARE', 'false'],
      ['TRANSFER_PRIVS', 'true'],
    ]);
  });

  it('says when an account has never minted', async () => {
    await visit(ADDR.learner, 'admin', mintingStart(null, null));
    expect(await nodeOnline()).toEqual([
      'Not minting',
      'About node online: It has no reward share yet.',
    ]);
  });

  it('says a moved minting level makes the count another account’s too', async () => {
    await visit(
      ADDR.admin,
      'admin',
      mintingStart(1_000, { height: 2_000_000, by: 'Qsomeoneelse' })
    );
    expect(await nodeOnline()).toEqual([
      'Can’t tell',
      'About node online: Its minting level moved from another account in block 2,000,000, and its blocks minted with it.',
    ]);
  });

  it('counts a minting level that moved here across the account it came from (Simon, 2026-10-20)', async () => {
    const move = {
      type: 'TRANSFER_PRIVS',
      blockHeight: 2_000_000,
      timestamp: Date.UTC(2025, 3, 30),
      signature: 'tp-learner',
      creatorAddress: ADDR.learner,
    };
    await visit(ADDR.admin, 'admin', (world) =>
      mockFetchRoute('/transactions/search', (url: URL) => {
        const sp = url.searchParams;
        const who = sp.get('address');
        if (sp.get('txType') === 'REWARD_SHARE' && sp.get('limit') === '1')
          return [
            {
              type: 'REWARD_SHARE',
              blockHeight: who === ADDR.learner ? 500_000 : 2_000_100,
              timestamp: 1,
              signature: `rs-${who}`,
            },
          ];
        if (sp.get('txType') === 'TRANSFER_PRIVS' && (who === ADDR.admin || who === ADDR.learner))
          return [move];
        const reply = answerCore(world, url.pathname, sp);
        return new Response(JSON.stringify(reply?.body ?? null), { status: reply?.status ?? 404 });
      })
    );
    const [value, info] = await nodeOnline();
    expect(value).toMatch(/^\d+%$/);
    expect(info).toContain(
      'of the rewards its minting level could have had: Leo Learner from block 500,000 to block 2,000,000, then this account since block 2,000,100. Its minting level moved here with its blocks minted, so they count together.'
    );
    const standing = await status();
    expect(
      await within(standing).findByRole('heading', { name: 'Where its minting level came from' }, T)
    ).toBeInTheDocument();
    const from = within(standing).getByRole('list', { name: 'Where its minting level came from' });
    expect(from).toHaveTextContent('Moved its minting level to this account in block 2,000,000');
    expect(from).toHaveTextContent('Blocks 500,000–2,000,000');
    // A Minter Admin sees the QORT it minted there.
    expect(within(from).getByText('QORT minted there')).toBeInTheDocument();
  });

  it('shows a nominee being signed for, as a Minter Admin sees them', async () => {
    const { posts } = await visit(ADDR.nominatedSigning, 'admin');
    const standing = await status();
    expect(
      await within(standing).findByText(
        "Nominated for MINTER, and they're ready: approval adds them at once.",
        {},
        T
      )
    ).toBeInTheDocument();
    expect(within(standing).getByText('7,200 blocks')).toBeInTheDocument();
    expect(within(standing).getByText('Sent')).toBeInTheDocument();
    // Admins are already signing: no Propose nomination button, a way to the decision instead.
    expect(screen.queryByRole('link', { name: new RegExp(`^${PROPOSE_NOMINATION}`) })).toBeNull();
    expect(
      within(standing).getByRole('link', { name: 'Open in Decisions' }).getAttribute('href')
    ).toMatch(/^\/decisions\/\w+$/);
    expect(
      within(standing).getByText('A nomination for this person is already collecting approvals.')
    ).toBeInTheDocument();
    // The nomination in full, with its comments and votes.
    const nomination = await section('Nomination');
    expect(
      within(nomination).getByRole('article', {
        name: `Nomination of ${PEOPLE.nominatedSigning.name}`,
      })
    ).toBeInTheDocument();
    expect(within(nomination).getByText('Collecting approvals')).toBeInTheDocument();
    expect(within(nomination).getByRole('link', { name: 'Open the nomination' })).toBeVisible();
    const timeline = await section('MINTER timeline');
    expect(await within(timeline).findByText('Nominated for MINTER')).toBeInTheDocument();
    const original = await section('From the original app');
    expect(
      await within(original).findByText(`${PEOPLE.nominatedSigning.name} for the MINTER group`)
    ).toBeInTheDocument();
    expect(within(original).getByText('Looked through all 27 cards.')).toBeInTheDocument();
    expect(posts).toEqual([]);
    expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
  });

  it('gives a nominee their next step on their own profile', async () => {
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

  it('offers Join now to an approved nominee on their own profile', async () => {
    await visit(ADDR.approved, 'approved');
    expect(await screen.findByRole('button', { name: 'Join now' }, T)).toBeVisible();
  });

  it('shows a removed member: when, what they keep, and their history', async () => {
    await visit(ADDR.kicked, 'nominator');
    const standing = await status();
    expect(
      await within(standing).findByText(
        /^Removed from MINTER on .* They keep their level and can be nominated again\.$/,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('Former member').length).toBeGreaterThan(0);
    const timeline = await section('MINTER timeline');
    const titles = within(timeline)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('p')?.textContent);
    expect(titles).toEqual(['Removed from MINTER', 'Approved for MINTER']);
    expect(within(timeline).getByText(/Reason: “Kicked by Minter Admins”/)).toBeInTheDocument();
    // A level 5+ member can nominate them again.
    expect(
      within(standing).getByRole('link', {
        name: proposeNominationFor(PEOPLE.kicked.name as string),
      })
    ).toHaveAttribute('href', `/nominate?who=${ADDR.kicked}`);
    const original = await section('From the original app');
    expect(await within(original).findByText('Please invite me to MINTER')).toBeInTheDocument();
    expect(within(original).getByText(/Posted by Kit Kicked for themselves/)).toBeInTheDocument();
  });

  it('never calls an account that was never a member a former member', async () => {
    await visit(ADDR.kicked, 'nominator', (world) => {
      world.decided = world.decided.filter(
        (tx: { type: string; invitee?: string }) =>
          !(tx.type === 'GROUP_INVITE' && tx.invitee === ADDR.kicked)
      );
    });
    expect(
      await screen.findByText(
        /^Removed from MINTER's join list on .+\. They can be nominated\.$/,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('Not in MINTER').length).toBeGreaterThan(0);
    expect(screen.queryByText('Former member')).toBeNull();
  });

  it('never calls a declined join request a removal from MINTER', async () => {
    await visit(DECLINED.address, 'admin', (world) => void addDecline(world));
    // Declined at block TIP - 19,000, dated from the tip.
    const declinedOn = formatDate(NOW - 19_000 * MS_PER_BLOCK);
    expect(
      await screen.findByText(
        `Not in MINTER yet. Minter Admins declined their join request on ${declinedOn}; they can send a new one.`,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Former member')).toBeNull();
    expect(screen.queryByText(/Removed from MINTER/)).toBeNull();
    const timeline = await section('MINTER timeline');
    expect(await within(timeline).findByText('Join request declined')).toBeInTheDocument();
    expect(within(timeline).getByText('Asked to join MINTER')).toBeInTheDocument();
  });

  it('words the declines a Minter Admin proposed as declines, from each person’s history', async () => {
    const adminG = fakeAddress('admin-6');
    await visit(adminG, 'admin', (world) => void addDecline(world));
    const list = await section('As a Minter Admin');
    expect(
      await within(list).findByText('Join request declined', {}, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(within(list).getByText('Proposed: Decline a join request')).toBeInTheDocument();
    expect(within(list).queryByText(/Remove(d)? from MINTER/)).toBeNull();
    // One read of each kicked person's history.
    expect(fetchCallsFor(`/transactions/search?address=${DECLINED.address}`)).toHaveLength(1);
  });

  it('tells a member below level 5 why they cannot nominate', async () => {
    await visit(ADDR.kicked, 'learner');
    const standing = await status();
    expect(
      await within(standing).findByText("Members can nominate from level 5. You're level 2.", {}, T)
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(`^${PROPOSE_NOMINATION}`) })).toBeNull();
  });

  it('shows a ban and that it must be lifted first', async () => {
    await visit(ADDR.banned, 'nominator');
    expect(
      await screen.findByText(/^Banned from MINTER on .*, permanently\./, {}, T)
    ).toBeInTheDocument();
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
    const timed = await visit(ADDR.banned, 'nominator', (world) => {
      const ban = world.decided.find((tx: { type: string }) => tx.type === 'GROUP_BAN');
      ban.timeToLive = 3 * 86_400;
      ended = ban.timestamp + 3 * 86_400_000;
      world.bans = world.bans.filter((b: { offender: string }) => b.offender !== ADDR.banned);
    });
    expect(
      await screen.findByText(
        new RegExp(
          `^Was banned from MINTER on .+; the ban ended on ${formatDate(ended)}, so they can be nominated again\\.$`
        ),
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText('Former member').length).toBeGreaterThan(0);
    timed.unmount();
    resetExplorerState();

    await visit(ADDR.banned, 'nominator', (world) => {
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
    });
    expect(
      await screen.findByText(
        /^Was banned from MINTER on .+; Minter Admins lifted the ban on .+, so they can be nominated again\.$/,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Removed from MINTER on/)).toBeNull();
  });

  it('offers no nomination for an account without a registered name, and says why', async () => {
    await visit(ADDR.newcomer, 'nominator');
    expect(
      await screen.findByText(
        'No registered name: an account needs a name on Qortal before it can be nominated.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(`^${PROPOSE_NOMINATION}`) })).toBeNull();
  });

  it('lets an eligible viewer support an open nomination', async () => {
    await visit(ADDR.nominatedWaiting, 'admin');
    const nomination = await section('Nomination');
    expect(within(nomination).getByText('Waiting for a Minter Admin')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Add your support' }, T)).toHaveAttribute(
      'href',
      `/nominate?who=${ADDR.nominatedWaiting}`
    );
  });

  it('tells the nominator and supporters their part instead of offering support again', async () => {
    await visit(ADDR.nominatedWaiting, 'nominator');
    expect(await screen.findByText('You nominated them.', {}, T)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add your support' })).toBeNull();
  });

  it('knows a supporter', async () => {
    await visit(ADDR.nominatedWaiting, 'adminL4');
    expect(await screen.findByText('You support this nomination.', {}, T)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add your support' })).toBeNull();
  });

  it('shows a Minter Admin their own profile with what they proposed', async () => {
    await visit(ADDR.admin, 'admin');
    expect(await screen.findByText('Minter Admin and MINTER member.', {}, T)).toBeInTheDocument();
    const proposals = await section('As a Minter Admin');
    expect(
      await within(proposals).findByText(
        /^Proposed \d+ changes for others: \d+ approved, 1 collecting approvals/,
        {},
        T
      )
    ).toBeInTheDocument();
    expect(within(proposals).getAllByText(PEOPLE.early.name as string).length).toBeGreaterThan(0);
  });

  it('shows a level 5+ member (no join on record, so no start date)', async () => {
    await visit(ADDR.nominator, 'learner');
    expect(
      await screen.findByText('In MINTER. At level 6, they can nominate new minters.', {}, T)
    ).toBeInTheDocument();
    expect(screen.queryByText('In MINTER since')).toBeNull();
  });

  it('opens a name’s owner when the link holds a name', async () => {
    await visit(PEOPLE.nominator.name as string, 'learner');
    expect(
      await screen.findByText('In MINTER. At level 6, they can nominate new minters.', {}, T)
    ).toBeInTheDocument();
  });

  it('looks further back through the original app’s cards on request', async () => {
    // Cards about Member 22 pushed past the first look, before the tab reads any.
    await visit(fakeAddress('member-21'), 'learner', (world) => {
      for (let i = 0; i < 45; i++) {
        world.legacy.resources.push({
          service: 'BLOG_POST',
          name: 'Admin F',
          identifier: `Minter-board-card-new${String(i).padStart(3, '0')}`,
          created: NOW - i * 1000,
          body: { header: `Filler ${i}`, nominee: `Someone ${i}`, content: '<p>x</p>' },
        });
      }
    });
    const original = await section('From the original app');
    expect(
      await within(original).findByText(/Looked through the newest 40 of \d+ cards/, {}, T)
    ).toBeInTheDocument();
    expect(within(original).queryByText('Member 22 for MINTER')).toBeNull();
    await userEvent.click(within(original).getByRole('button', { name: 'Search older cards' }));
    expect(await within(original).findByText('Member 22 for MINTER', {}, T)).toBeInTheDocument();
    expect(within(original).getByText(/Looked through all \d+ cards/)).toBeInTheDocument();
  });
});

describe('Minter Profile: one’s own admin role', () => {
  it('offers Become a Minter Admin on a member’s own profile only', async () => {
    const own = await visit(ADDR.learner, 'learner');
    expect(
      await screen.findByRole('button', { name: 'Become a Minter Admin' }, T)
    ).toBeInTheDocument();
    own.unmount();
    resetExplorerState();
    await visit(ADDR.learner, 'nominator');
    await status();
    expect(screen.queryByRole('button', { name: 'Become a Minter Admin' })).toBeNull();
  });

  it('suggests level 5+ beside Become below it, and nothing from it', async () => {
    const own = await visit(ADDR.learner, 'learner');
    const become = await screen.findByRole('button', { name: 'Become a Minter Admin' }, T);
    expect(
      screen.getByText(
        'Level 5+ is suggested for Minter Admins, and you’re level 2. You can still propose yourself.'
      )
    ).toBeVisible();
    // A note, not a block.
    await waitFor(() => expect(become).toBeEnabled());
    own.unmount();
    resetExplorerState();
    await visit(ADDR.nominator, 'nominator');
    const again = await screen.findByRole('button', { name: 'Become a Minter Admin' }, T);
    await waitFor(() => expect(again).toBeEnabled());
    expect(screen.queryByText(/is suggested for Minter Admins/)).toBeNull();
  });

  it('offers Step down as Minter Admin on an admin’s own profile, and nobody else’s', async () => {
    const own = await visit(ADDR.admin, 'admin');
    expect(
      await screen.findByRole('button', { name: 'Step down as Minter Admin' }, T)
    ).toBeInTheDocument();
    own.unmount();
    resetExplorerState();
    await visit(ADDR.adminL4, 'admin');
    await status();
    expect(screen.queryByRole('button', { name: 'Step down as Minter Admin' })).toBeNull();
  });

  it('steps down: their proposal and their signature, worded as a resignation', async () => {
    await visit(ADDR.adminL4, 'adminL4');
    const button = await screen.findByRole('button', { name: 'Step down as Minter Admin' }, T);
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Step down as Minter Admin' }, T);
    expect(
      within(dialog).getByText(
        /This proposes that you step down: you give up your Minter Admin role\./
      )
    ).toBeVisible();
    expect(within(dialog).getByText(/You stay a MINTER member/)).toBeVisible();
    expect(within(dialog).getByText('Step 2 of 2: Approve it')).toBeInTheDocument();
    expect(within(dialog).getByText(/Fees in total: 0.02 QORT/)).toBeInTheDocument();
    // Declined in Hub: nothing is signed.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/cancelled/i, {}, T)).toBeVisible();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(1);
    expect(qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });

  it('a step-down that would tip a waiting decision over needs “I’ve checked these” before Hub', async () => {
    // 21 admin rows, 9 needed: stepping down leaves 20, and 8 are enough for Mia Met's invite.
    await visit(ADDR.adminL4, 'adminL4', (world) => addTargetShift(world));
    const button = await screen.findByRole('button', { name: 'Step down as Minter Admin' }, T);
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Step down as Minter Admin' }, T);
    const note = within(dialog).getByRole('note');
    expect(note).toHaveTextContent(
      /^If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 approvals\./
    );
    expect(within(note).getByText('Add to MINTER: Mia Met (8 of 9)')).toBeVisible();
    // Not without the tick: Hub isn't asked, and the box takes focus.
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(0);
    const box = within(dialog).getByRole('checkbox', { name: 'I’ve checked these' });
    expect(box).toHaveFocus();
    await userEvent.click(box);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText(/cancelled/i, {}, T)).toBeVisible();
    expect(qortalCallsFor('REMOVE_GROUP_ADMIN')).toHaveLength(1);
  });

  it('says when a step-down someone else proposed is waiting, instead of the button', async () => {
    // Dex Demote's removal was proposed by another admin.
    await visit(ADDR.demote, 'demote');
    expect(
      await screen.findByText(
        'A proposal to remove your Minter Admin role is waiting for the Minter Admins’ approvals.',
        {},
        T
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Step down as Minter Admin' })).toBeNull();
  });
});

describe('Minter Profile: reads', () => {
  it('reads the original app’s cards only once that section comes near the screen', async () => {
    // Nothing is near the screen until the test scrolls everything into view.
    const triggers: Array<() => void> = [];
    class FarAway {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        triggers.push(() =>
          this.callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver
          )
        );
      }
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', FarAway);
    await visit(ADDR.kicked, 'nominator');
    await section('From the original app');
    const cardReads = () =>
      fetchCallsFor(/\/arbitrary\/(BLOG_POST|resources\/search\w*\?[^ ]*Minter-board-card)/);
    expect(cardReads()).toEqual([]);
    await waitFor(() => expect(triggers.length).toBeGreaterThan(0));
    act(() => triggers.forEach((trigger) => trigger()));
    await waitFor(() => expect(cardReads().length).toBeGreaterThan(0));
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('QORT minted on the Minter Profile', () => {
  const SLOW = { timeout: 20_000 };
  afterEach(() => getDefaultStore().set(activityFirstReadAtom, 1000));

  it('shows QORT minted in a box of its own, with a fetch icon when its history needs reading', async () => {
    getDefaultStore().set(activityFirstReadAtom, 100);
    const user = userEvent.setup();
    await visit(ADDR.admin, 'admin', (world) => {
      // 150 small payments in: more than the first read of 100.
      addPaymentsTo(world, ADDR.admin, 150);
      setMintedTo(world, ADDR.admin, 77n);
    });
    const facts = (await status()).querySelector('dl[aria-label="MINTER facts"]') as HTMLElement;
    const value = () => within(facts).getByText('QORT minted').nextElementSibling as HTMLElement;
    const fetch = await within(facts).findByRole(
      'button',
      { name: 'Read the rest of its transactions to work out the QORT it minted' },
      SLOW
    );
    expect(value()).not.toHaveTextContent(/QORT$/);
    expect(within(facts).getByText('Blocks minted')).toBeInTheDocument();
    await user.click(fetch);
    await waitFor(() => expect(value()).toHaveTextContent(/^77 QORT$/), SLOW);
    // Its ⓘ beside the label, so the amount keeps its line (Simon, 2026-10-18).
    expect(
      within(within(facts).getByText('QORT minted')).getByRole('button', {
        name: /^About QORT minted: 77 QORT\./,
      })
    ).toBeInTheDocument();
    expect(within(value()).queryByRole('button')).toBeNull();
  });

  it('says an account that never minted never did', async () => {
    await visit(ADDR.nominatedSigning, 'admin');
    const facts = (await status()).querySelector('dl[aria-label="MINTER facts"]') as HTMLElement;
    expect(within(facts).getByText('Blocks minted').nextElementSibling).toHaveTextContent('0');
    expect(within(facts).getByText('QORT minted').nextElementSibling).toHaveTextContent(
      'Never minted'
    );
  });
});
