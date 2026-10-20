/**
 * Group "ops": kick, ban (permanent and timed), lift a ban, add and remove a
 * Minter Admin, "remove admin rights first" before removing an admin from
 * the group, and cancelling an approved invite. Every proposal chains its
 * proposer's own signature (two Hub steps). 6 admin rows at PCT40: 3 needed.
 * Also the guards: banned, member, duplicate, already signed.
 */
import { banOf, decided, freshGroup, isAdmin, isMember, pages, proposeSigned, sign } from '../lib/scenario-helpers.mjs';

export default {
  name: 'ops',
  title: 'Kick, ban (permanent, timed), lift, add/remove admin, admin-first path, cancel an approved invite, guards',
  group: 'ops',
  async run(ctx) {
    const key = await freshGroup('ops');
    const groupId = ctx.group(key).groupId;
    const page = pages(ctx, key);
    const A = (l) => ctx.account(l).address;
    const rows = async () => (await ctx.get(`/groups/members/${groupId}?onlyAdmins=true&limit=100`)).adminCount;
    ctx.record('adminRowsAtStart', await rows());

    // Round 1, side by side: kick, permanent ban, timed ban, and an invite to cancel later.
    const [nomineeLabel] = await ctx.fresh('ops-', 1, '2');
    const [kick, banP, banT, invite] = await Promise.all([
      proposeSigned(ctx, page, 'admin09', { kind: 'kick', subject: A('mem05'), reason: 'Testnet: kick.' }, ['admin10', 'admin11']),
      proposeSigned(ctx, page, 'admin10', { kind: 'ban', subject: A('mem06'), reason: 'Testnet: permanent ban.', banSeconds: 0 }, ['admin11', 'admin12']),
      proposeSigned(ctx, page, 'admin11', { kind: 'ban', subject: A('mem07'), reason: 'Testnet: one-day ban.', banSeconds: 86_400 }, ['admin12', 'admin13']),
      (async () => {
        const first = await (await page('admin12')).flow('firstSignature', A(nomineeLabel));
        ctx.expect(first.invite.status === 'sent' && first.approval?.status === 'sent', 'a nomination invite with its first signature');
        const tx = await ctx.waitForConfirmed(first.inviteSignature);
        await sign(ctx, page, 'admin13', first.inviteSignature);
        await sign(ctx, page, 'admin09', first.inviteSignature);
        return { sig: first.inviteSignature, height: tx.blockHeight };
      })(),
    ]);
    ctx.record('heights', { kick: kick.height, banPermanent: banP.height, banTimed: banT.height, invite: invite.height });
    for (const d of [kick, banP, banT, invite]) ctx.expect(d.txGroupId === undefined || d.txGroupId === groupId, 'each waits for the group\'s admins');

    // Guard: a second kick of the same member while one waits.
    const dup = await (await page('admin12')).flow('proposeAndSign', { kind: 'kick', subject: A('mem05'), reason: 'Duplicate.' });
    ctx.record('duplicateKick', dup.proposal);
    ctx.expect(dup.proposal.status === 'blocked', 'a duplicate proposal is refused before Hub');
    // Guard: signing twice.
    const twice = await (await page('admin10')).flow('signDecision', kick.sig);
    ctx.record('signTwice', twice);
    ctx.expect(twice.status === 'blocked', 'a second signature from the same admin is refused before Hub');

    const [kickTx, banPTx, banTTx, inviteTx] = await Promise.all([kick, banP, banT, invite].map((d) => decided(ctx, d.sig)));
    ctx.record('decided', {
      kick: [kickTx.approvalStatus, kickTx.approvalHeight],
      banPermanent: [banPTx.approvalStatus, banPTx.approvalHeight],
      banTimed: [banTTx.approvalStatus, banTTx.approvalHeight],
      invite: [inviteTx.approvalStatus, inviteTx.approvalHeight],
    });
    ctx.expect(!(await isMember(ctx, groupId, A('mem05'))), 'kick: mem05 is out');
    const permanent = await banOf(ctx, groupId, A('mem06'));
    const timed = await banOf(ctx, groupId, A('mem07'));
    ctx.record('bans', { permanent, timed });
    ctx.expect(permanent && !permanent.expiry, 'the permanent ban has no end');
    ctx.expect(timed && timed.expiry > Date.now(), 'the timed ban ends in the future');
    ctx.expect(!(await isMember(ctx, groupId, A('mem06'))), 'a banned member is out of the group');
    const stored = (await ctx.get(`/groups/invites/group/${groupId}`)).some((i) => i.invitee === A(nomineeLabel));
    ctx.expect(stored, 'the approved invite is stored (no join request was in)');

    // Guards: invite a banned account; invite a member.
    const banned = await (await page('admin09')).flow('firstSignature', A('mem07'));
    ctx.record('inviteBanned', banned.invite);
    ctx.expect(banned.invite.status === 'blocked', 'inviting a banned account is refused before Hub');
    const member = await (await page('admin09')).flow('firstSignature', A('nom08'));
    ctx.record('inviteMember', member.invite);
    ctx.expect(member.invite.status === 'blocked', 'inviting a member is refused before Hub');

    // Round 2: lift the permanent ban; cancel the approved invite; make nom07 a Minter Admin.
    const [lift, cancel, add] = await Promise.all([
      proposeSigned(ctx, page, 'admin12', { kind: 'cancelBan', subject: A('mem06') }, ['admin13', 'admin09']),
      proposeSigned(ctx, page, 'admin13', { kind: 'cancelInvite', subject: A(nomineeLabel) }, ['admin09', 'admin10']),
      proposeSigned(ctx, page, 'admin09', { kind: 'addAdmin', subject: A('nom07') }, ['admin10', 'admin11']),
    ]);
    const [liftTx, cancelTx, addTx] = await Promise.all([lift, cancel, add].map((d) => decided(ctx, d.sig)));
    ctx.record('decided2', {
      lift: [liftTx.approvalStatus, liftTx.approvalHeight],
      cancelInvite: [cancelTx.approvalStatus, cancelTx.approvalHeight],
      addAdmin: [addTx.approvalStatus, addTx.approvalHeight],
    });
    ctx.expect(!(await banOf(ctx, groupId, A('mem06'))), 'the ban is lifted');
    const storedAfter = (await ctx.get(`/groups/invites/group/${groupId}`)).some((i) => i.invitee === A(nomineeLabel));
    ctx.expect(!storedAfter, 'the approved invite is cancelled');
    ctx.expect(await isAdmin(ctx, groupId, A('nom07')), 'nom07 is a Minter Admin');
    ctx.record('adminRowsAfterAdd', await rows());

    // Removing an admin from the group: the guard asks for their admin role to go first.
    const direct = await (await page('admin10')).flow('proposeAndSign', { kind: 'kick', subject: A('nom07'), reason: 'Testnet.' });
    ctx.record('kickAdmin', direct.proposal);
    ctx.expect(
      direct.proposal.status === 'blocked' && /admin role first/i.test(direct.proposal.reason ?? ''),
      'kicking an admin is refused: remove the admin role first'
    );
    const remove = await proposeSigned(ctx, page, 'admin10', { kind: 'removeAdmin', subject: A('nom07') }, ['admin11', 'admin12']);
    const removeTx = await decided(ctx, remove.sig);
    ctx.record('removeAdmin', [removeTx.approvalStatus, removeTx.approvalHeight]);
    ctx.expect(!(await isAdmin(ctx, groupId, A('nom07'))), 'nom07 is no longer an admin');
    ctx.record('adminRowsAfterRemove', await rows());
    const kick2 = await proposeSigned(ctx, page, 'admin11', { kind: 'kick', subject: A('nom07'), reason: 'Testnet: after the admin role.' }, ['admin12', 'admin13']);
    const kick2Tx = await decided(ctx, kick2.sig);
    ctx.record('kickFormerAdmin', [kick2Tx.approvalStatus, kick2Tx.approvalHeight]);
    ctx.expect(!(await isMember(ctx, groupId, A('nom07'))), 'then the removal from the group goes through');
  },
};
