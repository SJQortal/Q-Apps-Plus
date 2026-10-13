import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultStore } from 'jotai';
import { addComments } from '../../e2e/world.mjs';
import { mockQortalRequest, qortalCallsFor } from '../test/setup';
import { ADDR, PEOPLE, installWorld } from '../test/world';
import { commentRef, hideIdentifier, type CommentRecord } from '../data/commentRecords';
import {
  optimisticCommentsAtom,
  optimisticHidesAtom,
  resetOptimisticComments,
} from '../state/comments';
import {
  deleteComment,
  editComment,
  guardCommentName,
  postComment,
  setCommentHidden,
  type CommentAuthor,
} from './comments';
import { publishCommentRequest } from './hubActions';

beforeEach(() => resetOptimisticComments());
afterEach(() => vi.useRealTimers());

const decode = (call: Record<string, unknown>) =>
  JSON.parse(
    new TextDecoder().decode(Uint8Array.from(atob(String(call.data64)), (c) => c.charCodeAt(0)))
  );

function author(
  persona: string
): CommentAuthor & { world: ReturnType<typeof installWorld>['world'] } {
  const { address, publicKey, world } = installWorld(persona);
  return { address, publicKey, name: PEOPLE[persona].name as string, world };
}

const sentTx = (identifier: string) => ({ type: 'ARBITRARY', signature: 'S1', identifier });

describe('the Hub request (pinned)', () => {
  it('publishes JSON under the name, with the record as base64', () => {
    const record: CommentRecord = { v: 1, key: ADDR.nominatedWaiting, text: 'Zoë says hi' };
    const identifier = `qmp-comment-${ADDR.nominatedWaiting}-abc123`;
    const request = publishCommentRequest('Nora Nominator', identifier, record);
    expect(request).toMatchObject({
      action: 'PUBLISH_QDN_RESOURCE',
      name: 'Nora Nominator',
      service: 'JSON',
      identifier,
    });
    expect(Object.keys(request).sort()).toEqual([
      'action',
      'data64',
      'identifier',
      'name',
      'service',
    ]);
    expect(decode(request)).toEqual(record);
  });
});

describe('postComment', () => {
  it('stops before Hub for an empty comment or a name that isn’t yours', async () => {
    const me = author('nominator');
    const empty = await postComment(me, { key: ADDR.nominatedWaiting, text: '  ' });
    expect(empty.outcome).toEqual({ status: 'blocked', reason: 'Write something first.' });
    const notMine = await postComment(
      { ...me, name: 'Avery Admin' },
      { key: ADDR.nominatedWaiting, text: 'Hello' }
    );
    expect(notMine.outcome).toMatchObject({
      status: 'blocked',
      reason: 'The name Avery Admin belongs to another account.',
    });
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
    expect(await guardCommentName(me, null)).toMatch(/needs a registered name/);
  });

  it('a decline in Hub sends nothing and shows nothing', async () => {
    const me = author('nominator');
    const result = await postComment(me, { key: ADDR.nominatedWaiting, text: 'Hello' });
    expect(result.outcome.status).toBe('declined');
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(1);
    expect(getDefaultStore().get(optimisticCommentsAtom)).toEqual({});
  });

  it('publishes a reply under a new identifier and shows it at once', async () => {
    const me = author('nominator');
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) =>
      sentTx(String(r.identifier))
    );
    const replyTo = `qmp-comment-${ADDR.nominatedWaiting}-wren01`;
    const result = await postComment(me, {
      key: ADDR.nominatedWaiting,
      text: ' Agreed.\r\n',
      replyTo,
    });
    expect(result.outcome.status).toBe('sent');
    expect(result.identifier).toMatch(
      new RegExp(`^qmp-comment-${ADDR.nominatedWaiting}-[a-z0-9]{6}$`)
    );
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({ name: 'Nora Nominator', identifier: result.identifier });
    expect(decode(call)).toEqual({ v: 1, key: ADDR.nominatedWaiting, text: 'Agreed.', replyTo });
    const shown = getDefaultStore().get(optimisticCommentsAtom);
    expect(shown[commentRef('Nora Nominator', result.identifier)]).toMatchObject({
      key: ADDR.nominatedWaiting,
      record: { text: 'Agreed.', replyTo },
    });
  });

  it('checks the fee against the confirmed balance first', async () => {
    const me = author('nominator');
    me.world.accounts.get(me.address).balance = 0;
    const result = await postComment(me, { key: ADDR.nominatedWaiting, text: 'Hello' });
    expect(result.outcome).toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/0\.01 QORT/),
    });
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  });
});

