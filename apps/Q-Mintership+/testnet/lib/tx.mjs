/**
 * Transactions on the private testnet, made the way Qortal Hub makes them
 * (Qortal-Hub src/background/background.ts and src/qortal/get.ts):
 *
 * - reference from GET /addresses/lastreference/{address};
 * - fee from GET /transactions/unitfee?txType=…;
 * - the unsigned bytes (here from the testnet node's own builders, which
 *   give the same fields Hub's JS builders write);
 * - POST /transactions/convert for the bytes to sign, an Ed25519 signature
 *   appended to the unsigned bytes, POST /transactions/process?apiVersion=2.
 *
 * Dev-only: never imported by the app, and every write goes through
 * node.mjs, which refuses a node that isn't a testnet.
 */
import { getJson, getText, post } from './node.mjs';
import { base58Decode, base58Encode, sign } from './keys.mjs';

export class HubLikeError extends Error {}

export async function unitFeeAtomic(txType) {
  return Number(await getText(`/transactions/unitfee?txType=${txType}&timestamp=${Date.now()}`));
}

export async function unitFeeQort(txType) {
  return ((await unitFeeAtomic(txType)) / 1e8).toFixed(8);
}

/** Hub's getLastRef: throws "0 QORT in your balance" when the node has none. */
export async function lastReference(address) {
  try {
    const text = await getText(`/addresses/lastreference/${address}`);
    if (text && text.length > 40) return text;
  } catch {
    // fall through
  }
  throw new HubLikeError('0 QORT in your balance');
}

/** Unsigned Base58 bytes from one of the node's builders (POST /groups/invite, …). */
export async function buildWithNode(endpoint, json) {
  const res = await post(endpoint, JSON.stringify(json));
  if (res.status !== 200 || !res.text || res.json?.error) {
    throw new HubLikeError(res.json?.message || `Could not build ${endpoint}: ${res.status} ${res.text}`);
  }
  return res.text.trim();
}

/** Hub's SIGN_TRANSACTION decode step: Core's validity checks included. */
export async function decodeValid(unsignedBase58) {
  const res = await post('/transactions/decode?ignoreValidityChecks=false', unsignedBase58);
  return res.status === 200 && res.json && !res.json.error ? res.json : null;
}

/** Sign Hub's way and, unless `process` is false, submit. Returns Core's answer. */
export async function signAndProcess(account, unsignedBase58, { process = true } = {}) {
  const converted = await post('/transactions/convert', unsignedBase58);
  if (converted.status !== 200 || converted.json?.error) {
    throw new HubLikeError(converted.json?.message || 'Error when signing');
  }
  const forSigning = base58Decode(converted.text.trim());
  const signature = sign(account.seed, forSigning);
  const signed = base58Encode(Buffer.concat([Buffer.from(base58Decode(unsignedBase58)), signature]));
  if (!process) return signed;
  const res = await post('/transactions/process?apiVersion=2', signed, { write: true });
  const answer = res.json ?? res.text;
  if (!answer || typeof answer !== 'object' || !answer.signature) {
    throw new HubLikeError(answer?.message || 'unable to process transaction');
  }
  return answer;
}

/** The common fields every builder takes. */
export async function base(account, txType, txGroupId = 0) {
  return {
    timestamp: Date.now(),
    reference: await lastReference(account.address),
    fee: await unitFeeQort(txType),
    txGroupId,
  };
}

const BUILDERS = {
  GROUP_INVITE: '/groups/invite',
  CANCEL_GROUP_INVITE: '/groups/invite/cancel',
  GROUP_KICK: '/groups/kick',
  GROUP_BAN: '/groups/ban',
  CANCEL_GROUP_BAN: '/groups/ban/cancel',
  ADD_GROUP_ADMIN: '/groups/addadmin',
  REMOVE_GROUP_ADMIN: '/groups/removeadmin',
  JOIN_GROUP: '/groups/join',
  LEAVE_GROUP: '/groups/leave',
  CREATE_GROUP: '/groups/create',
  UPDATE_GROUP: '/groups/update',
  GROUP_APPROVAL: '/groups/approval',
  PAYMENT: '/payments/pay',
  REGISTER_NAME: '/names/register',
};

/** Build, sign and submit one transaction of `txType` with its own fields. */
export async function send(account, txType, fields, { txGroupId = 0 } = {}) {
  const endpoint = BUILDERS[txType];
  if (!endpoint) throw new Error(`No builder for ${txType}`);
  const unsigned = await buildWithNode(endpoint, { ...(await base(account, txType, txGroupId)), ...fields });
  return signAndProcess(account, unsigned);
}

export async function getTx(signature) {
  return getJson(`/transactions/signature/${encodeURIComponent(signature)}`);
}
