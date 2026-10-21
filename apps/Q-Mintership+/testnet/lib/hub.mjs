/**
 * A stand-in for Qortal Hub's qortalRequest, for the private testnet only.
 *
 * It takes the same actions with the same payloads as Hub (checked against
 * Qortal-Hub src/qortal/get.ts and src/background/background.ts), signs with
 * a testnet key and submits to the testnet node:
 *
 *   GET_USER_ACCOUNT, INVITE_TO_GROUP, KICK_FROM_GROUP, BAN_FROM_GROUP,
 *   CANCEL_GROUP_BAN, CANCEL_GROUP_INVITE, ADD_GROUP_ADMIN,
 *   REMOVE_GROUP_ADMIN, JOIN_GROUP, LEAVE_GROUP, SIGN_TRANSACTION,
 *   PUBLISH_QDN_RESOURCE, plus Hub's no-op notices.
 *
 * Encryption is Hub's own (lib/encryption.mjs), with the account's key:
 * PUBLISH_QDN_RESOURCE with `encrypt: true` encrypts its data to
 * `publicKeys` and the publisher before the dialog opens, as Hub does;
 * ENCRYPT_DATA and DECRYPT_DATA answer without a dialog, and DECRYPT_DATA
 * fails with Hub's "Unable to decrypt" when the account isn't a reader.
 *
 * Like Hub, every failure rejects with { error, message } (the same text),
 * a decline with "User declined request", and SIGN_TRANSACTION hides Core's
 * reason behind "Failed to decode transaction". The dialog's answer is a
 * `mode`: accept (default), decline, or decodeError; the dev server adds
 * Hub's 30-second timeout with a late accept on top.
 *
 * Dev-only: never part of the app's build (vite.config.ts never loads it).
 */
import { getJson } from './node.mjs';
import {
  HubLikeError,
  buildWithNode,
  base,
  decodeValid,
  lastReference,
  signAndProcess,
  unitFeeAtomic,
} from './tx.mjs';
import { post } from './node.mjs';
import { decryptDataRequest, encryptDataRequest, hubKeyPair, publishData64 } from './encryption.mjs';

export const HUB_TEXT = {
  declined: 'User declined request',
  decode: 'Failed to decode transaction',
  fetchGroup: 'Failed to fetch group',
  process: 'Unable to process transaction',
  name: 'Name not found',
};

export function hubError(message) {
  return { error: message, message };
}

function missing(data, fields) {
  const absent = fields.filter((f) => !data[f]);
  if (absent.length) throw hubError(`Missing fields: ${absent.join(', ')}`);
}

async function fetchGroup(groupId) {
  try {
    return await getJson(`/groups/${encodeURIComponent(groupId)}`);
  } catch {
    throw hubError(HUB_TEXT.fetchGroup);
  }
}

const isAddress = (value) => typeof value === 'string' && /^Q[1-9A-HJ-NP-Za-km-z]{32,33}$/.test(value);

/** Hub's getNameOrAddress: an address as is, a name to its owner. */
async function nameOrAddress(value) {
  if (isAddress(value)) return value;
  try {
    const name = await getJson(`/names/${encodeURIComponent(value)}`);
    if (name?.owner) return name.owner;
  } catch {
    // fall through
  }
  throw hubError('Cannot find user');
}

async function process(account, unsigned) {
  try {
    return await signAndProcess(account, unsigned);
  } catch (error) {
    throw hubError(error instanceof HubLikeError ? error.message : HUB_TEXT.process);
  }
}

async function groupTx(account, txType, endpoint, fields, txGroupId) {
  let unsigned;
  try {
    unsigned = await buildWithNode(endpoint, { ...(await base(account, txType, txGroupId)), ...fields });
  } catch (error) {
    throw hubError(error instanceof HubLikeError ? error.message : String(error?.message ?? error));
  }
  return process(account, unsigned);
}

