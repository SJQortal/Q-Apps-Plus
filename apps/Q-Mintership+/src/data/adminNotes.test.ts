/**
 * Reading what is for the Minter Admins only, on the mock world: a note
 * counts only from whoever proposed the decision (the nominator, for a
 * nomination), a comment only from a current Minter Admin, and bodies come
 * decrypted with the viewer's key (one not encrypted to them is counted).
 */
import { describe, expect, it } from 'vitest';
import { addAdminNotes, addComments, fakeAddress } from '../../e2e/world.mjs';
import { serveAdminPolls } from '../test/adminPolls';
import { fetchCallsFor } from '../test/setup';
import { ADDR, installWorld } from '../test/world';
import {
  decisionNoteTarget,
  loadAdminCommentIndex,
  loadAdminCommentRows,
  loadAdminNote,
  loadAdminThread,
  nominationNoteTarget,
} from './adminNotes';
import { decisionCommentTarget } from './commentThread';
import { loadCommentRows } from './comments';
import { loadNominations } from './nominations';

function setup(persona = 'admin') {
  const installed = installWorld(persona);
  const comments = addComments(installed.world);
  const notes = addAdminNotes(installed.world);
  serveAdminPolls(installed.world, persona);
  return { ...installed, comments, notes };
}

const kickOf = (world: ReturnType<typeof setup>['world']) =>
  world.pending.find((t: { type: string; member?: string }) => t.type === 'GROUP_KICK');

describe('a decision’s note', () => {
  it('is its proposer’s, decrypted; a note by anyone else under the same key never counts', async () => {
    const { world, address, notes } = setup();
    const kick = kickOf(world);
    const target = decisionNoteTarget({
      signature: kick.signature,
      kind: 'kick',
      subject: ADDR.kickTarget,
      createdAt: kick.timestamp,
      creatorAddress: kick.creatorAddress,
    });
    expect(target).toEqual({
      spans: [{ key: notes.kickKey, since: expect.any(Number), author: fakeAddress('admin-4') }],
    });
    const note = await loadAdminNote(address, target!);
    expect(note).toMatchObject({
      status: 'ok',
      text: notes.texts.kickNote,
      name: 'Admin E',
      author: fakeAddress('admin-4'),
      edited: false,
    });
    // One shared list for every card: the note's own key was never searched.
    expect(fetchCallsFor(`identifier=qmp-adminnote-${notes.kickKey}`)).toEqual([]);
  });

  it('an invite’s note is its nominator’s, under the nominee’s address', async () => {
    const { address, notes } = setup();
    const data = await loadNominations();
    const n = data.open.find((x) => x.nominee === ADDR.nominatedSigning)!;
    expect(n.decision).toBeTruthy();
    const onInvite = decisionNoteTarget(n.decision!, n);
    expect(onInvite?.spans).toEqual([
      { key: notes.nomineeKey, since: expect.any(Number), author: ADDR.nominator },
    ]);
    expect(nominationNoteTarget(n)).toEqual(onInvite);
    const note = await loadAdminNote(address, onInvite!);
    expect(note).toMatchObject({ status: 'ok', text: notes.texts.nominationNote });
  });

  it('none when its proposer wrote none', async () => {
    const { world, address } = setup();
    const ban = world.pending.find((t: { type: string }) => t.type === 'GROUP_BAN');
    const target = decisionNoteTarget({
      signature: ban.signature,
      kind: 'ban',
      subject: ADDR.banTarget,
      createdAt: ban.timestamp,
      creatorAddress: ban.creatorAddress,
    });
    expect(await loadAdminNote(address, target!)).toEqual({ status: 'none' });
  });
});

describe('comments for the Minter Admins', () => {
  it('count only from current Minter Admins', async () => {
    const { notes } = setup();
    const index = await loadAdminCommentIndex();
    const names = index.rows.map((r) => r.name).sort();
    expect(names).toEqual(['Admin D ΑΩ', 'Admin E', 'Admin F']);
    expect(
      index.rows.every((r) => r.identifier.startsWith(`qmp-macomment-${notes.inviteKey}-`))
    ).toBe(true);
  });

  it('a thread: decrypted, a reply’s public comment read too, one not encrypted to the viewer counted', async () => {
    const { world, address, notes, comments } = setup();
    const signing = world.pending.find(
      (t: { type: string; invitee?: string }) =>
        t.type === 'GROUP_INVITE' && t.invitee === ADDR.nominatedSigning
    );
    const target = decisionCommentTarget({
      signature: signing.signature,
      kind: 'invite',
      subject: ADDR.nominatedSigning,
      createdAt: signing.timestamp,
    });
    const rows = await loadAdminCommentRows(target);
    expect(rows.rows.map((r) => r.identifier).sort()).toEqual(
      [notes.ids.concern, notes.ids.checked, notes.ids.locked].sort()
    );
    expect(rows.rows.every((r) => r.adminOnly)).toBe(true);
    // The public rows go along, so a reply's public comment can be read too.
    const publicRows = (await loadCommentRows(target)).rows;
    const thread = await loadAdminThread(address, target, publicRows, 20);
    expect(thread.locked).toBe(1);
    const texts = [...thread.bodies.values()].flatMap((b) =>
      b.status === 'ok' ? [b.record.text] : []
    );
    expect(texts).toEqual(expect.arrayContaining([notes.texts.concern, notes.texts.checked]));
    // Admin C's public comment, which the reply answers.
    const parentRef = `Admin C\n${comments.ids.signed}`;
    expect(thread.bodies.get(parentRef)).toMatchObject({ status: 'ok' });
  });
});
