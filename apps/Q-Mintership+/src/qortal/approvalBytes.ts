/**
 * The unsigned bytes of a GROUP_APPROVAL transaction, built in the app.
 *
 * Hub has no GROUP_APPROVAL action, so a Minter Admin's signature goes
 * through SIGN_TRANSACTION { unsignedBytes, process: true }: Hub decodes the
 * bytes with Core, shows them, signs them and submits them. Building them
 * here (instead of asking the node's /groups/approval builder, which public
 * nodes may refuse) keeps signing working on any node.
 *
 * Layout (Core GroupApprovalTransactionTransformer.toBytes, big-endian):
 *
 *   int32  type = 33 (GROUP_APPROVAL)
 *   int64  timestamp (ms)
 *   int32  txGroupId = 0          GROUP_APPROVAL never needs approval itself
 *   byte64 reference              the signer's last reference
 *   byte32 creator public key     the signing admin
 *   byte64 pending signature      the transaction being decided
 *   byte1  approval               1 = approve (Sign), 0 = reject (Reject, Withdraw)
 *   int64  fee (1e-8 QORT units)  0.01 QORT = 1_000_000
 *
 * 185 bytes; Hub appends the 64-byte signature.
 *
 * A signature and a rejection differ only in the approval byte (offset 176).
 * Each has its own builder, typed to its own value, so a rejection is never
 * built by accident: groupApprovalBytes refuses `approval: false` and
 * groupRejectionBytes refuses `approval: true`.
 */
import { base58DecodeExact, base58Encode } from './base58';

export const GROUP_APPROVAL_TYPE = 33;
export const GROUP_APPROVAL_UNSIGNED_LENGTH = 4 + 8 + 4 + 64 + 32 + 64 + 1 + 8;

interface GroupDecisionFields {
  timestamp: number;
  /** Base58, 64 bytes. */
  reference: string;
  /** Base58, 32 bytes: the admin who signs. */
  adminPublicKey: string;
  /** Base58, 64 bytes: the pending transaction's signature. */
  pendingSignature: string;
  /** Fee in 1e-8 QORT units (Core's unitfee answer), e.g. 1_000_000 for 0.01 QORT. */
  feeAtomic: number;
}

/** A signature (Sign): approval 1. */
export interface GroupApprovalFields extends GroupDecisionFields {
  approval: true;
}

/** A rejection (Reject, or Withdraw my signature): approval 0. */
export interface GroupRejectionFields extends GroupDecisionFields {
  approval: false;
}

/** Offset of the approval byte in the unsigned bytes. */
export const APPROVAL_BYTE_OFFSET = 4 + 8 + 4 + 64 + 32 + 64;

function writeInt32(view: DataView, offset: number, value: number): number {
  view.setInt32(offset, value, false);
  return offset + 4;
}

function writeInt64(view: DataView, offset: number, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Not a valid int64: ${value}`);
  view.setBigInt64(offset, BigInt(value), false);
  return offset + 8;
}

/** The shared layout. Throws on a malformed field instead of building bad bytes. */
function groupDecisionBytes(fields: GroupDecisionFields, approvalByte: 0 | 1): Uint8Array {
  if (!Number.isSafeInteger(fields.timestamp) || fields.timestamp <= 0) {
    throw new Error('timestamp must be a positive integer of milliseconds');
  }
  if (!Number.isSafeInteger(fields.feeAtomic) || fields.feeAtomic <= 0) {
    throw new Error('feeAtomic must be a positive integer');
  }
  const reference = base58DecodeExact(fields.reference, 64, 'reference');
  const publicKey = base58DecodeExact(fields.adminPublicKey, 32, 'adminPublicKey');
  const pending = base58DecodeExact(fields.pendingSignature, 64, 'pendingSignature');

  const bytes = new Uint8Array(GROUP_APPROVAL_UNSIGNED_LENGTH);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  offset = writeInt32(view, offset, GROUP_APPROVAL_TYPE);
  offset = writeInt64(view, offset, fields.timestamp);
  offset = writeInt32(view, offset, 0);
  bytes.set(reference, offset);
  offset += 64;
  bytes.set(publicKey, offset);
  offset += 32;
  bytes.set(pending, offset);
  offset += 64;
  if (offset !== APPROVAL_BYTE_OFFSET) throw new Error('GROUP_APPROVAL layout mismatch');
  bytes[offset] = approvalByte;
  offset += 1;
  offset = writeInt64(view, offset, fields.feeAtomic);
  if (offset !== GROUP_APPROVAL_UNSIGNED_LENGTH) throw new Error('GROUP_APPROVAL layout mismatch');
  return bytes;
}

/** A signature's unsigned bytes (approval 1). Refuses anything but `approval: true`. */
export function groupApprovalBytes(fields: GroupApprovalFields): Uint8Array {
  if (fields.approval !== true)
    throw new Error(
      'Only approvals are built by groupApprovalBytes; a rejection has its own builder'
    );
  return groupDecisionBytes(fields, 1);
}

/** A rejection's unsigned bytes (approval 0). Refuses anything but `approval: false`. */
export function groupRejectionBytes(fields: GroupRejectionFields): Uint8Array {
  if (fields.approval !== false)
    throw new Error(
      'Only rejections are built by groupRejectionBytes; a signature has its own builder'
    );
  return groupDecisionBytes(fields, 0);
}

/** The base58 string SIGN_TRANSACTION takes as `unsignedBytes`, for a signature. */
export function groupApprovalUnsignedBase58(fields: GroupApprovalFields): string {
  return base58Encode(groupApprovalBytes(fields));
}

/** The base58 string SIGN_TRANSACTION takes as `unsignedBytes`, for a rejection. */
export function groupRejectionUnsignedBase58(fields: GroupRejectionFields): string {
  return base58Encode(groupRejectionBytes(fields));
}
