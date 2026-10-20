/**
 * Writes for the Minter Admins only: the note and the comments, each one
 * PUBLISH_QDN_RESOURCE, DOCUMENT_PRIVATE, encrypted to every Minter Admin who
 * can sign and the writer (pinned), and refused before Hub for anyone else.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NULL_OWNER, addAdminNotes, addComments } from '../../e2e/world.mjs';
import { fromData64 } from '../data/adminPollRecords';
import { parseAdminComment, parseAdminNote } from '../data/adminNoteRecords';
import { serveAdminPolls } from '../test/adminPolls';
import { mockQortalRequest, qortalCallsFor } from '../test/setup';
import { PEOPLE, installWorld } from '../test/world';
import { pendingAdminNotesAtom, resetPendingAdminNotes } from '../state/adminNotes';
import { optimisticCommentsAtom, resetOptimisticComments } from '../state/comments';
import { getDefaultStore } from 'jotai';
import {
  deleteAdminComment,
  editAdminComment,
  postAdminComment,
  publishAdminNote,
  type AdminWriter,
} from './adminNotes';

beforeEach(() => {
  resetPendingAdminNotes();
  resetOptimisticComments();
});

function writerFor(persona: string) {
  const installed = installWorld(persona);
  addComments(installed.world);
  const notes = addAdminNotes(installed.world);
  serveAdminPolls(installed.world, persona);
  const me: AdminWriter = {
    address: installed.address,
    publicKey: installed.publicKey,
    name: PEOPLE[persona].name,
  };
  return { ...installed, notes, me };
}

const sent = () =>
  mockQortalRequest('PUBLISH_QDN_RESOURCE', (request: Record<string, unknown>) => ({
    type: 'ARBITRARY',
    signature: 'S1',
    identifier: request.identifier,
  }));
const publishes = () => qortalCallsFor('PUBLISH_QDN_RESOURCE');
const signerKeys = (world: ReturnType<typeof installWorld>['world']) =>
  world.admins
    .filter((a: string) => a !== NULL_OWNER)
    .map((a: string) => world.accounts.get(a).publicKey);

describe('publishAdminNote', () => {
  it('one publish, DOCUMENT_PRIVATE, encrypted to every Minter Admin who can sign; shown at once', async () => {
    const { me, world, notes } = writerFor('admin');
    sent();
    const result = await publishAdminNote(me, notes.kickKey, '  Offline since March. ');
    expect(result.outcome).toMatchObject({ status: 'sent' });
    expect(publishes()).toHaveLength(1);
    const call = publishes()[0];
    expect(call).toEqual({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'Avery Admin',
      service: 'DOCUMENT_PRIVATE',
      identifier: `qmp-adminnote-${notes.kickKey}`,
      data64: expect.any(String),
      encrypt: true,
      publicKeys: expect.any(Array),
    });
    expect(new Set(call.publicKeys as string[])).toEqual(new Set(signerKeys(world)));
    expect(parseAdminNote(fromData64(String(call.data64)), String(call.identifier))).toEqual({
      v: 1,
      key: notes.kickKey,
      text: 'Offline since March.',
    });
    expect(result.readers).toBe(signerKeys(world).length);
    const pending = Object.values(getDefaultStore().get(pendingAdminNotesAtom));
    expect(pending).toMatchObject([{ key: notes.kickKey, text: 'Offline since March.' }]);
  });

  it('an edit is marked edited', async () => {
    const { me, notes } = writerFor('admin');
    sent();
    await publishAdminNote(me, notes.nomineeKey, 'Changed my mind.', { edited: true });
    const call = publishes()[0];
    expect(call.identifier).toBe(`qmp-adminnote-${notes.nomineeKey}`);
    expect(fromData64(String(call.data64))).toEqual({
      v: 1,
      key: notes.nomineeKey,
      text: 'Changed my mind.',
      edited: true,
    });
  });

  it('refuses before Hub for anyone who isn’t a Minter Admin, and for an empty note', async () => {
    const { me, notes } = writerFor('nominator');
    sent();
    const result = await publishAdminNote(me, notes.kickKey, 'Hello');
    expect(result.outcome).toEqual({
      status: 'blocked',
      reason: 'Only Minter Admins can write for the Minter Admins only.',
    });
    const empty = await publishAdminNote({ ...me }, notes.kickKey, '   ');
    expect(empty.outcome).toMatchObject({ status: 'blocked', reason: 'Write something first.' });
    expect(publishes()).toEqual([]);
  });

  it('refuses a name that isn’t the writer’s', async () => {
    const { me, notes } = writerFor('admin');
    sent();
    const result = await publishAdminNote(
      { ...me, name: PEOPLE.nominator.name },
      notes.kickKey,
      'x'
    );
    expect(result.outcome).toEqual({
      status: 'blocked',
      reason: `The name ${PEOPLE.nominator.name} belongs to another account.`,
    });
    expect(publishes()).toEqual([]);
  });
});

describe('comments for the Minter Admins', () => {
  it('post: a new identifier, encrypted; a reply may answer a public comment; shown at once', async () => {
    const { me, world, notes } = writerFor('admin');
    sent();
    const result = await postAdminComment(me, {
      key: notes.inviteKey,
      text: 'Agreed with Admin C.',
      replyTo: `qmp-comment-${notes.inviteKey}-bob002`,
    });
    expect(result.outcome).toMatchObject({ status: 'sent' });
    expect(result.identifier).toMatch(new RegExp(`^qmp-macomment-${notes.inviteKey}-[a-z0-9]{6}$`));
    const call = publishes()[0];
    expect(call).toMatchObject({
      service: 'DOCUMENT_PRIVATE',
      identifier: result.identifier,
      encrypt: true,
    });
    expect(new Set(call.publicKeys as string[])).toEqual(new Set(signerKeys(world)));
    expect(parseAdminComment(fromData64(String(call.data64)), result.identifier)).toEqual({
      v: 1,
      key: notes.inviteKey,
      text: 'Agreed with Admin C.',
      replyTo: `qmp-comment-${notes.inviteKey}-bob002`,
    });
    const optimistic = Object.values(getDefaultStore().get(optimisticCommentsAtom));
    expect(optimistic).toMatchObject([{ identifier: result.identifier, adminOnly: true }]);
  });

  it('edit and delete republish the same identifier, encrypted, under its own name', async () => {
    const { me, notes } = writerFor('admin');
    sent();
    const ref = {
      name: 'Avery Admin',
      identifier: `qmp-macomment-${notes.inviteKey}-own001`,
      key: notes.inviteKey,
      replyTo: null,
    };
    await editAdminComment(me, ref, 'Fixed a typo.');
    await deleteAdminComment(me, ref);
    const [edit, del] = publishes();
    expect(edit).toMatchObject({ identifier: ref.identifier, encrypt: true, name: 'Avery Admin' });
    expect(fromData64(String(edit.data64))).toEqual({
      v: 1,
      key: notes.inviteKey,
      text: 'Fixed a typo.',
      edited: true,
    });
    expect(fromData64(String(del.data64))).toEqual({
      v: 1,
      key: notes.inviteKey,
      text: '',
      deleted: true,
    });
  });

  it('refuses before Hub for anyone who isn’t a Minter Admin', async () => {
    const { me, notes } = writerFor('learner');
    sent();
    const result = await postAdminComment(me, { key: notes.inviteKey, text: 'Hi' });
    expect(result.outcome).toMatchObject({ status: 'blocked' });
    expect(publishes()).toEqual([]);
  });
});
