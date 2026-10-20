import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryLoadCounts } from '../../data/query';
import { ADDR, installWorld } from '../../test/world';
import { candidateBlock, loadCandidate } from './candidate';

afterEach(() => vi.useRealTimers());

describe('the Nominate form’s candidate check', () => {
  it('reads who they are and finds nothing in the way for a newcomer', async () => {
    installWorld('nominator');
    const c = await loadCandidate(ADDR.newcomerName);
    expect(c).toMatchObject({
      address: ADDR.newcomerName,
      name: 'Zoë Newcomer',
      level: 0,
      blocksMinted: 0,
      isMember: false,
      activeBan: false,
      storedInvite: false,
      pendingInvite: null,
      // A record by a level 2 member doesn't count as a nomination.
      openNomination: null,
    });
    expect(candidateBlock(c, ADDR.nominator)).toBeNull();
  });

  it('gives each guard in the order the form explains them', async () => {
    installWorld('nominator');
    const blockOf = async (key: string, me = ADDR.nominator) =>
      candidateBlock(await loadCandidate(ADDR[key]), me);
    expect(await blockOf('nominator')).toBe('self');
    expect(await blockOf('learner')).toBe('member');
    expect(await blockOf('admin')).toBe('member');
    expect(await blockOf('banned')).toBe('banned');
    expect(await blockOf('nominatedSigning')).toBe('pending');
    expect(await blockOf('approved')).toBe('stored');
    expect(await blockOf('nominatedWaiting')).toBe('open');
    expect(await blockOf('expired')).toBeNull();
    expect(await blockOf('lapsed')).toBeNull();
  });

  it('notes a join request, and caches the check for the session', async () => {
    installWorld('admin');
    const first = await loadCandidate(ADDR.nominatedSigning);
    expect(first.hasJoinRequest).toBe(true);
    expect(first.pendingInvite?.kind).toBe('invite');
    const loads = queryLoadCounts().candidate;
    await loadCandidate(ADDR.nominatedSigning);
    expect(queryLoadCounts().candidate).toBe(loads);
  });
});
