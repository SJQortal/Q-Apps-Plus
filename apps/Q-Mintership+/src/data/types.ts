/**
 * The shapes Qortal Core 6.1.9 answers with, for the reads this app makes.
 * Checked with GETs against a mainnet node on 2026-10-12. Optional fields
 * really are left out by Core when empty (e.g. `primaryName`, `expiry`).
 */
import type { ApprovalThreshold } from '../rules/threshold';

export type Address = string;
export type PublicKey = string;
export type Signature = string;

/** `GET /groups/{id}` */
export interface GroupInfo {
  groupId: number;
  owner: Address;
  groupName: string;
  description?: string;
  created?: number;
  updated?: number;
  isOpen: boolean;
  approvalThreshold: ApprovalThreshold;
  minimumBlockDelay: number;
  maximumBlockDelay: number;
  memberCount?: number;
}

/** A row of `GET /groups/members/{id}`. `isAdmin` is only reliable with `onlyAdmins=true`. */
export interface GroupMemberRow {
  member: Address;
  joined?: number;
  isAdmin?: boolean;
  primaryName?: string;
}

/** `GET /groups/members/{id}` */
export interface GroupMembersPage {
  memberCount?: number;
  adminCount?: number;
  members: GroupMemberRow[];
}

/** A row of `GET /groups/member/{address}`: one group the address is in. */
export interface MembershipRow {
  groupId: number;
  groupName: string;
  owner: Address;
  isAdmin?: boolean;
  [key: string]: unknown;
}

/** `GET /groups/joinrequests/{id}` and `/groups/joinrequests/address/{a}` */
export interface JoinRequestRow {
  groupId: number;
  joiner: Address;
}

/** `GET /groups/invites/group/{id}` and `/groups/invites/{a}`: approved invites not yet used. */
export interface InviteRow {
  groupId: number;
  inviter: Address;
  invitee: Address;
  /** Absent when the invite was sent with no time-to-live. */
  expiry?: number;
}

/** `GET /groups/bans/{id}` */
export interface BanRow {
  groupId: number;
  offender: Address;
  admin: Address;
  banned: number;
  reason?: string;
  /** Absent for a permanent ban. */
  expiry?: number;
}

/** `GET /addresses/{a}` */
export interface AccountInfo {
  address: Address;
  reference?: string;
  publicKey?: PublicKey;
  defaultGroupId?: number;
  flags?: number;
  level: number;
  blocksMinted: number;
  blocksMintedAdjustment: number;
  blocksMintedPenalty: number;
}

/** `GET /blocks/last`, `/blocks/byheight/{h}` (the fields this app reads). */
export interface BlockSummary {
  height: number;
  timestamp: number;
  signature?: string;
  minterAddress?: string;
  onlineAccountsCount?: number;
}

export type ApprovalStatus =
  'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'INVALID';

export type GroupTxType =
  | 'GROUP_INVITE'
  | 'CANCEL_GROUP_INVITE'
  | 'GROUP_KICK'
  | 'GROUP_BAN'
  | 'CANCEL_GROUP_BAN'
  | 'ADD_GROUP_ADMIN'
  | 'REMOVE_GROUP_ADMIN'
  | 'JOIN_GROUP'
  | 'LEAVE_GROUP'
  | 'UPDATE_GROUP'
  | 'GROUP_APPROVAL';

/** Group transaction types that go through group approval in MINTER. */
export const APPROVAL_GATED_TYPES = [
  'GROUP_INVITE',
  'CANCEL_GROUP_INVITE',
  'GROUP_KICK',
  'GROUP_BAN',
  'CANCEL_GROUP_BAN',
  'ADD_GROUP_ADMIN',
  'REMOVE_GROUP_ADMIN',
] as const satisfies readonly GroupTxType[];

/** Any transaction row from `/transactions/*`. Type-specific fields are optional. */
export interface TxRow {
  type: string;
  timestamp: number;
  reference?: string;
  fee?: string;
  signature: Signature;
  txGroupId: number;
  /** Absent while unconfirmed. */
  blockHeight?: number;
  approvalStatus?: ApprovalStatus;
  approvalHeight?: number;
  creatorAddress?: Address;
  /** Target group (absent on some CANCEL_* rows). */
  groupId?: number;
  // GROUP_INVITE
  adminPublicKey?: PublicKey;
  invitee?: Address;
  timeToLive?: number;
  // GROUP_KICK
  member?: Address;
  reason?: string;
  // GROUP_BAN
  offender?: Address;
  // ADD_GROUP_ADMIN / REMOVE_GROUP_ADMIN
  ownerPublicKey?: PublicKey;
  admin?: Address;
  // JOIN_GROUP / LEAVE_GROUP
  joinerPublicKey?: PublicKey;
  leaverPublicKey?: PublicKey;
  // CANCEL_GROUP_BAN
  // (uses `member`)
  // GROUP_APPROVAL
  pendingSignature?: Signature;
  approval?: boolean;
  [key: string]: unknown;
}

/** A row of `/arbitrary/resources/searchsimple`. */
export interface QdnRow {
  name: string;
  service: string;
  identifier: string;
  latestSignature?: string;
  size?: number;
  created: number;
  updated?: number;
}
