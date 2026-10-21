import { describe, expect, it } from 'vitest';
import { answerBadges, tallyBadges } from './answerBadges';

describe('answer badges on comments', () => {
  it('shows the answer that is newest: on its way over confirmed, Considering over both', () => {
    const badges = answerBadges(
      [{ address: 'A' }, { address: 'B' }, { address: 'C', confirming: true }],
      [{ address: 'C' }, { address: 'B', confirming: true }, { address: 'D' }],
      [{ address: 'D' }]
    );
    expect(Object.fromEntries(badges)).toEqual({
      A: { kind: 'approved' },
      B: { kind: 'rejected', confirming: true },
      C: { kind: 'approved', confirming: true },
      D: { kind: 'considering' },
    });
  });

  it('reads a tally, leaving out answers without an address', () => {
    const row = (address: string | undefined, approval: boolean) => ({
      adminPublicKey: `pk-${address}`,
      address,
      approval,
      timestamp: 1,
      blockHeight: 1,
      signature: `s-${address}`,
      withdrew: false,
    });
    const badges = tallyBadges(
      {
        approvals: [row('A', true), row(undefined, true)],
        rejections: [row('B', false)],
        inFlight: [row('C', true)],
      },
      []
    );
    expect(Object.fromEntries(badges)).toEqual({
      A: { kind: 'approved' },
      B: { kind: 'rejected' },
      C: { kind: 'approved', confirming: true },
    });
    expect(tallyBadges(null, [{ address: 'K' }]).get('K')).toEqual({ kind: 'considering' });
  });
});
