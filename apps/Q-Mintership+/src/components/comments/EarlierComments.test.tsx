/**
 * Comments from a nominee's earlier nominations (Simon, 2026-11-24: igorcoin
 * nominated Stone Golem again, and the comments of the nomination that
 * lapsed came along; "I want the old comments to stay", marked as from the
 * previous nomination, folded, and counted apart).
 *
 * Wren Waiting's nomination, two days old. Before it: a nomination an
 * invite rejected (40 days ago) and one that lapsed (20 days ago).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeKey } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { fetchCallsFor } from '../../test/setup';
import { ADDR, NOW } from '../../test/world';
import { decisionCommentKey } from '../../data/commentRecords';
import { nominationCommentTarget } from '../../data/commentThread';
import type { EarlierRound } from '../../rules/nomination';
import { resetOptimisticComments } from '../../state/comments';
import { CommentsSection } from './CommentsSection';

afterEach(() => resetOptimisticComments());

const DAY = 86_400_000;
const T = { timeout: 4000 };
const LABEL = 'the nomination of Wren Waiting';
const NOMINEE = ADDR.nominatedWaiting;
const OLD_INVITE = fakeKey('earlier-comments-old-invite', 64);

const rejected: EarlierRound = {
  startedAt: NOW - 40 * DAY,
  endedAt: NOW - 37 * DAY,
  outcome: 'rejected',
  invite: { signature: OLD_INVITE, at: NOW - 39 * DAY },
};
const lapsed: EarlierRound = {
  startedAt: NOW - 20 * DAY,
  endedAt: NOW - 12 * DAY,
  outcome: 'lapsed',
  invite: null,
};

const target = nominationCommentTarget({
  nominee: NOMINEE,
  state: 'waiting',
  publishedAt: NOW - 2 * DAY,
  nomination: { publishedAt: NOW - 2 * DAY },
  decision: null,
  latestInvite: { signature: OLD_INVITE, timestamp: NOW - 39 * DAY },
  earlierRoundEnd: NOW - 12 * DAY,
  earlierRounds: [rejected, lapsed],
});

const ID = {
  now: `qmp-comment-${NOMINEE}-wnow01`,
  lapsed: `qmp-comment-${NOMINEE}-wold01`,
  lapsedReply: `qmp-comment-${NOMINEE}-wold02`,
  rejected: `qmp-comment-${decisionCommentKey(OLD_INVITE)}-wold03`,
};

async function show(persona = 'nominator') {
  return renderPage(
    <CommentsSection
      target={target}
      label={LABEL}
      // Nora voted Yes on this nomination.
      answers={new Map([[ADDR.nominator, { kind: 'yes' as const }]])}
    />,
    {
      persona,
      setup: (world) => {
        const add = (name: string, identifier: string, daysAgo: number, body: object) =>
          world.records.push({
            name,
            identifier,
            created: NOW - daysAgo * DAY,
            body: { v: 1, ...body },
          });
        add('Nora Nominator', ID.now, 1, { key: NOMINEE, text: 'On this nomination.' });
        add('Nora Nominator', ID.lapsed, 19, { key: NOMINEE, text: 'On the one that lapsed.' });
        add('Avery Admin', ID.lapsedReply, 18, {
          key: NOMINEE,
          text: 'A reply, back then.',
          replyTo: ID.lapsed,
        });
        add('Kit Kicked', ID.rejected, 38, {
          key: decisionCommentKey(OLD_INVITE),
          text: 'Under the invite that was rejected.',
        });
      },
    }
  );
}

const toggle = () =>
  screen.findByRole(
    'button',
    { name: `Comments (1) · 3 earlier, from previous nominations: ${LABEL}` },
    T
  );
const bodyReads = () => fetchCallsFor('/arbitrary/JSON/');

describe('comments from the nominee’s earlier nominations', () => {
  it('counts this nomination’s comments, and the earlier ones beside them', async () => {
    await show();
    const button = await toggle();
    expect(button).toHaveTextContent('Comments (1)· 3 earlier');
  });

  it('opened: this one’s comments, then the earlier ones folded and not read until opened', async () => {
    const user = userEvent.setup();
    await show();
    await user.click(await toggle());
    const list = await screen.findByRole('list', { name: `Comments on ${LABEL}, newest first` }, T);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('On this nomination.');
    // Nora's vote on this nomination is beside her comment on it.
    expect(within(list).getByText('Voted Yes')).toBeInTheDocument();
    const fold = screen.getByRole('button', { name: 'Comments from previous nominations (3)' });
    expect(fold).toHaveAttribute('aria-expanded', 'false');
    expect(bodyReads().filter((p) => p.includes('wold'))).toEqual([]);

    await user.click(fold);
    const earlier = await screen.findByRole(
      'list',
      { name: 'Comments from previous nominations, newest first' },
      T
    );
    await waitFor(() => expect(earlier).toHaveTextContent('On the one that lapsed.'), T);
    expect(earlier).toHaveTextContent('A reply, back then.');
    expect(earlier).toHaveTextContent('Under the invite that was rejected.');
    // Each marked as from the previous nomination, in the place of the writer's answer on this one.
    expect(within(earlier).getAllByText('Previous nomination')).toHaveLength(3);
    expect(within(earlier).queryByText('Voted Yes')).toBeNull();
    // Read here, not answered.
    expect(within(earlier).queryByRole('button', { name: /^Reply to / })).toBeNull();
    expect(
      within(list).getByRole('button', { name: 'Reply to Nora Nominator' })
    ).toBeInTheDocument();
  });

  it('the tag says when it was written and how that nomination ended, and links to it', async () => {
    const user = userEvent.setup();
    await show();
    await user.click(await toggle());
    await user.click(
      await screen.findByRole('button', { name: 'Comments from previous nominations (3)' }, T)
    );
    const earlier = await screen.findByRole(
      'list',
      { name: 'Comments from previous nominations, newest first' },
      T
    );
    await waitFor(
      () => expect(earlier).toHaveTextContent('Under the invite that was rejected.'),
      T
    );
    const items = within(earlier).getAllByRole('listitem');
    const kit = items.find((li) => li.textContent?.includes('Kit Kicked')) as HTMLElement;
    const tag = within(kit).getByRole('button', { name: 'Previous nomination' });
    expect(tag).toHaveAccessibleDescription(
      /^Written on .+, on the previous nomination of .+, which was rejected on .+\.$/
    );
    await user.click(tag);
    const details = await screen.findByRole('dialog', { name: 'Previous nomination' }, T);
    expect(within(details).getByRole('link', { name: 'See how it ended' })).toHaveAttribute(
      'href',
      `/decisions/${OLD_INVITE}`
    );
    await user.keyboard('{Escape}');
    const nora = items.find((li) =>
      li.textContent?.includes('On the one that lapsed.')
    ) as HTMLElement;
    await user.click(within(nora).getAllByRole('button', { name: 'Previous nomination' })[0]);
    const lapsedDetails = await screen.findByRole('dialog', { name: 'Previous nomination' }, T);
    expect(lapsedDetails).toHaveTextContent(/which lapsed on /);
    expect(within(lapsedDetails).getByRole('link', { name: 'See how it ended' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/history\?type=lapsed&from=\d{4}-\d{2}-\d{2}$/)
    );
  });

  it('a first nomination has no earlier part', async () => {
    const user = userEvent.setup();
    await renderPage(
      <CommentsSection
        target={nominationCommentTarget({
          nominee: NOMINEE,
          state: 'waiting',
          publishedAt: NOW - 2 * DAY,
          nomination: { publishedAt: NOW - 2 * DAY },
          decision: null,
          latestInvite: null,
          earlierRounds: [],
        })}
        label={LABEL}
      />,
      { persona: 'nominator' }
    );
    const button = await screen.findByRole('button', { name: /^Comments \(\d+\): / }, T);
    expect(button).not.toHaveTextContent('earlier');
    await user.click(button);
    expect(await screen.findByText('No comments yet.', {}, T)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Comments from previous nominations/ })
    ).toBeNull();
  });
});
