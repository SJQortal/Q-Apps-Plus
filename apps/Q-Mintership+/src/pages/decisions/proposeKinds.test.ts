import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../../data/decisions';
import { ADDR, installWorld } from '../../test/world';
import { fakeAddress } from '../../../e2e/world.mjs';
import { TX_TYPE_OF_ACTION } from '../../writes/hubActions';
import { PROPOSAL_TX_TYPE } from '../../writes/flows';
import { PROPOSE_KINDS, checkSubject, proposalKindOf, resolvePerson } from './proposeKinds';

afterEach(() => vi.useRealTimers());

describe('proposals: kinds', () => {
  it('opens the Hub action that creates the transaction each proposal pays for', () => {
    for (const [kind, info] of Object.entries(PROPOSE_KINDS)) {
      expect(TX_TYPE_OF_ACTION[info.action], kind).toBe(info.txType);
      expect(PROPOSAL_TX_TYPE[proposalKindOf(kind as keyof typeof PROPOSE_KINDS)], kind).toBe(
        info.txType
      );
    }
    expect(Object.keys(PROPOSE_KINDS).sort()).toEqual(
      [...Object.keys(PROPOSAL_TX_TYPE), 'decline'].sort()
    );
  });

  it('declines a join request with a kick', () => {
    expect(proposalKindOf('decline')).toBe('kick');
    expect(PROPOSE_KINDS.decline).toMatchObject({
      label: 'Decline a join request',
      action: 'KICK_FROM_GROUP',
    });
  });
});

describe('proposals: person and check', () => {
  it('resolves a name or an address, and says when neither works', async () => {
    installWorld('admin');
    await expect(resolvePerson('Kai Target')).resolves.toEqual({
      address: ADDR.kickTarget,
      name: 'Kai Target',
    });
    await expect(resolvePerson(` ${ADDR.kickTarget} `)).resolves.toMatchObject({
      address: ADDR.kickTarget,
    });
    await expect(resolvePerson('nobody-here')).resolves.toMatchObject({
      error: expect.stringMatching(/No account owns/),
    });
    await expect(resolvePerson('')).resolves.toMatchObject({ error: expect.any(String) });
  });

  it('turns a kick or ban of a Minter Admin into "remove their admin role first"', async () => {
    const { address, publicKey } = installWorld('admin');
    const signer = { address, publicKey };
    await expect(checkSubject('kick', signer, ADDR.demote)).resolves.toEqual({ status: 'admin' });
    await expect(checkSubject('ban', signer, ADDR.adminL4)).resolves.toEqual({ status: 'admin' });
    await expect(checkSubject('kick', signer, ADDR.learner)).resolves.toEqual({ status: 'ok' });
    // A removal of this member is waiting already.
    await expect(checkSubject('kick', signer, ADDR.kickTarget)).resolves.toMatchObject({
      status: 'blocked',
    });
    // The null owner can never be removed.
    const owner = (await loadDecisions()).group.owner;
    await expect(checkSubject('removeAdmin', signer, owner)).resolves.toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/owner/),
    });
  });

  it('declines only a join request from someone not in MINTER', async () => {
    const { address, publicKey } = installWorld('admin');
    const signer = { address, publicKey };
    await expect(checkSubject('decline', signer, fakeAddress('jr-1'))).resolves.toEqual({
      status: 'ok',
    });
    // An admin isn't switched to "remove their admin role first": there's no request to decline.
    await expect(checkSubject('decline', signer, ADDR.demote)).resolves.toMatchObject({
      status: 'blocked',
    });
    await expect(checkSubject('decline', signer, ADDR.learner)).resolves.toMatchObject({
      status: 'blocked',
      reason: expect.stringMatching(/^Already in MINTER/),
    });
  });

  it('points an admin who picks themselves to remove to Step down on their own page', async () => {
    const { address, publicKey } = installWorld('admin');
    await expect(checkSubject('removeAdmin', { address, publicKey }, address)).resolves.toEqual({
      status: 'blocked',
      reason: 'To step down, use Step down as Minter Admin on your own page.',
    });
    // Another admin is still theirs to propose.
    await expect(
      checkSubject('removeAdmin', { address, publicKey }, ADDR.adminL4)
    ).resolves.toEqual({ status: 'ok' });
  });

  it('cancels only a stored invite, and not twice', async () => {
    const { address, publicKey } = installWorld('admin');
    const signer = { address, publicKey };
    await expect(checkSubject('cancelInvite', signer, fakeAddress('stale-2'))).resolves.toEqual({
      status: 'ok',
    });
    await expect(checkSubject('cancelInvite', signer, ADDR.learner)).resolves.toEqual({
      status: 'blocked',
      reason: 'There is no approved invite stored for this account.',
    });
    // Its cancellation is waiting already (the invitee is read from its raw bytes).
    await expect(checkSubject('cancelInvite', signer, fakeAddress('stale-1'))).resolves.toEqual({
      status: 'blocked',
      reason: 'Cancelling this invite is already waiting for approvals.',
    });
  });
});
