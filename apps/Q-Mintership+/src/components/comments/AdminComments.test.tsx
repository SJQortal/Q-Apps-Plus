/**
 * Comments for the Minter Admins only, in a decision's thread (Simon,
 * 2026-10-18: Minter Admins comment and choose whether a comment is public or
 * encrypted and visible only to Minter Admins): what a Minter Admin reads and
 * writes, and that nobody else reads, sees or writes them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addAdminNotes, addComments } from '../../../e2e/world.mjs';
import { renderPage } from '../../test/render';
import { serveAdminPolls } from '../../test/adminPolls';
import { fetchCallsFor, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import { decisionCommentTarget } from '../../data/commentThread';
import { fromData64 } from '../../data/adminPollRecords';
import { resetOptimisticComments } from '../../state/comments';
import { expectNoAxeViolations } from '../../test/axe';
import { CommentsSection } from './CommentsSection';

afterEach(() => {
  vi.useRealTimers();
  resetOptimisticComments();
});

const LABEL = 'Add to MINTER, bob+builder';
const T = { timeout: 4000 };

async function show(persona: string) {
  let notes: ReturnType<typeof addAdminNotes> | null = null;
  let target: ReturnType<typeof decisionCommentTarget> | null = null;
  const rendered = await renderPage(<Probe />, {
    persona,
    setup: (world) => {
      addComments(world);
      notes = addAdminNotes(world);
      serveAdminPolls(world, persona);
      const signing = world.pending.find(
        (t: { type: string; invitee?: string }) =>
          t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominatedSigning
      );
      target = decisionCommentTarget({
        signature: signing.signature,
        kind: 'invite',
        subject: ADDR.nominatedSigning,
        createdAt: signing.timestamp,
      });
    },
  });
  return { ...rendered, notes: notes as unknown as ReturnType<typeof addAdminNotes> };

  // Rendered after `setup` has made the target (renderPage runs it first).
  function Probe() {
    return target ? <CommentsSection target={target} label={LABEL} defaultOpen /> : null;
  }
}

const region = () => screen.findByRole('region', { name: `Comments on ${LABEL}` }, T);
const commentLi = (identifier: string) =>
  document.querySelector<HTMLElement>(`[data-comment="${identifier}"]`);

describe('a Minter Admin', () => {
  it('reads them in the same thread, marked; others’ and locked ones left out, and said', async () => {
    const { notes, container } = await show('admin');
    const panel = await region();
    expect(await within(panel).findByText(notes.texts.concern, {}, T)).toBeVisible();
    const concern = commentLi(notes.ids.concern)!;
    expect(within(concern).getByText('Minter Admins only')).toBeVisible();
    // A reply to Admin C's public comment sits under it, with its quote.
    const checked = await waitFor(() => commentLi(notes.ids.checked) ?? Promise.reject());
    expect(within(checked).getByText('Replying to', { exact: false })).toBeVisible();
    expect(checked.closest('[data-thread-root]')).toHaveAttribute(
      'data-comment',
      expect.stringContaining('-bob002')
    );
    // Nora Nominator isn't a Minter Admin; Admin F's wasn't encrypted to Avery.
    expect(commentLi(notes.ids.notAdmin)).toBeNull();
    expect(commentLi(notes.ids.locked)).toBeNull();
    expect(
      within(panel).getByText(
        '1 comment for the Minter Admins here wasn’t encrypted to you, so it isn’t shown.'
      )
    ).toBeVisible();
    // Public comments can be hidden for everyone; these can't.
    await expectNoAxeViolations(container);
  });

  it('counts them on the toggle', async () => {
    await show('admin');
    // Two public comments, three for the Minter Admins (from Minter Admins).
    expect(await screen.findByRole('button', { name: /^Comments \(5\): / }, T)).toBeInTheDocument();
  });

  it('chooses who can read a new comment, and a Minter Admins one goes encrypted', async () => {
    const user = userEvent.setup();
    const { notes } = await show('admin');
    const panel = await region();
    const group = within(panel).getByRole('radiogroup', { name: 'Who can read it' });
    expect(within(group).getByRole('radio', { name: 'Everyone (public)' })).toBeChecked();
    expect(within(panel).getByText(/Public, under your name Avery Admin\./)).toBeVisible();
    await user.click(within(group).getByRole('radio', { name: 'Minter Admins only' }));
    expect(
      within(panel).getByText(/Encrypted to the 19 Minter Admins, under your name Avery Admin\./)
    ).toBeVisible();
    await user.type(
      within(panel).getByRole('textbox', { name: 'Write a comment' }),
      'Let us wait for their answer.'
    );
    await user.click(within(panel).getByRole('button', { name: 'Post' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Post your comment for the Minter Admins',
    });
    expect(within(dialog).getByText(/Encrypted to the 19 Minter Admins/)).toBeVisible();
    expect(within(dialog).getByText('The service is DOCUMENT_PRIVATE.')).toBeInTheDocument();
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S9',
      identifier: r.identifier,
    }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText('Comment published', {}, T);
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({
      name: 'Avery Admin',
      service: 'DOCUMENT_PRIVATE',
      encrypt: true,
      identifier: expect.stringMatching(new RegExp(`^qmp-macomment-${notes.inviteKey}-`)),
    });
    expect(fromData64(String(call.data64))).toEqual({
      v: 1,
      key: notes.inviteKey,
      text: 'Let us wait for their answer.',
    });
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    const mine = await within(panel).findByText('Let us wait for their answer.');
    const li = mine.closest('li') as HTMLElement;
    expect(within(li).getByText('Minter Admins only')).toBeVisible();
    expect(
      within(li).getByText('Publishing… the other Minter Admins see it once QDN has it.')
    ).toBeVisible();
    // The next one goes to the Minter Admins too, unless they choose otherwise.
    expect(await within(panel).findByRole('textbox', { name: 'Write a comment' }, T)).toHaveValue(
      ''
    );
    expect(within(group).getByRole('radio', { name: 'Minter Admins only' })).toBeChecked();
  });

  it('a reply to one for the Minter Admins is one too', async () => {
    const user = userEvent.setup();
    const { notes } = await show('admin');
    const panel = await region();
    await within(panel).findByText(notes.texts.concern, {}, T);
    const concern = commentLi(notes.ids.concern)!;
    await user.click(within(concern).getByRole('button', { name: /^Reply to Admin D/ }));
    expect(
      within(panel).getByText('For the Minter Admins only, like the comment it answers.')
    ).toBeVisible();
    await user.type(within(panel).getByRole('textbox', { name: /^Reply to Admin D/ }), 'Asked.');
    await user.click(within(panel).getByRole('button', { name: 'Post reply' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Post your reply for the Minter Admins',
    });
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) => ({
      type: 'ARBITRARY',
      signature: 'S8',
      identifier: r.identifier,
    }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue to Hub' }));
    await within(dialog).findByText('Reply published', {}, T);
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({ service: 'DOCUMENT_PRIVATE', encrypt: true });
    expect(fromData64(String(call.data64))).toMatchObject({ replyTo: notes.ids.concern });
  });
});

describe('anyone else', () => {
  it('a member reads no encrypted comments, sees none, and has no choice to make', async () => {
    const { notes } = await show('nominator');
    const panel = await region();
    // Admin C's public comment (Member 5's reply quotes it too).
    expect(
      (await within(panel).findAllByText(/Signed\. Their node has been steady/, {}, T))[0]
    ).toBeVisible();
    expect(within(panel).queryByText(notes.texts.concern)).toBeNull();
    expect(within(panel).queryByText('Minter Admins only')).toBeNull();
    expect(within(panel).queryByRole('radiogroup', { name: 'Who can read it' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Comments \(2\): / })).toBeInTheDocument();
    expect(fetchCallsFor('service=DOCUMENT_PRIVATE')).toEqual([]);
    expect(qortalCallsFor('DECRYPT_DATA')).toEqual([]);
  });
});
