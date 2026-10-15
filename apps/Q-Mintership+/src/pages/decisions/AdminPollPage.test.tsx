import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ADMIN_POLL_IDS, NULL_OWNER, fakeAddress, type World } from '../../../e2e/world.mjs';
import { fromData64 } from '../../data/adminPollRecords';
import { resetPendingPollWrites } from '../../state/adminPolls';
import { withAdminPolls } from '../../test/adminPolls';
import { expectNoAxeViolations } from '../../test/axe';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import AdminPollPage from './AdminPollPage';

beforeEach(() => resetPendingPollWrites());
afterEach(() => vi.useRealTimers());
vi.setConfig({ testTimeout: 30_000 });

const T = { timeout: 6000 };
const OPEN_Q = 'Should only level 5+ minters become Minter Admins?';
const SHARED_Q = 'Should a nomination wait 48 hours before its first signature?';

function openPoll(id: string, persona = 'admin') {
  return renderPage(<AdminPollPage />, {
    persona,
    path: `/decisions/polls/${id}`,
    route: '/decisions/polls/:id',
    setup: withAdminPolls(persona),
  });
}

const privateReads = () => [
  ...fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
    p.includes('DOCUMENT_PRIVATE')
  ),
  ...fetchCallsFor('/arbitrary/DOCUMENT_PRIVATE/'),
];

describe('a Minter Admin poll’s own page', () => {
  it('shows the poll with its comments open, and Copy link in the header', async () => {
    await openPoll(ADMIN_POLL_IDS.open);
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` }, T);
    expect(screen.getByRole('heading', { level: 1, name: 'Minter Admin poll' })).toBeVisible();
    expect(screen.getAllByText(OPEN_Q).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Copy a link to this poll' })).toBeVisible();
    expect(within(card).queryByRole('button', { name: /^Copy link to/ })).toBeNull();
    const thread = await within(card).findByRole('region', { name: `Comments on ${OPEN_Q}` }, T);
    expect(
      await within(thread).findByText(/they know how the network works/, { selector: 'p' }, T)
    ).toBeVisible();
    await expectNoAxeViolations(document.body);
  });

  it('votes from the page like from Decisions', async () => {
    const u = userEvent.setup();
    await openPoll(ADMIN_POLL_IDS.open);
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S1',
      identifier: request.identifier,
    }));
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${OPEN_Q}` }, T);
    await u.click(within(card).getByRole('button', { name: `Vote Neutral: ${OPEN_Q}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Vote Neutral' });
    await u.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Vote published', {}, T)).toBeVisible();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({
      encrypt: true,
      identifier: `qmp-adminvote-${ADMIN_POLL_IDS.open}`,
    });
    expect(fromData64(String(call.data64))).toMatchObject({ vote: 'neutral' });
  });

  it('a poll the admin reads through a share says so', async () => {
    await openPoll(ADMIN_POLL_IDS.shared);
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${SHARED_Q}` }, T);
    expect(within(card).getByText(/Shared by/)).toHaveTextContent(
      /Admin D ΑΩ: you read their copy/
    );
  });

  it('one the admin can’t read, or none at all, isn’t here; a malformed link says so', async () => {
    await openPoll(ADMIN_POLL_IDS.locked);
    expect(await screen.findByText('This poll isn’t here', {}, T)).toBeVisible();
    expect(screen.getByText(/a Minter Admin who can read it can share it with you/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'All decisions' })).toBeVisible();
  });

  it('a malformed link reads nothing', async () => {
    await openPoll('not-a-poll');
    expect(await screen.findByText('No Minter Admin poll with this link', {}, T)).toBeVisible();
    expect(privateReads()).toHaveLength(0);
  });

  it('“This is for Minter Admins only” to anyone else, and nothing read or decrypted', async () => {
    await openPoll(ADMIN_POLL_IDS.open, 'learner');
    expect(await screen.findByText('This is for Minter Admins only', {}, T)).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy a link to this poll' })).toBeNull();
    expect(privateReads()).toHaveLength(0);
    expect(qortalCallsFor('DECRYPT_DATA')).toHaveLength(0);
  });

  it('signed out: the same, with Sign in', async () => {
    await openPoll(ADMIN_POLL_IDS.open, 'signedOut');
    expect(await screen.findByText('This is for Minter Admins only', {}, T)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(privateReads()).toHaveLength(0);
  });
});