const NOTICES = new Set([
  'QDN_RESOURCE_DISPLAYED',
  'NAVIGATION_SUCCESS',
  'OPEN_NEW_TAB',
  'SET_TAB_NOTIFICATIONS',
  'SHOW_ACTIONS',
]);

/** Hub answers these with the account's key and no dialog (`mode` doesn't apply). */
const KEY_ACTIONS = new Set(['ENCRYPT_DATA', 'DECRYPT_DATA']);

/** ENCRYPT_DATA or DECRYPT_DATA as Hub does them (get.ts encryptData, decryptData). */
function keyAction(account, data) {
  const keyPair = hubKeyPair(account.seed);
  try {
    return data.action === 'ENCRYPT_DATA'
      ? encryptDataRequest(data, keyPair)
      : decryptDataRequest(data, keyPair);
  } catch (error) {
    throw hubError(String(error?.message ?? error));
  }
}

/** Actions that open a Hub dialog (the ones `mode` applies to). */
export const DIALOG_ACTIONS = new Set([
  'INVITE_TO_GROUP',
  'KICK_FROM_GROUP',
  'BAN_FROM_GROUP',
  'CANCEL_GROUP_BAN',
  'CANCEL_GROUP_INVITE',
  'ADD_GROUP_ADMIN',
  'REMOVE_GROUP_ADMIN',
  'JOIN_GROUP',
  'LEAVE_GROUP',
  'SIGN_TRANSACTION',
  'PUBLISH_QDN_RESOURCE',
]);

/**
 * Answer one qortalRequest as `account` would in Hub.
 * `mode`: 'accept' | 'decline' | 'decodeError'. `beforeAccept` runs where
 * Hub waits for the user (the dev server uses it for a late accept).
 */
export async function hubRequest(account, request, { mode = 'accept', beforeAccept } = {}) {
  const data = request ?? {};
  const action = data.action;
  if (NOTICES.has(action)) return true;
  if (action === 'GET_USER_ACCOUNT') {
    if (mode === 'decline') throw hubError('Unable to get user account');
    return { address: account.address, publicKey: account.publicKey };
  }
  if (KEY_ACTIONS.has(action)) return keyAction(account, data);
  if (!DIALOG_ACTIONS.has(action)) throw hubError(`The test signer does not do ${action}`);

  // Hub validates and reads before its dialog opens.
  const prepared = await prepare(account, data);
  if (mode === 'decodeError' && action === 'SIGN_TRANSACTION') throw hubError(HUB_TEXT.decode);
  if (beforeAccept) await beforeAccept();
  if (mode === 'decline') throw hubError(HUB_TEXT.declined);
  return prepared();
}

