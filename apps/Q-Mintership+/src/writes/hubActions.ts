/**
 * Every chain write this app can make, as the exact qortalRequest payload
 * Hub expects (checked against Qortal Hub's get.ts handlers, 2026-10-12).
 * Pure builders; writes/runner.ts sends them. Tests pin each one.
 *
 * - Group transactions that need MINTER's approval carry txGroupId 694, so
 *   MINTER's admins decide them.
 * - KICK/BAN/… take `qortalAddress` (an address, never a name).
 * - INVITE_TO_GROUP needs a non-zero `inviteTime` (Hub refuses 0); 864000 as
 *   the original app sends.
 * - JOIN_GROUP never needs approval (Hub sends txGroupId 0 itself).
 * - GROUP_APPROVAL has no Hub action: the app builds the bytes and sends
 *   SIGN_TRANSACTION with process: true.
 */
import { BAN_MAX_SECONDS, INVITE_TIME_SECONDS, MINTER_GROUP_ID } from '../data/constants';
import {
  RECORD_SERVICE,
  toData64,
  type ConsideringRecord,
  type NominationRecord,
  type SupportRecord,
} from '../data/records';
import type { GroupTxType } from '../data/types';
import { COMMENT_SERVICE, type CommentRecord, type HideRecord } from '../data/commentRecords';
import type { CommunityVoteRecord, DecisionVoteRecord } from '../data/voteRecords';
import {
  ADMIN_POLL_SERVICE,
  type PollCommentRecord,
  type PollRecord,
  type ShareRecord,
  type VoteRecord,
} from '../data/adminPollRecords';

export interface HubRequest {
  action: string;
  [key: string]: unknown;
}

const G = MINTER_GROUP_ID;

export function inviteRequest(invitee: string): HubRequest {
  return {
    action: 'INVITE_TO_GROUP',
    groupId: G,
    inviteeAddress: invitee,
    inviteTime: INVITE_TIME_SECONDS,
    txGroupId: G,
  };
}

export function cancelInviteRequest(invitee: string): HubRequest {
  return { action: 'CANCEL_GROUP_INVITE', groupId: G, qortalAddress: invitee, txGroupId: G };
}

export function kickRequest(member: string, reason: string): HubRequest {
  return { action: 'KICK_FROM_GROUP', groupId: G, qortalAddress: member, reason, txGroupId: G };
}

/** `banSeconds`: 0 for permanent, otherwise 1…24 days in seconds. */
export function banRequest(offender: string, reason: string, banSeconds: number): HubRequest {
  if (!Number.isInteger(banSeconds) || banSeconds < 0 || banSeconds > BAN_MAX_SECONDS) {
    throw new Error('A ban is permanent (0) or lasts up to 24 days.');
  }
  return {
    action: 'BAN_FROM_GROUP',
    groupId: G,
    qortalAddress: offender,
    reason,
    banTime: banSeconds,
    txGroupId: G,
  };
}

export function cancelBanRequest(member: string): HubRequest {
  return { action: 'CANCEL_GROUP_BAN', groupId: G, qortalAddress: member, txGroupId: G };
}

export function addAdminRequest(member: string): HubRequest {
  return { action: 'ADD_GROUP_ADMIN', groupId: G, qortalAddress: member, txGroupId: G };
}

export function removeAdminRequest(admin: string): HubRequest {
  return { action: 'REMOVE_GROUP_ADMIN', groupId: G, qortalAddress: admin, txGroupId: G };
}

export function joinRequest(): HubRequest {
  return { action: 'JOIN_GROUP', groupId: G };
}

/** Joining any other group: an open one at once, a closed one as a join request (Core decides). */
export function joinGroupRequest(groupId: number): HubRequest {
  return { action: 'JOIN_GROUP', groupId };
}

/** A GROUP_APPROVAL the app built (approvalBytes.ts), signed and submitted by Hub. */
export function signApprovalRequest(unsignedBytes: string): HubRequest {
  return { action: 'SIGN_TRANSACTION', unsignedBytes, process: true };
}

export function publishRecordRequest(
  name: string,
  identifier: string,
  record:
    NominationRecord | SupportRecord | ConsideringRecord | CommunityVoteRecord | DecisionVoteRecord
): HubRequest {
  return {
    action: 'PUBLISH_QDN_RESOURCE',
    name,
    service: RECORD_SERVICE,
    identifier,
    data64: toData64(record),
  };
}

/** A comment (or its edit or deletion) or a Minter Admin's hide record, under `name`. */
export function publishCommentRequest(
  name: string,
  identifier: string,
  record: CommentRecord | HideRecord
): HubRequest {
  return {
    action: 'PUBLISH_QDN_RESOURCE',
    name,
    service: COMMENT_SERVICE,
    identifier,
    data64: toData64(record),
  };
}

/**
 * A Minter Admin poll record (data/adminPollRecords.ts) under `name`,
 * encrypted by Hub to `publicKeys` (base58): every current Minter Admin who
 * can sign, and the writer. Hub adds the writer's own key too, refuses an
 * empty list, and shows "isEncrypted: true" in its dialog (get.ts
 * publishQDNResource → encryptDataGroup). DOCUMENT_PRIVATE only takes data
 * that is encrypted (Core's Service.validate).
 */
export function publishEncryptedRequest(
  name: string,
  identifier: string,
  record: PollRecord | VoteRecord | PollCommentRecord | ShareRecord,
  publicKeys: readonly string[]
): HubRequest {
  const keys = [...new Set(publicKeys)];
  if (!keys.length) throw new Error('Encrypting needs at least one public key.');
  return {
    action: 'PUBLISH_QDN_RESOURCE',
    name,
    service: ADMIN_POLL_SERVICE,
    identifier,
    data64: toData64(record),
    encrypt: true,
    publicKeys: keys,
  };
}

/** The Core transaction type each action creates (for the after-timeout lookup and fees). */
export const TX_TYPE_OF_ACTION: Record<string, GroupTxType | 'ARBITRARY'> = {
  INVITE_TO_GROUP: 'GROUP_INVITE',
  CANCEL_GROUP_INVITE: 'CANCEL_GROUP_INVITE',
  KICK_FROM_GROUP: 'GROUP_KICK',
  BAN_FROM_GROUP: 'GROUP_BAN',
  CANCEL_GROUP_BAN: 'CANCEL_GROUP_BAN',
  ADD_GROUP_ADMIN: 'ADD_GROUP_ADMIN',
  REMOVE_GROUP_ADMIN: 'REMOVE_GROUP_ADMIN',
  JOIN_GROUP: 'JOIN_GROUP',
  SIGN_TRANSACTION: 'GROUP_APPROVAL',
  PUBLISH_QDN_RESOURCE: 'ARBITRARY',
};

/** The actions this app may ever send. Anything else is refused by the runner. */
export const WRITE_ACTIONS = new Set(Object.keys(TX_TYPE_OF_ACTION));
