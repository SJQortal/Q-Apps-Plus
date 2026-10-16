/**
 * The Explorer's Mintership tab, on an account page, in the mock world
 * (strict: a read the world can't answer fails the test): where an account
 * stands, its rounds and timeline (people link into the Explorer), what it
 * published under any of its names, a Minter Admin's proposals, Activity's
 * figures (only when already read) and answers on request, what it posted in
 * the original app and its poll votes on request, and the one line for an
 * account with nothing at all. Read-only throughout.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage, type RenderPageOptions } from '../../../test/render';
import { expectNoAxeViolations } from '../../../test/axe';
import { mockFetchRoute, qortalCalls } from '../../../test/setup';
import { ADDR } from '../../../test/world';
import { queryLoadCounts, setQueryData } from '../../../data/query';
import { explorerAccountPath } from '../../../routes/paths';
import { resetExplorerState } from '../../../state/explorer';
import type { ActivityData } from '../../../data/activity';
import type { AdminActivity } from '../../../rules/activity';
import { answerCore } from '../../../../e2e/world.mjs';
import AccountPage from '../AccountPage';
import { addPollVotes, addRecord } from './mintership/testWorld';

const T = { timeout: 6000 };
const ROUTE = '/explorer/account/:who/:tab?';
const WRITES = /INVITE|KICK|BAN|ADMIN|JOIN|SIGN|PUBLISH|VOTE|POLL/;

afterEach(() => {
  vi.useRealTimers();
  resetExplorerState();
});

async function open(address: string, setup?: RenderPageOptions['setup']) {
  const result = await renderPage(<AccountPage />, {
    persona: 'learner',
    path: explorerAccountPath(address, 'mintership'),
    route: ROUTE,
    strict: true,
    setup,
  });
  const panel = await screen.findByRole('tabpanel', { name: 'Mintership' }, T);
  await within(panel).findByRole('link', { name: 'MINTER profile' }, T);
  return { ...result, panel, user: userEvent.setup() };
}

const region = (name: string | RegExp) => screen.findByRole('region', { name }, T);
const explore = (address: string) => explorerAccountPath(address);

function noWrites(posts: string[]) {
  expect(posts).toEqual([]);
  expect(qortalCalls.filter((c) => WRITES.test(String(c.action)))).toEqual([]);
}

describe('the Mintership tab', () => {
  it('MINTER’s settings that can’t be read: said with Retry, and the timeline still shows', async () => {
    let fail = true;
    const { user, posts } = await open(ADDR.nominator, (world) =>
      mockFetchRoute('/groups/694', (url: URL) =>
        fail && url.pathname === '/groups/694'
          ? new Response('{"error":5,"message":"repository issue"}', { status: 500 })
          : answerCore(world, url.pathname, url.searchParams)?.body
      )
    );
    const status = await region('MINTER status');
    expect(
      await within(status).findByText(
        /^Couldn't read MINTER's settings: the timeline below uses the usual approval window\./,
        {},
        T
      )
    ).toBeInTheDocument();
    // Never a skeleton forever: where they stand, and their timeline.
    expect(
      await within(status).findByText(
        'In MINTER. At level 6, they can nominate new minters.',
        {},
        T
      )
    ).toBeVisible();
    const timeline = await region('MINTER timeline');
    expect(await within(timeline).findByText('Approved for MINTER', {}, T)).toBeVisible();
    fail = false;
    await user.click(within(status).getByRole('button', { name: 'Retry' }));
    await waitFor(
      () => expect(within(status).queryByText(/^Couldn't read MINTER's settings/)).toBeNull(),
      T
    );
    noWrites(posts);
  });

  it('shows a member nominator: where they stand, their round, timeline and records', async () => {
    const { container, posts, panel } = await open(ADDR.nominator);
    expect(within(panel).getByRole('link', { name: 'MINTER profile' })).toHaveAttribute(
      'href',
      `/people/${ADDR.nominator}`
    );
    expect(
      within(panel).getByText('Nominate, support or decide on the MINTER profile')
    ).toBeVisible();

    const status = await region('MINTER status');
    expect(
      await within(status).findByText(
        'In MINTER. At level 6, they can nominate new minters.',
        {},
        T
      )
    ).toBeVisible();
    expect(within(status).getByText('980,000')).toBeVisible();

    const nomination = await region('Nomination');
    expect(
      within(nomination).getByText(
        'One round. It started on 21 Sept 2025 (block 2,300,000): Approved.'
      )
    ).toBeVisible();
    expect(within(nomination).getByRole('link', { name: 'Open the nomination' })).toHaveAttribute(
      'href',
      `/nominations/${ADDR.nominator}`
    );

    // People in the timeline open their account in the Explorer.
    const timeline = await region('MINTER timeline');
    expect(await within(timeline).findByText('Approved for MINTER', {}, T)).toBeVisible();
    const proposer = within(timeline).getByRole('link', { name: 'Admin A: explore this account' });
    expect(proposer.getAttribute('href')).toMatch(/^\/explorer\/account\/Q\w{33}$/);

    const made = await region('In Q-Mintership+, under any of their names');
    expect(await within(made).findByText('Nominations made · 5', {}, T)).toBeVisible();
    expect(within(made).getByText(/^Found under 1 of their 2 names:/)).toHaveTextContent(
      'Found under 1 of their 2 names: Nora Nominator.'
    );
    const nominees = within(made).getByRole('list', { name: 'People they nominated' });
    expect(within(nominees).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(nominees).getByRole('link', { name: 'Wren Waiting: explore this account' })
    ).toHaveAttribute('href', explore(ADDR.nominatedWaiting));
    expect(
      within(made).getByText(
        'Also checked, nothing found: supports, community votes, comments, Considering marks.'
      )
    ).toBeVisible();

    // Not a Minter Admin, no proposals: no admin section.
    expect(screen.queryByRole('region', { name: 'As a Minter Admin' })).toBeNull();

    const original = await region('In the original app, under any of their names');
    expect(await within(original).findByText('Cards they posted · 9', {}, T)).toBeVisible();
    expect(
      await within(original).findByRole('link', { name: /bob\+builder for the MINTER group/ }, T)
    ).toHaveAttribute('href', '/history/card/Minter-board-card-bQ7xK2');
    const about = await region('From the original app');
    expect(await within(about).findByText(/Looked through all 27 cards/, {}, T)).toBeVisible();

    await expectNoAxeViolations(container);
    // Activity's whole-group read is never started from here.
    expect(queryLoadCounts().activity).toBeUndefined();
    noWrites(posts);
  });

  it('finds records under every name an account owns, and links what they are about', async () => {
    const { posts } = await open(ADDR.nominator, (world) => {
      const invite = world.pending.find(
        (t: { type: string; invitee?: string }) =>
          t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominatedSigning
      );
      const key = invite.signature.slice(0, 40);
      addRecord(world, 'Spare Room', `qmp-vote-${ADDR.urgent}-yes-sp0001`, {}, 7_200_000);
      addRecord(world, 'Spare Room', `qmp-vote-${ADDR.urgent}-no-sp0002`, {}, 3_600_000);
      addRecord(world, 'Spare Room', `qmp-comment-${key}-sp0003`, { key, text: 'Signed?' });
      addRecord(world, 'Nora Nominator', `qmp-comment-${key}-sp0004`, { key, text: 'Yes.' });
      addRecord(world, 'Spare Room', `qmp-comment-${ADDR.nominatedWaiting}-sp0005`, {
        key: ADDR.nominatedWaiting,
        text: 'Hello',
      });
    });
    const made = await region('In Q-Mintership+, under any of their names');
    expect(
      await within(made).findByText(/^Found under 2 of their 2 names:/, {}, T)
    ).toHaveTextContent('Found under 2 of their 2 names: Spare Room, Nora Nominator.');
    const votes = within(made).getByRole('list', { name: 'Nominations they voted on' });
    expect(within(votes).getByText(/^Voted No \(newest of 2 votes\)/)).toHaveTextContent(
      /under Spare Room$/
    );
    const comments = within(made).getByRole('list', { name: 'What they commented on' });
    expect(within(made).getByText('Comments · 3 on 2 items')).toBeVisible();
    // A decision's comments link to the decision; a waiting nomination's to the nomination.
    expect(
      await within(comments).findByRole('link', { name: /Add to MINTER: bob\+builder/ }, T)
    ).toHaveAttribute('href', expect.stringMatching(/^\/decisions\/\w{80,}$/));
    expect(within(comments).getByText('2 comments', { exact: false })).toHaveTextContent(
      /under 2 of their names$/
    );
    expect(
      within(comments).getByRole('link', { name: /Wren Waiting’s nomination/ })
    ).toHaveAttribute('href', `/nominations/${ADDR.nominatedWaiting}`);
    noWrites(posts);
  });

  it('shows a Minter Admin’s proposals, Activity’s figures when already read, and answers on request', async () => {
    const { container, posts, user } = await open(ADDR.admin, () => {
      const row = {
        address: ADDR.admin,
        eligible: 15,
        answered: 12,
        signed: 11,
        rejected: 1,
        missed: 3,
        participation: 0.8,
      } as AdminActivity;
      setQueryData<ActivityData>('activity:days:30', {
        range: { days: 30 },
        report: { current: [row], former: [] },
      } as unknown as ActivityData);
    });
    const admin = await region('As a Minter Admin');
    expect(
      await within(admin).findByText(
        'Proposed 13 changes for others: 10 approved, 1 collecting approvals, 2 expired.',
        {},
        T
      )
    ).toBeVisible();
    expect(
      within(admin).getByRole('group', { name: 'Their proposals, newest first' })
    ).toBeVisible();
    // One button that stays, so the focus stays on it.
    const all = within(admin).getByRole('button', { name: 'Show all 13' });
    expect(all).toHaveAttribute('aria-expanded', 'false');
    await user.click(all);
    expect(all).toHaveAccessibleName('Show fewer');
    expect(all).toHaveAttribute('aria-expanded', 'true');
    expect(all).toHaveFocus();
    await user.click(all);
    expect(all).toHaveAccessibleName('Show all 13');
    expect(
      within(admin).getByText(
        "From Activity's last 30 days. Participation 80%: 12 of 15 decisions answered (11 approved, 1 rejected), 3 missed."
      )
    ).toBeVisible();
    expect(within(admin).getByRole('link', { name: 'Open Activity' })).toHaveAttribute(
      'href',
      '/activity'
    );

    // Nothing is read about their answers until asked.
    expect(queryLoadCounts().xanswers).toBeUndefined();
    await user.click(within(admin).getByRole('button', { name: 'Show their answers' }));
    expect(
      await within(admin).findByText(
        'All 53 answers they gave. 52 of them on MINTER decisions: 52 approved, 0 rejected.',
        {},
        T
      )
    ).toBeVisible();
    // The button went: the answers panel holds the focus.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(
      within(admin).getByText(
        'All 53 answers they gave. 52 of them on MINTER decisions: 52 approved, 0 rejected.'
      )
    );
    expect(
      within(admin).getByText("Left out: 1 answer on transactions that aren't MINTER decisions.")
    ).toBeVisible();
    const answers = within(admin).getByRole('list', {
      name: 'Their answers on MINTER decisions, newest first',
    });
    expect(within(answers).getAllByRole('listitem')).toHaveLength(20);
    const first = within(answers).getAllByRole('listitem')[0];
    expect(first).toHaveTextContent(
      /^Approved · Add to MINTER: .*Eli Early.*Block 2,757,499 · 12 Oct 2026/
    );
    expect(
      within(first).getByRole('link', { name: 'Open the decision: Add to MINTER' })
    ).toHaveAttribute('href', expect.stringMatching(/^\/decisions\/\w+$/));
    expect(
      within(first).getByRole('link', { name: 'Eli Early: explore this account' })
    ).toHaveAttribute('href', explore(ADDR.early));
    // All read: no Load more; Show more for the rest of the list.
    expect(within(admin).queryByRole('button', { name: /^Load/ })).toBeNull();
    await user.click(within(admin).getByRole('button', { name: 'Show 20 more of 32' }));
    expect(within(answers).getAllByRole('listitem')).toHaveLength(40);
    // The first answer it added takes the focus.
    expect(within(answers).getAllByRole('listitem')[20]).toHaveFocus();

    await expectNoAxeViolations(container);
    expect(queryLoadCounts().activity).toBeUndefined();
    noWrites(posts);
  });

  it('says where Activity’s figures are when no window has been read yet', async () => {
    await open(ADDR.admin);
    const admin = await region('As a Minter Admin');
    expect(
      within(admin).getByText(
        'Activity counts each Minter Admin’s approvals, rejections and misses by window.'
      )
    ).toBeVisible();
    expect(queryLoadCounts().activity).toBeUndefined();
  });

  it('says in one line when an account has nothing in MINTER, its records or votes', async () => {
    const { container, posts, panel } = await open(ADDR.newcomer);
    expect(
      await within(panel).findByText(
        'Not in MINTER. No nominations, records or votes found.',
        {},
        T
      )
    ).toBeVisible();
    expect(
      within(panel).getByText(
        'Checked their MINTER history, nominations, Q-Mintership+ records and original-app posts under any of their names, and all 27 original-app cards for ones about them.'
      )
    ).toBeVisible();
    expect(within(panel).queryByRole('region', { name: 'MINTER status' })).toBeNull();
    expect(within(panel).getByRole('button', { name: 'Show their poll votes' })).toBeVisible();
    await expectNoAxeViolations(container);
    noWrites(posts);
  });

  it('reads original-app poll votes only when asked, listing the public boards’ ones', async () => {
    const { posts, user } = await open(ADDR.nominator, (world) => {
      addPollVotes(world, ADDR.nominator);
      // This poll lists No first: the vote is read by the poll's own options.
      mockFetchRoute('/polls/Minter-board-card-Kt3mPq-poll', {
        pollName: 'Minter-board-card-Kt3mPq-poll',
        description: 'Mintership Board Poll for Kit',
        owner: ADDR.kicked,
        published: 1,
        pollOptions: [{ optionName: 'No' }, { optionName: 'Yes' }],
      });
    });
    const original = await region('In the original app, under any of their names');
    const button = await within(original).findByRole(
      'button',
      { name: 'Show their poll votes' },
      T
    );
    expect(queryLoadCounts().xpollvotes).toBeUndefined();
    await user.click(button);
    expect(
      await within(original).findByText('2 votes in 2 original-app polls: 1 Yes, 1 No.', {}, T)
    ).toBeVisible();
    expect(
      within(original).getByText("1 vote on encrypted admin board cards' polls (counted only).")
    ).toBeVisible();
    expect(within(original).getByText("1 vote on other apps' polls (counted only).")).toBeVisible();
    const list = within(original).getByRole('list', {
      name: 'Their original app poll votes, newest first',
    });
    expect(within(list).getByRole('link', { name: 'Voted No: open the card' })).toHaveAttribute(
      'href',
      '/history/card/Minter-board-card-bQ7xK2'
    );
    noWrites(posts);
  });

  it('leaves out a post under a card identifier another name used first', async () => {
    await open(ADDR.left);
    const original = await region('In the original app, under any of their names');
    expect(
      await within(original).findByText(
        '1 post under a card’s identifier another name used first (the original app shows that first card).',
        {},
        T
      )
    ).toBeVisible();
    expect(within(original).queryByText(/Cards they posted/)).toBeNull();
  });
});
