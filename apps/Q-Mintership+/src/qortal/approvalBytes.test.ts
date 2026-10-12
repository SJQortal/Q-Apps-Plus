import { describe, expect, it } from 'vitest';
import fixture from '../test/fixtures/group-approvals.json';
import { base58Decode, base58Encode, compareBytes } from './base58';
import {
  GROUP_APPROVAL_UNSIGNED_LENGTH,
  groupApprovalBytes,
  groupApprovalUnsignedBase58,
} from './approvalBytes';

describe('base58', () => {
  it('round-trips, keeping leading zero bytes', () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 250, 255]);
    expect(base58Decode(base58Encode(bytes))).toEqual(bytes);
    expect(base58Encode(new Uint8Array([0, 0]))).toBe('11');
  });

  it('decodes a real public key to 32 bytes', () => {
    expect(base58Decode(fixture.approvals[0].adminPublicKey)).toHaveLength(32);
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => base58Decode('0OIl')).toThrow();
  });

  it('compares bytes unsigned', () => {
    expect(compareBytes(new Uint8Array([200]), new Uint8Array([10]))).toBeGreaterThan(0);
  });
});

describe('groupApprovalBytes', () => {
  it.each(fixture.approvals.map((a, i) => [i, a] as const))(
    'rebuilds the unsigned bytes of mainnet approval #%i exactly',
    (_i, approval) => {
      const raw = base58Decode(approval.raw);
      // Signed transaction = unsigned bytes + 64-byte signature.
      expect(raw.length).toBe(GROUP_APPROVAL_UNSIGNED_LENGTH + 64);
      const built = groupApprovalBytes({
        timestamp: approval.timestamp,
        reference: approval.reference,
        adminPublicKey: approval.adminPublicKey,
        pendingSignature: approval.pendingSignature,
        approval: true,
        feeAtomic: 1_000_000,
      });
      expect(Array.from(built)).toEqual(Array.from(raw.slice(0, GROUP_APPROVAL_UNSIGNED_LENGTH)));
      expect(base58Encode(raw.slice(GROUP_APPROVAL_UNSIGNED_LENGTH))).toBe(approval.signature);
    }
  );

  it('writes type 33, txGroupId 0, approval 1 and the fee at the right offsets', () => {
    const a = fixture.approvals[0];
    const bytes = groupApprovalBytes({
      timestamp: 1_791_000_000_000,
      reference: a.reference,
      adminPublicKey: a.adminPublicKey,
      pendingSignature: a.pendingSignature,
      approval: true,
      feeAtomic: 1_000_000,
    });
    const view = new DataView(bytes.buffer);
    expect(view.getInt32(0)).toBe(33);
    expect(Number(view.getBigInt64(4))).toBe(1_791_000_000_000);
    expect(view.getInt32(12)).toBe(0);
    expect(bytes[176]).toBe(1);
    expect(Number(view.getBigInt64(177))).toBe(1_000_000);
  });

  it('refuses malformed fields instead of building bad bytes', () => {
    const a = fixture.approvals[0];
    const good = {
      timestamp: 1,
      reference: a.reference,
      adminPublicKey: a.adminPublicKey,
      pendingSignature: a.pendingSignature,
      approval: true as const,
      feeAtomic: 1_000_000,
    };
    expect(() => groupApprovalBytes({ ...good, pendingSignature: a.adminPublicKey })).toThrow(
      /64 bytes/
    );
    expect(() => groupApprovalBytes({ ...good, adminPublicKey: a.reference })).toThrow(/32 bytes/);
    expect(() => groupApprovalBytes({ ...good, feeAtomic: 0 })).toThrow();
    expect(() => groupApprovalBytes({ ...good, timestamp: 0 })).toThrow();
    expect(() => groupApprovalBytes({ ...good, approval: false as unknown as true })).toThrow(
      /Only approvals/
    );
    expect(groupApprovalUnsignedBase58(good).length).toBeGreaterThan(200);
  });
});
