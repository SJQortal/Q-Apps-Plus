import { describe, expect, it } from 'vitest';
import fixture from '../test/fixtures/group-approvals.json';
import { base58Decode, base58Encode, compareBytes } from './base58';
import {
  APPROVAL_BYTE_OFFSET,
  GROUP_APPROVAL_UNSIGNED_LENGTH,
  groupApprovalBytes,
  groupApprovalUnsignedBase58,
  groupRejectionBytes,
  groupRejectionUnsignedBase58,
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

describe('groupRejectionBytes', () => {
  it('puts the approval byte at offset 176', () => {
    expect(APPROVAL_BYTE_OFFSET).toBe(176);
  });

  it.each(fixture.approvals.map((a, i) => [i, a] as const))(
    'is mainnet approval #%i byte for byte, with only byte 176 set to 0',
    (_i, approval) => {
      const fields = {
        timestamp: approval.timestamp,
        reference: approval.reference,
        adminPublicKey: approval.adminPublicKey,
        pendingSignature: approval.pendingSignature,
        feeAtomic: 1_000_000,
      };
      const expected = base58Decode(approval.raw).slice(0, GROUP_APPROVAL_UNSIGNED_LENGTH);
      expected[176] = 0;
      const built = groupRejectionBytes({ ...fields, approval: false });
      expect(built).toHaveLength(GROUP_APPROVAL_UNSIGNED_LENGTH);
      expect(Array.from(built)).toEqual(Array.from(expected));
      // Against the app's own approval: every byte equal but the approval byte.
      const approved = groupApprovalBytes({ ...fields, approval: true });
      const differing = Array.from(built).flatMap((b, i) => (b === approved[i] ? [] : [i]));
      expect(differing).toEqual([176]);
      expect(approved[176]).toBe(1);
      expect(built[176]).toBe(0);
    }
  );

  it('writes type 33, txGroupId 0, approval 0 and the fee at the right offsets', () => {
    const a = fixture.approvals[1];
    const bytes = groupRejectionBytes({
      timestamp: 1_791_000_000_000,
      reference: a.reference,
      adminPublicKey: a.adminPublicKey,
      pendingSignature: a.pendingSignature,
      approval: false,
      feeAtomic: 1_000_000,
    });
    const view = new DataView(bytes.buffer);
    expect(view.getInt32(0)).toBe(33);
    expect(Number(view.getBigInt64(4))).toBe(1_791_000_000_000);
    expect(view.getInt32(12)).toBe(0);
    expect(base58Encode(bytes.slice(80, 112))).toBe(a.adminPublicKey);
    expect(base58Encode(bytes.slice(112, 176))).toBe(a.pendingSignature);
    expect(bytes[176]).toBe(0);
    expect(Number(view.getBigInt64(177))).toBe(1_000_000);
  });

  it('is never built by accident: each builder takes only its own value', () => {
    const a = fixture.approvals[0];
    const base = {
      timestamp: 1,
      reference: a.reference,
      adminPublicKey: a.adminPublicKey,
      pendingSignature: a.pendingSignature,
      feeAtomic: 1_000_000,
    };
    expect(() => groupRejectionBytes({ ...base, approval: true as unknown as false })).toThrow(
      /Only rejections/
    );
    expect(() => groupRejectionBytes({ ...base, approval: undefined as unknown as false })).toThrow(
      /Only rejections/
    );
    expect(() => groupApprovalBytes({ ...base, approval: undefined as unknown as true })).toThrow(
      /Only approvals/
    );
    expect(() => groupApprovalBytes({ ...base, approval: 0 as unknown as true })).toThrow(
      /Only approvals/
    );
  });

  it('refuses malformed fields as approvals do', () => {
    const a = fixture.approvals[0];
    const good = {
      timestamp: 1,
      reference: a.reference,
      adminPublicKey: a.adminPublicKey,
      pendingSignature: a.pendingSignature,
      approval: false as const,
      feeAtomic: 1_000_000,
    };
    expect(() => groupRejectionBytes({ ...good, pendingSignature: a.adminPublicKey })).toThrow(
      /64 bytes/
    );
    expect(() => groupRejectionBytes({ ...good, adminPublicKey: a.reference })).toThrow(/32 bytes/);
    expect(() => groupRejectionBytes({ ...good, feeAtomic: 0 })).toThrow();
    expect(() => groupRejectionBytes({ ...good, timestamp: 0 })).toThrow();
    const encoded = groupRejectionUnsignedBase58(good);
    expect(base58Decode(encoded)[176]).toBe(0);
    expect(encoded).not.toBe(groupApprovalUnsignedBase58({ ...good, approval: true }));
  });
});