describe('near the end of voting', () => {
  const DAY = 86_400_000;
  const SOON_Q = 'A poll that ends in a few minutes?';
  /** A 1-day poll by Admin B that ends `endsIn` from now; Avery voted `voted` an hour ago. */
  const endingSoon = (id: string, endsIn: number, voted?: 'yes') => (world: World) => {
    const signers = world.admins.filter((a: string) => a !== NULL_OWNER);
    const createdAt = Date.now() - DAY + endsIn;
    world.adminPollRecords.push({
      name: 'Admin B',
      identifier: `qmp-adminpoll-${id}`,
      created: createdAt + 20_000,
      readers: signers,
      body: {
        v: 1,
        id,
        question: SOON_Q,
        durationDays: 1,
        createdAt,
        endsAt: createdAt + DAY,
        endHeight: 2_800_000,
        readers: signers,
      },
    });
    if (voted)
      world.adminPollRecords.push({
        name: 'Avery Admin',
        identifier: `qmp-adminvote-${id}`,
        created: Date.now() - 3_600_000,
        readers: signers,
        body: { v: 1, pollId: id, vote: voted },
      });
  };
  const open = (id: string, more: (world: World) => void) =>
    renderPage(<AdminPollPage />, {
      persona: 'admin',
      path: `/decisions/polls/${id}`,
      route: '/decisions/polls/:id',
      setup: withAdminPolls('admin', more),
    });

  it('in the last minutes no vote is offered: it could land after the end', async () => {
    await open('closing7', endingSoon('closing7', 3 * 60_000));
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${SOON_Q}` }, T);
    expect(within(card).getByText(/^Voting ends in under 5 minutes/)).toBeVisible();
    expect(within(card).queryByRole('button', { name: /^Vote / })).toBeNull();
  });

  it('changing a vote close to the end warns that a late change counts for nothing', async () => {
    const u = userEvent.setup();
    await open('changes8', endingSoon('changes8', 20 * 60_000, 'yes'));
    const card = await screen.findByRole('article', { name: `Minter Admin poll: ${SOON_Q}` }, T);
    await u.click(within(card).getByRole('button', { name: `Change your vote to No: ${SOON_Q}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Change your vote to No' });
    expect(
      within(dialog).getByText(
        /^Voting ends in 20 minutes\. If your new vote is published after the end, it doesn’t count, and your earlier vote doesn’t count any more either\.$/
      )
    ).toBeVisible();
  });

  it('a closed poll whose latest vote from the viewer came late says so', async () => {
    await open(ADMIN_POLL_IDS.closed, (world: World) => {
      const mine = world.adminPollRecords.find(
        (r: { name: string; identifier: string }) =>
          r.name === 'Avery Admin' && r.identifier === `qmp-adminvote-${ADMIN_POLL_IDS.closed}`
      );
      // Changed after the end: the earlier, on-time version no longer counts.
      mine.updated = Date.now() - 2 * DAY;
    });
    const card = await screen.findByRole(
      'article',
      { name: /^Minter Admin poll: Should Minter Admins review/ },
      T
    );
    expect(
      within(card).getByText('Your vote came after the end, so it doesn’t count.')
    ).toBeVisible();
    expect(within(card).queryByText(/^You voted/)).toBeNull();
  });
});

describe('who voted what', () => {
  it('names every voter, however many voted the same', async () => {
    await renderPage(<AdminPollPage />, {
      persona: 'admin',
      path: `/decisions/polls/${ADMIN_POLL_IDS.voted}`,
      route: '/decisions/polls/:id',
      setup: withAdminPolls('admin', (world: World) => {
        const signers = world.admins.filter((a: string) => a !== NULL_OWNER);
        // Ten more Yes votes: eleven with Admin A's.
        for (const i of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11])
          world.adminPollRecords.push({
            name: world.accounts.get(fakeAddress(`admin-${i}`)).name,
            identifier: `qmp-adminvote-${ADMIN_POLL_IDS.voted}`,
            created: Date.now() - 3_600_000 + i,
            readers: signers,
            body: { v: 1, pollId: ADMIN_POLL_IDS.voted, vote: 'yes' },
          });
      }),
    });
    const card = await screen.findByRole(
      'article',
      { name: /^Minter Admin poll: Should we remove/ },
      T
    );
    const yes = within(card).getByRole('list', { name: 'Voted Yes' });
    expect(within(yes).getAllByRole('link')).toHaveLength(11);
    expect(within(card).queryByText(/and \d+ more/)).toBeNull();
    expect(within(card).queryByText(/^\+\d+$/)).toBeNull();
  });
});
