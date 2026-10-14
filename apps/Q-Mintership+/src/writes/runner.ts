/**
 * Sends one write through Hub, safely:
 *
 * 1. Re-reads the state the write depends on (balance for the fee, Core's
 *    25-unconfirmed limit, and the write's own guard), because Hub hides
 *    Core's reason when SIGN_TRANSACTION fails validation.
 * 2. Sends the request. A decline is a cancel, not an error.
 * 3. On Hub's 30-second timeout it does NOT offer Retry straight away: Hub
 *    keeps its dialog up for 60 s and still applies a late Accept, so the
 *    runner looks for the transaction (unconfirmed, then confirmed) for about
 *    a minute. Only when nothing turns up does it say the outcome is unknown.
 *
 * Only the actions in hubActions.ts can be sent; anything else is refused.
 */
import { qortal } from '../qortal/client';
import { getBalance, getFee } from '../data/accounts';
import { MAX_UNCONFIRMED_PER_ACCOUNT } from '../data/constants';
import { getJson, query } from '../data/core';
import { getUnconfirmedBy, withCancelInviteTargets } from '../data/txs';
import type { GroupTxType, TxRow } from '../data/types';
import { errorMessage, isHubDecline, isHubTimeout } from '../utils/hubErrors';
import { TX_TYPE_OF_ACTION, WRITE_ACTIONS, type HubRequest } from './hubActions';

export interface Signer {
  address: string;
  publicKey: string;
}

export type WriteOutcome =
  | { status: 'sent'; tx: TxRow | null; signature: string | null; recovered: boolean }
  | { status: 'declined' }
  | { status: 'blocked'; reason: string }
  | { status: 'unknown'; message: string }
  | { status: 'failed'; message: string };

export interface WriteSpec {
  /** The request, or a builder for requests that need fresh data (approval bytes). */
  request: HubRequest | (() => Promise<HubRequest>);
  signer: Signer;
  /** The write's own guard: a reason in plain words to stop, or null to go ahead. */
  precheck?: () => Promise<string | null>;
  /** Recognises this write's transaction when looking for it after a timeout. */
  match: (tx: TxRow) => boolean;
  /** Skip the fee balance check (never for chain writes; QDN publishes check it too). */
  skipBalanceCheck?: boolean;
  /** Called as the runner moves on, for the UI's step list. */
  onStage?: (stage: WriteStage) => void;
}

export type WriteStage = 'checking' | 'waitingForHub' | 'lookingUp' | 'done';

/** Pauses between lookups after a timeout (ms): about a minute in total. */
let lookupDelays = [3_000, 6_000, 10_000, 15_000, 25_000];

