/**
 * The group and invitee of a CANCEL_GROUP_INVITE, read from its raw bytes.
 *
 * Core's JSON for CANCEL_GROUP_INVITE leaves both out, but
 * `GET /transactions/signature/{sig}/raw` (base58) holds them.
 *
 * Layout (Core CancelGroupInviteTransactionTransformer, big-endian):
 *
 *   int32  type = 30 (CANCEL_GROUP_INVITE)
 *   int64  timestamp (ms)
 *   int32  txGroupId
 *   byte64 reference
 *   byte32 creator public key
 *   int32  groupId                offset 112
 *   byte25 invitee address        offset 116
 *   int64  fee
 *   byte64 signature
 *
 * 213 bytes in all.
 */
import { base58Decode, base58Encode } from './base58';

export const CANCEL_GROUP_INVITE_TYPE = 30;
const GROUP_ID_OFFSET = 4 + 8 + 4 + 64 + 32;
const INVITEE_OFFSET = GROUP_ID_OFFSET + 4;
const ADDRESS_LENGTH = 25;
export const CANCEL_GROUP_INVITE_LENGTH = INVITEE_OFFSET + ADDRESS_LENGTH + 8 + 64;

export interface CancelInviteTarget {
  groupId: number;
  invitee: string;
}

/** The target of a raw CANCEL_GROUP_INVITE (base58). Throws on anything else. */
export function cancelInviteTarget(rawBase58: string): CancelInviteTarget {
  const bytes = base58Decode(rawBase58.trim());
  if (bytes.length !== CANCEL_GROUP_INVITE_LENGTH)
    throw new Error(`Not a CANCEL_GROUP_INVITE: ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = view.getInt32(0, false);
  if (type !== CANCEL_GROUP_INVITE_TYPE) throw new Error(`Not a CANCEL_GROUP_INVITE: type ${type}`);
  return {
    groupId: view.getInt32(GROUP_ID_OFFSET, false),
    invitee: base58Encode(bytes.slice(INVITEE_OFFSET, INVITEE_OFFSET + ADDRESS_LENGTH)),
  };
}
