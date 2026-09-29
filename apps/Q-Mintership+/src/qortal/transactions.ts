/**
 * Group transactions (legacy QortalApi.js "Qortal Transaction-related calls").
 * Every builder POSTs the same payload the original did to Core, gets the raw
 * unsigned bytes back, and the caller signs them with SIGN_TRANSACTION and
 * submits with /transactions/process. Payload field names and defaults are
 * part of the data contract; keep them exact.
 */
import { coreJson, corePostJsonForText, coreUrl, qortal } from './client';
import { DEFAULT_TX_FEE, MINTER_GROUP_ID } from './constants';
import { getAddressFromPublicKey, getAddressInfo } from './account';

export interface ProcessedTransaction {
  type?: string;
  signature?: string;
  approvalStatus?: string;
  [key: string]: unknown;
}

/** POST the signed bytes to `/transactions/process` (API version 2). Parsed JSON, or raw text if not JSON. */
export async function processTransaction(
  signedTransaction: string
): Promise<ProcessedTransaction | string> {
  const response = await fetch(coreUrl('/transactions/process'), {
    method: 'POST',
    headers: { Accept: 'text/plain', 'X-API-VERSION': '2', 'Content-Type': 'text/plain' },
    body: signedTransaction,
  });
  if (!response.ok) {
    throw new Error(`Transaction processing failed: ${await response.text()}`);
  }
  const contentType = response.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as ProcessedTransaction;
  }
  const raw = await response.text();
  try {
    return JSON.parse(raw) as ProcessedTransaction;
  } catch {
    return raw;
  }
}

/** SIGN_TRANSACTION through Hub; throws when the user cancels (Hub returns null). */
export async function signTransaction(unsignedBytes: string): Promise<string> {
  const signed = await qortal<string | null>({ action: 'SIGN_TRANSACTION', unsignedBytes });
  if (!signed) throw new Error('SIGN_TRANSACTION returned null. Possibly user canceled or an older UI?');
  return signed;
}

export async function signAndProcess(unsignedBytes: string): Promise<ProcessedTransaction | string> {
  return processTransaction(await signTransaction(unsignedBytes));
}

async function referenceForAddress(address: string): Promise<string> {
  const info = await getAddressInfo(address);
  if (!info?.reference) throw new Error(`No account reference for ${address}`);
  return info.reference;
}

async function referenceForPublicKey(publicKey: string): Promise<string> {
  const address = await getAddressFromPublicKey(publicKey);
  if (!address) throw new Error('Could not resolve the address of the public key');
  return referenceForAddress(address);
}

export interface GroupInviteParams {
  /** The account whose reference the tx uses (the admin sending the invite). */
  recipientAddress: string;
  adminPublicKey: string;
  groupId?: number;
  /** Defaults to recipientAddress, as the original did. */
  invitee?: string;
  /** Seconds the invite stays open; 0 in the legacy caller. */
  timeToLive?: number;
  txGroupId?: number;
  fee: number;
}

/** `/groups/invite` raw tx. */
export async function createGroupInviteTransaction(params: GroupInviteParams): Promise<string> {
  const reference = await referenceForAddress(params.recipientAddress);
  if (!params.adminPublicKey || !reference) {
    throw new Error('Missing required parameters for group invite transaction.');
  }
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee,
    txGroupId: params.txGroupId || 0,
    recipient: null,
    adminPublicKey: params.adminPublicKey,
    groupId: params.groupId ?? MINTER_GROUP_ID,
    invitee: params.invitee || params.recipientAddress,
    timeToLive: params.timeToLive ?? 0,
  };
  return corePostJsonForText('/groups/invite', payload);
}

export interface GroupKickParams {
  adminPublicKey: string;
  groupId?: number;
  member: string;
  reason?: string;
  txGroupId?: number;
  fee?: number;
}

/** `/groups/kick` raw tx (defaults: MINTER group, txGroupId 694, fee 0.01). */
export async function createGroupKickTransaction(params: GroupKickParams): Promise<string> {
  const reference = await referenceForPublicKey(params.adminPublicKey);
  if (!params.adminPublicKey || !reference || !params.member) {
    throw new Error('Missing required parameters for group kick transaction.');
  }
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee ?? DEFAULT_TX_FEE,
    txGroupId: params.txGroupId ?? MINTER_GROUP_ID,
    adminPublicKey: params.adminPublicKey,
    groupId: params.groupId ?? MINTER_GROUP_ID,
    member: params.member,
    reason: params.reason ?? 'Kicked by admins',
  };
  return corePostJsonForText('/groups/kick', payload);
}