/** Tests shorten the lookup pauses. */
export function setLookupDelays(delays: number[]): void {
  lookupDelays = delays;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Balance and the unconfirmed limit, before Hub is asked anything. */
export async function commonPrecheck(
  signer: Signer,
  txType: GroupTxType | 'ARBITRARY',
  skipBalance = false
): Promise<string | null> {
  if (!signer.address || !signer.publicKey) return 'Sign in to Hub first.';
  if (!skipBalance) {
    const [fee, balance] = await Promise.all([
      getFee(txType),
      getBalance(signer.address, { force: true }),
    ]);
    if (balance < fee.qort) {
      return `This needs ${fee.qort} QORT for the fee and your confirmed balance is ${balance} QORT.`;
    }
  }
  const unconfirmed = await getUnconfirmedBy(signer.publicKey);
  if (unconfirmed.length >= MAX_UNCONFIRMED_PER_ACCOUNT) {
    return `You already have ${unconfirmed.length} transactions waiting for a block. Core takes at most ${MAX_UNCONFIRMED_PER_ACCOUNT}; try again in a few minutes.`;
  }
  return null;
}

/** Signatures this session's writes already returned: a later lookup never takes them again. */
const claimed = new Set<string>();

/** Tests start each world with nothing claimed. */
export function resetClaimedSignatures(): void {
  claimed.clear();
}

function claim(outcome: WriteOutcome): WriteOutcome {
  if (outcome.status === 'sent' && outcome.signature) claimed.add(outcome.signature);
  return outcome;
}

/**
 * Look for the write's transaction after a timeout: the mempool, then recent
 * confirmed ones. Only transactions made after this write started, and not
 * already returned by an earlier write, can be it. Cancelled invites get
 * their group and invitee from the raw bytes first, so `match` can check them.
 */
async function findSent(
  spec: WriteSpec,
  txType: GroupTxType | 'ARBITRARY',
  since: number
): Promise<TxRow | null> {
  const candidates = async (rows: TxRow[]) =>
    withCancelInviteTargets(
      rows.filter((tx) => tx.timestamp >= since && !claimed.has(tx.signature))
    );
  if (txType !== 'ARBITRARY') {
    const unconfirmed = await getUnconfirmedBy(spec.signer.publicKey, txType).catch(
      () => [] as TxRow[]
    );
    const hit = (await candidates(unconfirmed)).find(spec.match);
    if (hit) return hit;
  }
  const confirmed = await getJson<TxRow[]>(
    `/transactions/search?${query({
      address: spec.signer.address,
      txType,
      confirmationStatus: 'CONFIRMED',
      limit: 10,
      reverse: true,
    })}`
  ).catch(() => [] as TxRow[]);
  return (await candidates(Array.isArray(confirmed) ? confirmed : [])).find(spec.match) ?? null;
}

export async function runWrite(spec: WriteSpec): Promise<WriteOutcome> {
  return claim(await sendWrite(spec));
}

async function sendWrite(spec: WriteSpec): Promise<WriteOutcome> {
  spec.onStage?.('checking');
  let request: HubRequest;
  // Set before the request is built: approval bytes carry their own timestamp.
  let startedAt = Date.now();
  try {
    const probe = typeof spec.request === 'function' ? null : spec.request;
    const action = probe?.action;
    if (action && !WRITE_ACTIONS.has(action))
      return { status: 'blocked', reason: `Unknown action ${action}` };
    const txType = action ? TX_TYPE_OF_ACTION[action] : 'GROUP_APPROVAL';
    const common = await commonPrecheck(spec.signer, txType, spec.skipBalanceCheck);
    if (common) return { status: 'blocked', reason: common };
    const own = spec.precheck ? await spec.precheck() : null;
    if (own) return { status: 'blocked', reason: own };
    startedAt = Date.now();
    request = typeof spec.request === 'function' ? await spec.request() : spec.request;
  } catch (error) {
    return {
      status: 'failed',
      message: errorMessage(error, 'Could not check the current state. Try again.'),
    };
  }
  if (!WRITE_ACTIONS.has(request.action))
    return { status: 'blocked', reason: `Unknown action ${request.action}` };
  const txType = TX_TYPE_OF_ACTION[request.action];

  spec.onStage?.('waitingForHub');
  try {
    const result = await qortal<TxRow | string | null>(request);
    spec.onStage?.('done');
    const tx = result && typeof result === 'object' ? (result as TxRow) : null;
    return { status: 'sent', tx, signature: tx?.signature ?? null, recovered: false };
  } catch (error) {
    if (isHubDecline(error)) return { status: 'declined' };
    if (!isHubTimeout(error)) {
      return { status: 'failed', message: errorMessage(error, 'Hub could not send it.') };
    }
  }

  spec.onStage?.('lookingUp');
  for (const delay of lookupDelays) {
    await sleep(delay);
    const found = await findSent(spec, txType, startedAt);
    if (found) {
      spec.onStage?.('done');
      return { status: 'sent', tx: found, signature: found.signature, recovered: true };
    }
  }
  return {
    status: 'unknown',
    message:
      "Hub stopped waiting before it answered, and the transaction hasn't shown up yet. It may still arrive: check again in a minute before trying again.",
  };
}
