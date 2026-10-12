import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDecisions } from '../../data/decisions';
import { ADDR, installWorld } from '../../test/world';
import { checkSubject, resolvePerson } from './proposeKinds';

afterEach(() => vi.useRealTimers());

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
});