export interface GroupBanParams {
  adminPublicKey: string;
  groupId?: number;
  offender: string;
  reason?: string;
  txGroupId?: number;
  fee: number;
}

/** `/groups/ban` raw tx. */
export async function createGroupBanTransaction(params: GroupBanParams): Promise<string> {
  const reference = await referenceForPublicKey(params.adminPublicKey);
  if (!params.adminPublicKey || !reference || !params.offender) {
    throw new Error('Missing required parameters for group ban transaction.');
  }
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee,
    txGroupId: params.txGroupId,
    adminPublicKey: params.adminPublicKey,
    groupId: params.groupId ?? MINTER_GROUP_ID,
    offender: params.offender,
    reason: params.reason ?? 'Banned by admins',
  };
  return corePostJsonForText('/groups/ban', payload);
}

export interface GroupAdminChangeParams {
  /**
   * The tx creator's public key. For a MINTER group change this is the
   * proposing admin and txGroupId must be set (the tx then needs approval).
   * When omitted, `userAddress` supplies the key and reference.
   */
  ownerPublicKey?: string;
  userAddress?: string;
  groupId?: number;
  txGroupId?: number;
  fee: number;
}

async function creatorKeyAndReference(
  params: GroupAdminChangeParams
): Promise<{ ownerPublicKey: string; reference: string }> {
  if (params.ownerPublicKey) {
    return {
      ownerPublicKey: params.ownerPublicKey,
      reference: await referenceForPublicKey(params.ownerPublicKey),
    };
  }
  if (!params.userAddress) throw new Error('ownerPublicKey or userAddress is required');
  const info = await getAddressInfo(params.userAddress);
  if (!info?.publicKey || !info.reference) {
    throw new Error('Missing required parameters for group invite transaction.');
  }
  return { ownerPublicKey: info.publicKey, reference: info.reference };
}

/** `/groups/addadmin` raw tx. */
export async function createAddGroupAdminTransaction(
  params: GroupAdminChangeParams & { member: string }
): Promise<string> {
  const { ownerPublicKey, reference } = await creatorKeyAndReference(params);
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee,
    txGroupId: params.txGroupId,
    ownerPublicKey,
    groupId: params.groupId ?? MINTER_GROUP_ID,
    member: params.member,
  };
  return corePostJsonForText('/groups/addadmin', payload);
}

/**
 * `/groups/removeadmin` raw tx. (The legacy version forgot to await
 * getAddressInfo on the no-key path, so that path never worked; it is fixed here.)
 */
export async function createRemoveGroupAdminTransaction(
  params: GroupAdminChangeParams & { admin: string }
): Promise<string> {
  const { ownerPublicKey, reference } = await creatorKeyAndReference(params);
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee,
    txGroupId: params.txGroupId,
    ownerPublicKey,
    groupId: params.groupId ?? MINTER_GROUP_ID,
    admin: params.admin,
  };
  return corePostJsonForText('/groups/removeadmin', payload);
}

export interface GroupApprovalParams {
  adminPublicKey: string;
  pendingSignature: string;
  txGroupId?: number;
  fee?: number;
}

/** `/groups/approval` raw tx: approve a pending group tx (approval: true always). */
export async function createGroupApprovalTransaction(params: GroupApprovalParams): Promise<string> {
  const reference = await referenceForPublicKey(params.adminPublicKey);
  if (!params.adminPublicKey || !reference) {
    throw new Error('Missing required parameters for transaction.');
  }
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee ?? DEFAULT_TX_FEE,
    txGroupId: params.txGroupId ?? 0,
    adminPublicKey: params.adminPublicKey,
    pendingSignature: params.pendingSignature,
    approval: true,
  };
  return corePostJsonForText('/groups/approval', payload);
}

export interface GroupJoinParams {
  recipientAddress: string;
  joinerPublicKey: string;
  groupId: number;
  txGroupId?: number;
  fee: number;
}

/** `/groups/join` raw tx. */
export async function createGroupJoinTransaction(params: GroupJoinParams): Promise<string> {
  const reference = await referenceForAddress(params.recipientAddress);
  if (!reference || !params.recipientAddress) {
    throw new Error('Missing required parameters for group invite transaction.');
  }
  const payload = {
    timestamp: Date.now(),
    reference,
    fee: params.fee,
    txGroupId: params.txGroupId ?? 0,
    joinerPublicKey: params.joinerPublicKey,
    groupId: params.groupId,
  };
  return corePostJsonForText('/groups/join', payload);
}

