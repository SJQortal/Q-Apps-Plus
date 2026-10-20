import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addComments, answerCore } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { fetchCallsFor, mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { invalidate } from '../../data/query';
import { ADDR, NOW } from '../../test/world';
import { commentTarget } from '../../data/commentThread';
import { MUTED_NAMES_KEY, resetOptimisticComments } from '../../state/comments';
import { CommentsSection } from './CommentsSection';

afterEach(() => {
  vi.useRealTimers();
  resetOptimisticComments();
});

const DAY = 86_400_000;
const LABEL = 'the nomination of Wren Waiting';

function decode(data64: unknown): unknown {
  const bytes = Uint8Array.from(atob(String(data64)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function show(persona: string, options: { open?: boolean; extra?: number } = {}) {
  let ids: Record<string, string> = {};
  const rendered = await renderPage(
    <CommentsSection
      target={commentTarget('nomination', ADDR.nominatedWaiting, NOW - 40 * DAY)}
      label={LABEL}
      defaultOpen={options.open}
    />,
    {
      persona,
      setup: (world) => {
        ids = addComments(world).ids;
        // More comments, newer than the thread's: one a minute.
        for (let i = 0; i < (options.extra ?? 0); i++) {
          const id = `more${String(i).padStart(2, '0')}`;
          world.records.push({
            name: `Member ${10 + (i % 20)}`,
            identifier: `qmp-comment-${ADDR.nominatedWaiting}-${id}`,
            created: NOW - (i + 1) * 60_000,
            body: { v: 1, key: ADDR.nominatedWaiting, text: `Extra comment ${i}` },
          });
        }
      },
    }
  );
  return { ...rendered, ids };
}

const toggle = () => screen.findByRole('button', { name: /^Comments \(8\): / }, { timeout: 4000 });
const region = () =>
  screen.findByRole('region', { name: `Comments on ${LABEL}` }, { timeout: 4000 });
const commentLi = (identifier: string) =>
  document.querySelector<HTMLElement>(`[data-comment="${identifier}"]`)!;

describe('CommentsSection: the count', () => {
  /** A reply to Member 7's comment, published after the shared count list was read. */
  const lateReply = (world: { records: unknown[] }, ids: Record<string, string>, i = 1) =>
    world.records.push({
      name: `Member ${20 + i}`,
      identifier: `qmp-comment-${ADDR.nominatedWaiting}-late0${i}`,
      created: NOW - 30_000 + i,
      body: { v: 1, key: ADDR.nominatedWaiting, text: `A late reply ${i}`, replyTo: ids.helped },
    });

  it('a reply the thread has read counts on the closed toggle too', async () => {
    const user = userEvent.setup();
    const { world, ids } = await show('learner');
    await toggle();
    lateReply(world, ids);
    // Opening reads the thread's own keys, which have the reply.
    await user.click(await toggle());
    const open = await screen.findByRole(
      'button',
      { name: /^Comments \(9\): / },
      { timeout: 4000 }
    );
    await user.click(open);
    const closed = screen.getByRole('button', { name: /^Comments \(9\): / });
    expect(closed).toHaveAttribute('aria-expanded', 'false');
  });

  it('reads the shared count list again after 3 minutes, so new comments count', async () => {
    let world: { records: unknown[] } = { records: [] };
    let ids: Record<string, string> = {};
    await renderPage(
      <CommentsSection
        target={commentTarget('nomination', ADDR.nominatedWaiting, NOW - 40 * DAY)}
        label={LABEL}
      />,
      {
        persona: 'learner',
        setup: (w) => {
          world = w;
          ids = addComments(w).ids;
          // After installWorld's own clock, so the count's 3-minute timer is a fake one too.
          vi.useFakeTimers({ shouldAdvanceTime: true });
          vi.setSystemTime(NOW);
        },
      }
    );
    await toggle();
    const searches = () =>
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
        p.includes('identifier=qmp-comment-&')
      ).length;
    expect(searches()).toBe(1);
    lateReply(world, ids, 2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000 + 1_000);
    });
    expect(searches()).toBe(2);
    expect(
      await screen.findByRole('button', { name: /^Comments \(9\): / }, { timeout: 4000 })
    ).toBeInTheDocument();
  });
});

describe('CommentsSection', () => {
  it('shows the count from one shared search, and reads no comment until opened', async () => {
    await show('learner');
    const button = await toggle();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveTextContent('Comments (8)');
    expect(
      fetchCallsFor('/arbitrary/resources/searchsimple').filter((p) =>
        p.includes('identifier=qmp-comment-')
      )
    ).toHaveLength(1);
    expect(fetchCallsFor('/arbitrary/JSON/')).toEqual([]);
  });

  it('closes from the thread’s foot too: back to the toggle, which takes the focus (Simon, 2026-10-20)', async () => {
    const user = userEvent.setup();
    const scrolled: Element[] = [];
    const scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    });
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    onTestFinished(() => {
      Element.prototype.scrollIntoView = original;
    });
    await show('learner', { open: true });
    await region();
    const top = await toggle();
    expect(top).toHaveAttribute('aria-expanded', 'true');
    const foot = screen.getByRole('button', { name: `Close comments: ${LABEL}` });
    expect(foot).toHaveTextContent('Close comments');
    // Under the thread.
    expect(
      (await region()).compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await user.click(foot);
    expect(top).toHaveAttribute('aria-expanded', 'false');
    expect(top).toHaveFocus();
    expect(scrolled).toEqual([top]);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: `Close comments: ${LABEL}` })).toBeNull()
    );
  });

  it('opens the thread: newest first, replies, deleted, edited and hidden', async () => {
    const user = userEvent.setup();
    const { ids } = await show('learner');
    await user.click(await toggle());
    const panel = await region();
    expect(
      await within(panel).findByText(/Wren helped me set up my node/, { selector: 'p' })
    ).toBeVisible();
    const list = within(panel).getByRole('list', { name: `Comments on ${LABEL}, newest first` });
    // Top level: the hidden one (folded), Member 7, Lou Left, Member 3 (deleted).
    expect(within(commentLi(ids.spam)).getByText('Hidden by a Minter Admin.')).toBeVisible();
    expect(within(commentLi(ids.spam)).queryByText(/Cheap QORT/)).toBeNull();
    const replies = within(list).getByRole('list', { name: 'Replies to Member 7' });
    expect(within(replies).getByText('Replying to Nora Nominator')).toBeVisible();
    expect(within(replies).getByRole('button', { name: 'WEBSITE/WrenNodeGuide' })).toBeVisible();
    expect(within(commentLi(ids.online)).getByText(/· edited/)).toBeVisible();
    expect(within(commentLi(ids.deleted)).getByText('Deleted')).toBeVisible();
    expect(within(commentLi(ids.civil)).getByText(/keep it about minting/)).toBeVisible();
    // A member's hide doesn't count: Member 7's comment shows.
    expect(within(commentLi(ids.helped)).queryByText('Hidden by a Minter Admin.')).toBeNull();
    // Anyone with a registered name can comment, at any level.
    expect(within(panel).getByRole('textbox', { name: 'Write a comment' })).toBeVisible();
  });

  it('each reply quotes the comment it answers, and the quote goes to that comment', async () => {
    const user = userEvent.setup();
    const { ids } = await show('learner');
    await user.click(await toggle());
    const panel = await region();
    const replies = await within(panel).findByRole('list', { name: 'Replies to Member 7' });
    const quotes = await within(replies).findAllByRole('button', { name: /^Replying to / });
    expect(quotes.map((q) => q.textContent)).toEqual([
      'Replying to Member 7Wren helped me set up my node last month. Patient, clear, and they checked back a week later to see it was still minting.(go to that comment)',
      'Replying to Nora NominatorSame experience here. Their node guide is worth a read: qortal://WEBSITE/WrenNodeGuide(go to that comment)',
    ]);
    // Zoë answered Nora's reply: the quote goes there, in the same thread.
    await user.click(quotes[1]);
    const nora = commentLi(ids.sameHere);
    expect(nora).toHaveFocus();
    expect(nora).toHaveAttribute('data-flash', 'true');
    await user.click(quotes[0]);
    expect(commentLi(ids.helped)).toHaveFocus();
  });

  it('reads 20 at a time: Show more reads the next ones, keeping the first on screen', async () => {
    const user = userEvent.setup();
    await show('learner', { extra: 23 });
    await user.click(
      await screen.findByRole('button', { name: /^Comments \(31\): / }, { timeout: 4000 })
    );
    const panel = await region();
    expect(await within(panel).findByText('Extra comment 0')).toBeVisible();
    expect(within(panel).getByText('Extra comment 19')).toBeVisible();
    expect(within(panel).queryByText('Extra comment 20')).toBeNull();
    expect(
      fetchCallsFor('/arbitrary/JSON/').filter((p) => p.includes('qmp-comment-'))
    ).toHaveLength(20);
    await user.click(within(panel).getByRole('button', { name: 'Show more comments (11)' }));
    expect(await within(panel).findByText('Extra comment 22')).toBeVisible();
    expect(
      within(panel).getByText(/Wren helped me set up my node/, { selector: 'p' })
    ).toBeVisible();
    expect(within(panel).getByText('Extra comment 0')).toBeVisible();
    expect(within(panel).queryByRole('button', { name: /Show more comments/ })).toBeNull();
    // The button went with the last page: focus is on the first comment it brought.
    await waitFor(() =>
      expect(within(panel).getByText('Extra comment 20').closest('li')).toHaveFocus()
    );
    // Each body is read once, however many pages.
    expect(
      fetchCallsFor('/arbitrary/JSON/').filter((p) => p.includes('qmp-comment-'))
    ).toHaveLength(31);
  });

  it('Show more stays pressable while it reads, and again after a read that failed', async () => {
    const user = userEvent.setup();
    const { world } = await show('learner', { extra: 23 });
    await user.click(
      await screen.findByRole('button', { name: /^Comments \(31\): / }, { timeout: 4000 })
    );
    const panel = await region();
    await within(panel).findByText('Extra comment 0');
    // The next read fails (the rows are read again, and the node says no).
    mockFetchRoute('/arbitrary/resources/searchsimple', () => new Response('', { status: 500 }));
    invalidate('comments:rows:');
    invalidate('qdnsearch:');
    const more = within(panel).getByRole('button', { name: 'Show more comments (11)' });
    await user.click(more);
    // Never disabled (that would drop focus), and focus is still on it.
    expect(more).toBeEnabled();
    expect(more).toHaveFocus();
    await waitFor(() =>
      expect(fetchCallsFor('/arbitrary/resources/searchsimple').length).toBeGreaterThan(1)
    );
    await act(() => new Promise((r) => setTimeout(r, 300)));
    // The node answers again: a second press reads the next comments.
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) => {
      const answer = answerCore(world, url.pathname, url.searchParams);
      return new Response(JSON.stringify(answer?.body ?? []), { status: answer?.status ?? 404 });
    });
    await user.click(within(panel).getByRole('button', { name: /^Show more comments/ }));
    expect(await within(panel).findByText('Extra comment 22', {}, { timeout: 4000 })).toBeVisible();
  });

  it('Show anyway unfolds a hidden comment and moves focus to it', async () => {
    const user = userEvent.setup();
    const { ids } = await show('learner', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.spam) ?? Promise.reject(new Error('not yet')));
    await user.click(within(li).getByRole('button', { name: 'Show anyway: hidden comment' }));
    expect(within(li).getByText(/Cheap QORT here/)).toBeVisible();
    expect(within(li).getByText('Hidden by a Minter Admin. You chose to show it.')).toBeVisible();
    expect(li.contains(document.activeElement)).toBe(true);
  });

  it('posts a comment through Hub after saying what it publishes and the fee', async () => {
    const user = userEvent.setup();
    await show('nominator', { open: true });
    const panel = await region();
    const box = await within(panel).findByRole('textbox', { name: 'Write a comment' });
    await user.click(within(panel).getByRole('button', { name: 'Post' }));
    expect(within(panel).getByText('Write something first.')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    // Focus moves to the box, which now says what's wrong.
    await waitFor(() => expect(box).toHaveFocus());
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription(/Write something first\./);

    await user.type(box, 'Wren keeps a steady node.');
    await user.click(within(panel).getByRole('button', { name: 'Post' }));
    const dialog = await screen.findByRole('dialog', { name: 'Post your comment' });
    expect(within(dialog).getByText('Wren keeps a steady node.')).toBeVisible();
    expect(within(dialog).getByText(/under your name, Nora Nominator/)).toBeVisible();
    expect(within(dialog).getByText('Fee: 0.01 QORT')).toBeVisible();
    expect(within(dialog).getByText('The identifier starts with qmp-comment-.')).toBeVisible();

    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S',
      identifier: r.identifier,
    }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    expect(await within(dialog).findByText('Comment published')).toBeVisible();
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({ name: 'Nora Nominator', service: 'JSON' });
    expect(String(call.identifier)).toMatch(
      new RegExp(`^qmp-comment-${ADDR.nominatedWaiting}-[a-z0-9]{6}$`)
    );
    expect(decode(call.data64)).toEqual({
      v: 1,
      key: ADDR.nominatedWaiting,
      text: 'Wren keeps a steady node.',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    // Shown at once, the draft cleared, the count up by one.
    expect(await screen.findByRole('button', { name: /^Comments \(9\): / })).toBeVisible();
    expect(within(panel).getByText('Wren keeps a steady node.')).toBeVisible();
    expect(within(panel).getByText(/Publishing… everyone sees it once QDN has it/)).toBeVisible();
    expect(box).toHaveValue('');
  });

  it('replies to a reply under the same thread, saying whom it answers', async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.answer) ?? Promise.reject(new Error('not yet')));
    await user.click(within(li).getByRole('button', { name: 'Reply to Wren Waiting' }));
    const box = screen.getByRole('textbox', { name: 'Reply to Wren Waiting' });
    expect(box).toHaveFocus();
    await user.type(box, 'Good to know.');
    await user.click(screen.getByRole('button', { name: 'Post reply' }));
    const dialog = await screen.findByRole('dialog', { name: 'Post your reply' });
    expect(within(dialog).getByText('Replying to Wren Waiting')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    // The mock world declines in Hub: nothing sent, the reply stays to try again.
    expect(await within(dialog).findByText(/Cancelled in Hub/)).toBeVisible();
    expect(decode(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0].data64)).toMatchObject({
      replyTo: ids.answer,
    });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(await screen.findByRole('textbox', { name: 'Reply to Wren Waiting' })).toHaveValue(
      'Good to know.'
    );
  });

  it('Cancel on a reply puts focus back on the comment it answered', async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.answer) ?? Promise.reject(new Error('not yet')));
    await user.click(within(li).getByRole('button', { name: 'Reply to Wren Waiting' }));
    expect(screen.getByRole('textbox', { name: 'Reply to Wren Waiting' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Reply to Wren Waiting' })).toBeNull();
    expect(commentLi(ids.answer)).toHaveFocus();
  });

  it('edits your own comment: same identifier, marked edited, shown at once', async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.sameHere) ?? Promise.reject(new Error('not yet')));
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S',
      identifier: r.identifier,
    }));
    await user.click(
      within(li).getByRole('button', { name: 'Comment by Nora Nominator: more actions' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const box = within(li).getByRole('textbox', { name: 'Edit your comment' });
    // Focus ends in the box, not back on the More button.
    await waitFor(() => expect(box).toHaveFocus());
    expect(box).toHaveValue(
      'Same experience here. Their node guide is worth a read: qortal://WEBSITE/WrenNodeGuide'
    );
    await user.clear(box);
    await user.type(box, 'Their guide is worth a read.');
    await user.click(within(li).getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Save your edit' });
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText('Edit published');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    const edited = commentLi(ids.sameHere);
    expect(within(edited).getByText('Their guide is worth a read.')).toBeVisible();
    expect(within(edited).getByText(/· edited/)).toBeVisible();
    const [edit] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(edit).toMatchObject({ name: 'Nora Nominator', identifier: ids.sameHere });
    expect(decode(edit.data64)).toEqual({
      v: 1,
      key: ADDR.nominatedWaiting,
      text: 'Their guide is worth a read.',
      replyTo: ids.helped,
      edited: true,
    });
  });

  it('deletes your own comment: "Deleted" in its place, focus back on it', async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.sameHere) ?? Promise.reject(new Error('not yet')));
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S',
      identifier: r.identifier,
    }));
    await user.click(
      within(li).getByRole('button', { name: 'Comment by Nora Nominator: more actions' })
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your comment' });
    expect(within(dialog).getByText(/replies to it still make sense/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText('Comment deleted');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(commentLi(ids.sameHere)).toHaveFocus());
    expect(within(commentLi(ids.sameHere)).getByText('Deleted')).toBeVisible();
    // The reply to it is still there.
    expect(within(commentLi(ids.thanks)).getByText(/that guide got me going/)).toBeVisible();
    expect(decode(qortalCallsFor('PUBLISH_QDN_RESOURCE')[0].data64)).toEqual({
      v: 1,
      key: ADDR.nominatedWaiting,
      text: '',
      deleted: true,
      replyTo: ids.helped,
    });
  });

  it('mutes a name on this device only', async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.helped) ?? Promise.reject(new Error('not yet')));
    await user.click(within(li).getByRole('button', { name: 'Comment by Member 7: more actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Mute Member 7 on this device' }));
    expect(
      within(commentLi(ids.helped)).getByText('You muted Member 7 on this device.')
    ).toBeVisible();
    expect(JSON.parse(window.localStorage.getItem(MUTED_NAMES_KEY) ?? '[]')).toEqual(['Member 7']);
    expect(screen.getByRole('status', { hidden: false, name: '' })).toHaveTextContent(
      'Muted Member 7 on this device.'
    );
    // Replies to them stay readable; nothing was published.
    expect(within(commentLi(ids.sameHere)).getByText(/Same experience here/)).toBeVisible();
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  });

  it('a Minter Admin hides a comment for everyone with a small record', async () => {
    const user = userEvent.setup();
    const { ids } = await show('admin', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.civil) ?? Promise.reject(new Error('not yet')));
    await user.click(within(li).getByRole('button', { name: 'Comment by Member 9: more actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Hide for everyone' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hide this comment for everyone' });
    expect(within(dialog).getByText('The identifier starts with qmp-hide-.')).toBeVisible();
    expect(within(dialog).getByText('Fee: 0.01 QORT')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText(/Cancelled in Hub/);
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({ name: 'Avery Admin', service: 'JSON' });
    expect(String(call.identifier)).toMatch(new RegExp(`^qmp-hide-${ADDR.nominatedWaiting}-`));
    expect(decode(call.data64)).toEqual({
      v: 1,
      commentName: 'Member 9',
      commentIdentifier: ids.civil,
      hidden: true,
    });
    // The hidden one offers to show it again.
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await user.click(
      await within(commentLi(ids.spam)).findByRole('button', {
        name: 'Comment by Spam Name: more actions',
      })
    );
    expect(await screen.findByRole('menuitem', { name: 'Show for everyone again' })).toBeVisible();
  });

  it('by keyboard: Edit from More puts focus in the editor, and Cancel puts it back on the comment', async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.sameHere) ?? Promise.reject(new Error('not yet')));
    within(li).getByRole('button', { name: 'Comment by Nora Nominator: more actions' }).focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{Enter}');
    // The menu closing puts focus back on More first: the editor takes it after that.
    await waitFor(() =>
      expect(within(li).getByRole('textbox', { name: 'Edit your comment' })).toHaveFocus()
    );
    within(li).getByRole('button', { name: 'Cancel' }).focus();
    await user.keyboard('{Enter}');
    expect(within(li).queryByRole('textbox', { name: 'Edit your comment' })).toBeNull();
    expect(commentLi(ids.sameHere)).toHaveFocus();
  });

  it('Post with nothing written moves focus to the field, which says why', async () => {
    const user = userEvent.setup();
    await show('nominator', { open: true });
    const panel = await region();
    within(panel).getByRole('button', { name: 'Post' }).focus();
    await user.keyboard('{Enter}');
    const box = within(panel).getByRole('textbox', { name: 'Write a comment' });
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription('Write something first.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("a reply's Cancel puts focus back on the comment it answered", async () => {
    const user = userEvent.setup();
    const { ids } = await show('nominator', { open: true });
    await region();
    const li = await waitFor(() => commentLi(ids.answer) ?? Promise.reject(new Error('not yet')));
    await user.click(within(li).getByRole('button', { name: 'Reply to Wren Waiting' }));
    expect(screen.getByRole('textbox', { name: 'Reply to Wren Waiting' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox', { name: 'Reply to Wren Waiting' })).toBeNull();
    expect(commentLi(ids.answer)).toHaveFocus();
  });

  it('says what a name is and where to register one, without a name', async () => {
    const user = userEvent.setup();
    await show('newcomer', { open: true });
    const panel = await region();
    expect(await within(panel).findByText('Commenting needs a registered name')).toBeVisible();
    mockQortalRequest('OPEN_NEW_TAB', true);
    await user.click(within(panel).getByRole('button', { name: 'Register a name' }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[0]).toMatchObject({ qortalLink: 'qortal://APP/Names' });
    expect(within(panel).queryByRole('button', { name: /Reply to/ })).toBeNull();
  });

  it('signed out: offers Sign in', async () => {
    await show('signedOut', { open: true });
    const panel = await region();
    expect(within(panel).getByText('Sign in to comment.')).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  it('outside Hub: still reads the comments, and says where to write one', async () => {
    await show('outside', { open: true });
    const panel = await region();
    expect(within(panel).getByText('Open Q-Mintership+ in Qortal Hub to comment.')).toBeVisible();
    expect(
      await within(panel).findByText(/Wren helped me set up my node/, { selector: 'p' })
    ).toBeVisible();
    expect(within(panel).queryByRole('button', { name: /more actions/ })).toBeNull();
  });
});