/** Validation and reads Hub does before the dialog; returns the "accepted" step. */
async function prepare(account, data) {
  switch (data.action) {
    case 'INVITE_TO_GROUP': {
      missing(data, ['groupId', 'inviteTime', 'inviteeAddress']);
      await fetchGroup(data.groupId);
      const invitee = await nameOrAddress(data.inviteeAddress);
      return () =>
        groupTx(account, 'GROUP_INVITE', '/groups/invite', {
          adminPublicKey: account.publicKey,
          groupId: data.groupId,
          invitee,
          timeToLive: data.inviteTime,
        }, data.txGroupId || 0);
    }
    case 'KICK_FROM_GROUP':
      missing(data, ['groupId', 'qortalAddress']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'GROUP_KICK', '/groups/kick', {
          adminPublicKey: account.publicKey,
          groupId: data.groupId,
          member: data.qortalAddress,
          reason: data.reason ?? '',
        }, data.txGroupId || 0);
    case 'BAN_FROM_GROUP':
      missing(data, ['groupId', 'qortalAddress']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'GROUP_BAN', '/groups/ban', {
          adminPublicKey: account.publicKey,
          groupId: data.groupId,
          offender: data.qortalAddress,
          reason: data.reason ?? '',
          timeToLive: data.banTime ?? 0,
        }, data.txGroupId || 0);
    case 'CANCEL_GROUP_BAN':
      missing(data, ['groupId', 'qortalAddress']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'CANCEL_GROUP_BAN', '/groups/ban/cancel', {
          adminPublicKey: account.publicKey,
          groupId: data.groupId,
          member: data.qortalAddress,
        }, data.txGroupId || 0);
    case 'CANCEL_GROUP_INVITE':
      missing(data, ['groupId', 'qortalAddress']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'CANCEL_GROUP_INVITE', '/groups/invite/cancel', {
          adminPublicKey: account.publicKey,
          groupId: data.groupId,
          invitee: data.qortalAddress,
        }, data.txGroupId || 0);
    case 'ADD_GROUP_ADMIN':
      missing(data, ['groupId', 'qortalAddress']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'ADD_GROUP_ADMIN', '/groups/addadmin', {
          ownerPublicKey: account.publicKey,
          groupId: data.groupId,
          member: data.qortalAddress,
        }, data.txGroupId || 0);
    case 'REMOVE_GROUP_ADMIN':
      missing(data, ['groupId', 'qortalAddress']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'REMOVE_GROUP_ADMIN', '/groups/removeadmin', {
          ownerPublicKey: account.publicKey,
          groupId: data.groupId,
          admin: data.qortalAddress,
        }, data.txGroupId || 0);
    case 'JOIN_GROUP':
      missing(data, ['groupId']);
      await fetchGroup(data.groupId);
      await lastReference(account.address).catch((e) => {
        throw hubError(e.message);
      });
      return () =>
        groupTx(account, 'JOIN_GROUP', '/groups/join', {
          joinerPublicKey: account.publicKey,
          groupId: data.groupId,
        }, 0);
    case 'LEAVE_GROUP':
      missing(data, ['groupId']);
      await fetchGroup(data.groupId);
      return () =>
        groupTx(account, 'LEAVE_GROUP', '/groups/leave', {
          leaverPublicKey: account.publicKey,
          groupId: data.groupId,
        }, 0);
    case 'SIGN_TRANSACTION': {
      missing(data, ['unsignedBytes']);
      // Hub: decode with Core's validity checks; any failure is the generic text.
      const decoded = await decodeValid(data.unsignedBytes).catch(() => null);
      if (!decoded) throw hubError(HUB_TEXT.decode);
      // Without process, Hub returns the signed Base58 and submits nothing.
      if (!data.process) return () => signAndProcess(account, data.unsignedBytes, { process: false });
      return () => process(account, data.unsignedBytes);
    }
    case 'PUBLISH_QDN_RESOURCE': {
      missing(data, ['service']);
      if (!data.data64 && !data.base64) throw hubError('No data or file was submitted');
      if (!data.name) throw hubError('Missing fields: name');
      const name = await getJson(`/names/${encodeURIComponent(data.name)}`).catch(() => null);
      if (!name) throw hubError(HUB_TEXT.name);
      if (name.owner !== account.address) throw hubError('You do not own this name');
      // Hub encrypts (encrypt: true) before its dialog opens, with the publisher's key.
      let data64;
      try {
        data64 = publishData64(data, hubKeyPair(account.seed));
      } catch (error) {
        throw hubError(String(error?.message ?? error));
      }
      return async () => {
        const fee = await unitFeeAtomic('ARBITRARY');
        const identifier = data.identifier ? `/${encodeURIComponent(data.identifier)}` : '';
        const res = await post(
          `/arbitrary/${encodeURIComponent(data.service)}/${encodeURIComponent(data.name)}${identifier}/base64?fee=${fee}`,
          data64,
          { contentType: 'text/plain' }
        );
        if (res.status !== 200 || !res.text || res.json?.error) {
          throw hubError(res.json?.message || 'Error when uploading');
        }
        return process(account, res.text.trim());
      };
    }
    default:
      throw hubError(`The test signer does not do ${data.action}`);
  }
}