describe('edit and delete', () => {
  it('republish the same identifier under the comment’s name', async () => {
    const me = author('nominator');
    const { ids } = addComments(me.world);
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) =>
      sentTx(String(r.identifier))
    );
    const comment = {
      name: 'Nora Nominator',
      identifier: ids.sameHere,
      key: ADDR.nominatedWaiting,
      replyTo: ids.helped,
    };
    const edited = await editComment(me, comment, 'Same here, and their guide is good.');
    expect(edited.outcome.status).toBe('sent');
    const deleted = await deleteComment(me, comment);
    expect(deleted.outcome.status).toBe('sent');
    const [editCall, deleteCall] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(editCall.identifier).toBe(ids.sameHere);
    expect(decode(editCall)).toEqual({
      v: 1,
      key: ADDR.nominatedWaiting,
      text: 'Same here, and their guide is good.',
      replyTo: ids.helped,
      edited: true,
    });
    expect(decode(deleteCall)).toEqual({
      v: 1,
      key: ADDR.nominatedWaiting,
      text: '',
      deleted: true,
      replyTo: ids.helped,
    });
    // Someone else's comment can't be edited from this account.
    const other = await editComment(
      me,
      { ...comment, name: 'Member 7', identifier: ids.helped },
      'x'
    );
    expect(other.outcome.status).toBe('blocked');
  });
});

describe('setCommentHidden', () => {
  it('only a Minter Admin, checked now, can hide a comment for everyone', async () => {
    const member = author('nominator');
    const { ids } = addComments(member.world);
    const comment = { name: 'Spam Name', identifier: ids.spam, key: ADDR.nominatedWaiting };
    const refused = await setCommentHidden(member, comment, true);
    expect(refused.outcome).toMatchObject({
      status: 'blocked',
      reason: 'Only Minter Admins can hide a comment for everyone.',
    });
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(0);
  });

  it('publishes the admin’s hide record for that comment, and shows it hidden at once', async () => {
    const admin = author('admin');
    const { ids } = addComments(admin.world);
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) =>
      sentTx(String(r.identifier))
    );
    const comment = { name: 'Member 9', identifier: ids.civil, key: ADDR.nominatedWaiting };
    const result = await setCommentHidden(admin, comment, true);
    expect(result.outcome.status).toBe('sent');
    expect(result.identifier).toBe(hideIdentifier(ADDR.nominatedWaiting, 'Member 9', ids.civil));
    const call = qortalCallsFor('PUBLISH_QDN_RESOURCE')[0];
    expect(call).toMatchObject({
      name: 'Avery Admin',
      service: 'JSON',
      identifier: result.identifier,
    });
    expect(decode(call)).toEqual({
      v: 1,
      commentName: 'Member 9',
      commentIdentifier: ids.civil,
      hidden: true,
    });
    expect(
      getDefaultStore().get(optimisticHidesAtom)[commentRef('Member 9', ids.civil)]
    ).toMatchObject({
      hidden: true,
    });
    expect(admin.world && qortalCallsFor('SIGN_TRANSACTION')).toHaveLength(0);
  });

  it('never POSTs to Core', async () => {
    const admin = installWorld('admin');
    const { ids } = addComments(admin.world);
    mockQortalRequest('PUBLISH_QDN_RESOURCE', (r: Record<string, unknown>) =>
      sentTx(String(r.identifier))
    );
    await setCommentHidden(
      { address: admin.address, publicKey: admin.publicKey, name: 'Avery Admin' },
      { name: 'Spam Name', identifier: ids.spam, key: ADDR.nominatedWaiting },
      false
    );
    expect(admin.posts).toEqual([]);
  });
});