/** JOIN_GROUP through Hub (the nominee joining MINTER, or the notification group). */
export async function joinGroup(groupId: number): Promise<unknown> {
  return qortal({ action: 'JOIN_GROUP', groupId });
}

export interface BlockInfo {
  signature: string;
  version: number;
  reference: string;
  transactionCount: number;
  totalFees: string;
  transactionsSignature: string;
  height: number;
  timestamp: number;
  minterPublicKey: string;
  minterSignature: string;
  atCount: number;
  atFees: string;
  encodedOnlineAccounts: string;
  onlineAccountsCount: number;
  minterAddress: string;
  minterLevel: number;
}

/** `/blocks/last`, normalised; null on failure. */
export async function getLatestBlockInfo(): Promise<BlockInfo | null> {
  try {
    const b = await coreJson<Partial<BlockInfo>>('/blocks/last');
    return {
      signature: b.signature || '',
      version: b.version || 0,
      reference: b.reference || '',
      transactionCount: b.transactionCount || 0,
      totalFees: b.totalFees || '0',
      transactionsSignature: b.transactionsSignature || '',
      height: b.height || 0,
      timestamp: b.timestamp || 0,
      minterPublicKey: b.minterPublicKey || '',
      minterSignature: b.minterSignature || '',
      atCount: b.atCount || 0,
      atFees: b.atFees || '0',
      encodedOnlineAccounts: b.encodedOnlineAccounts || '',
      onlineAccountsCount: b.onlineAccountsCount || 0,
      minterAddress: b.minterAddress || '',
      minterLevel: b.minterLevel || 0,
    };
  } catch {
    return null;
  }
}

export interface TransactionSearchParams {
  txTypes?: string[];
  address?: string;
  confirmationStatus?: 'CONFIRMED' | 'UNCONFIRMED' | 'BOTH' | '';
  limit?: number;
  reverse?: boolean;
  offset?: number;
  startBlock?: number;
  blockLimit?: number;
  txGroupId?: number;
}

export interface QortalTransaction {
  type: string;
  timestamp: number;
  reference: string;
  signature: string;
  fee?: string;
  txGroupId?: number;
  approvalStatus?: string;
  blockHeight?: number;
  [key: string]: unknown;
}

/** `/transactions/search` with the legacy query builder. Throws on failure. */
export async function searchTransactions(
  params: TransactionSearchParams = {}
): Promise<QortalTransaction[]> {
  const {
    txTypes = [],
    address,
    confirmationStatus = 'CONFIRMED',
    limit = 20,
    reverse = true,
    offset = 0,
    startBlock = 0,
    blockLimit = 0,
    txGroupId = 0,
  } = params;
  const query: string[] = [];
  txTypes.forEach((type) => query.push(`txType=${encodeURIComponent(type)}`));
  if (startBlock) query.push(`startBlock=${encodeURIComponent(startBlock)}`);
  if (blockLimit) query.push(`blockLimit=${encodeURIComponent(blockLimit)}`);
  if (txGroupId) query.push(`txGroupId=${encodeURIComponent(txGroupId)}`);
  if (address) query.push(`address=${encodeURIComponent(address)}`);
  if (confirmationStatus) query.push(`confirmationStatus=${encodeURIComponent(confirmationStatus)}`);
  if (limit !== undefined) query.push(`limit=${limit}`);
  if (reverse !== undefined) query.push(`reverse=${reverse}`);
  if (offset) query.push(`offset=${offset}`);
  const path = `/transactions/search?${query.join('&')}`;
  const response = await fetch(coreUrl(path), { method: 'GET', headers: { Accept: '*/*' } });
  if (!response.ok) {
    throw new Error(`Failed to search transactions: HTTP ${response.status}, ${await response.text()}`);
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) throw new Error('Expected an array of transactions, but got something else.');
  return data as QortalTransaction[];
}

/** `/transactions/pending`. Throws on failure. */
export async function searchPendingTransactions(
  limit = 20,
  offset = 0,
  reverse = false
): Promise<QortalTransaction[]> {
  const path = `/transactions/pending?limit=${limit}&offset=${offset}&reverse=${reverse}`;
  const response = await fetch(coreUrl(path), { method: 'GET', headers: { Accept: '*/*' } });
  if (!response.ok) {
    throw new Error(`Failed to search pending transactions: HTTP ${response.status}, ${await response.text()}`);
  }
  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Expected an array for pending transactions, but got something else.');
  }
  return data as QortalTransaction[];
}
