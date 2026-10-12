import { describe, expect, it } from 'vitest';
import { base58Encode } from '../qortal/base58';
import { isNewerDecision, signerState, tallyApprovals, type ApprovalRow } from './tally';

const PENDING = 'P'.repeat(10);
const OTHER = 'O'.repeat(10);
const sig = (n: number) => base58Encode(new Uint8Array(64).fill(n));

function row(
  admin: string,
  approval: boolean,
  timestamp: number,
  blockHeight: number | null,
  n = timestamp % 250
): ApprovalRow {
  return {
    signature: sig(n || 1),
    pendingSignature: PENDING,
    adminPublicKey: admin,
    creatorAddress: `Q-${admin}`,
    approval,
    timestamp,
    blockHeight,
  };
}

const base = { pendingSignature: PENDING, threshold: 'PCT40' as const, totalAdmins: 20 };

describe('tallyApprovals (Core getApprovalData + getApprovalDecision)', () => {
  it('counts only confirmed approvals for this pending transaction', () => {
    const rows = [
      row('a', true, 1, 10),
      row('b', true, 2, null),
      { ...row('c', true, 3, 11), pendingSignature: OTHER },
    ];
    const tally = tallyApprovals({ ...base, rows });
    expect(tally.approvalCount).toBe(1);
    expect(tally.inFlight.map((d) => d.adminPublicKey)).toEqual(['b']);
    expect(tally.projectedApprovalCount).toBe(2);
    expect(tally.needed).toBe(8);
    expect(tally.met).toBe(false);
  });

  it("keeps each signer's latest confirmed decision only", () => {
    const rows = [
      row('a', true, 1, 10),
      row('a', false, 5, 12),
      row('b', false, 2, 10),
      row('b', true, 6, 13),
    ];
    const tally = tallyApprovals({ ...base, rows });
    expect(tally.approvals.map((d) => d.adminPublicKey)).toEqual(['b']);
    expect(tally.rejections.map((d) => d.adminPublicKey)).toEqual(['a']);
  });

  it('breaks a timestamp tie by the larger signature, as Core does', () => {
    const older = { ...row('a', true, 7, 10), signature: sig(3) };
    const newer = { ...row('a', false, 7, 10), signature: sig(9) };
    expect(isNewerDecision(newer, older)).toBe(true);
    expect(tallyApprovals({ ...base, rows: [newer, older] }).rejectionCount).toBe(1);
    expect(tallyApprovals({ ...base, rows: [older, newer] }).approvalCount).toBe(0);
  });

  it('is met at 8 of 20 and stays met with extra signatures', () => {
    const eight = Array.from({ length: 8 }, (_, i) => row(`s${i}`, true, i + 1, 100 + i));
    expect(tallyApprovals({ ...base, rows: eight }).met).toBe(true);
    expect(tallyApprovals({ ...base, rows: eight.slice(0, 7) }).met).toBe(false);
  });

  it('reports a rejection threshold only when approvals do not meet theirs', () => {
    const rejections = Array.from({ length: 8 }, (_, i) => row(`r${i}`, false, i + 1, 100));
    expect(tallyApprovals({ ...base, rows: rejections }).rejectedMet).toBe(true);
    const both = [
      ...rejections,
      ...Array.from({ length: 8 }, (_, i) => row(`s${i}`, true, i + 1, 100)),
    ];
    const tally = tallyApprovals({ ...base, rows: both });
    expect(tally.met).toBe(true);
    expect(tally.rejectedMet).toBe(false);
  });

  it('ignores an unconfirmed row older than the confirmed one', () => {
    const rows = [row('a', true, 10, 50), row('a', true, 5, null)];
    const tally = tallyApprovals({ ...base, rows });
    expect(tally.inFlight).toEqual([]);
    expect(signerState(tally, 'a')).toBe('signed');
  });

  it('describes each signer', () => {
    const rows = [row('a', true, 1, 10), row('b', true, 2, null), row('c', false, 3, 10)];
    const tally = tallyApprovals({ ...base, rows });
    expect(signerState(tally, 'a')).toBe('signed');
    expect(signerState(tally, 'b')).toBe('confirming');
    expect(signerState(tally, 'c')).toBe('rejected');
    expect(signerState(tally, 'z')).toBe('none');
  });

  it('recomputes the target when the admin count changes', () => {
    const seven = Array.from({ length: 7 }, (_, i) => row(`s${i}`, true, i + 1, 100));
    expect(tallyApprovals({ ...base, totalAdmins: 17, rows: seven }).met).toBe(true);
    expect(tallyApprovals({ ...base, totalAdmins: 20, rows: seven }).met).toBe(false);
  });
});
