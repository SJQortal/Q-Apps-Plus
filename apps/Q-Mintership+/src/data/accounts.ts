/**
 * Accounts, names, balances and fees. All public reads, cached per address.
 */
import { CoreHttpError } from '../qortal/client';
import { ATOMIC_PER_QORT, FALLBACK_FEE_ATOMIC } from './constants';
import { getJson, getText, query, seg } from './core';
import { fetchQuery, peekQuery, setQueryData } from './query';
import type { AccountInfo, GroupTxType } from './types';

const QORTAL_ADDRESS_RE = /^Q[1-9A-HJ-NP-Za-km-z]{33}$/;

/** A syntactically valid Qortal address (34 base58 characters starting with Q). */
export function isAddress(value: unknown): value is string {
  return typeof value === 'string' && QORTAL_ADDRESS_RE.test(value);
}

/** `GET /addresses/{a}`: level, blocks minted, public key. */
export function getAccount(
  address: string,
  options: { force?: boolean; ttlMs?: number } = {}
): Promise<AccountInfo> {
  return fetchQuery(
    `account:${address}`,
    async () => {
      const body = await getJson<Record<string, unknown>>(`/addresses/${seg(address)}`);
      return {
        address: String(body.address ?? address),
        reference: typeof body.reference === 'string' ? body.reference : undefined,
        publicKey: typeof body.publicKey === 'string' ? body.publicKey : undefined,
        defaultGroupId: Number(body.defaultGroupId ?? 0),
        flags: Number(body.flags ?? 0),
        level: Number(body.level ?? 0),
        blocksMinted: Number(body.blocksMinted ?? 0),
        blocksMintedAdjustment: Number(body.blocksMintedAdjustment ?? 0),
        blocksMintedPenalty: Number(body.blocksMintedPenalty ?? 0),
      };
    },
    { ttlMs: options.ttlMs ?? 2 * 60_000, force: options.force }
  );
}

/** `GET /names/primary/{a}`: the primary name, or null for an account without one. */
export function getPrimaryName(address: string): Promise<string | null> {
  return fetchQuery(
    `name:${address}`,
    async () => {
      const body = await getJson<{ name?: string }>(`/names/primary/${seg(address)}`);
      return typeof body?.name === 'string' && body.name ? body.name : null;
    },
    { ttlMs: 30 * 60_000 }
  );
}

/**
 * Whether the account has registered a name (Simon, 2026-10-17: an account
 * without one can't be nominated): its primary name, else one row of its
 * names (`/names/address/{a}?limit=1`). Key `hasname:<address>`.
 */
export function hasRegisteredName(
  address: string,
  options: { force?: boolean } = {}
): Promise<boolean> {
  return fetchQuery(
    `hasname:${address}`,
    async () => {
      if (await getPrimaryName(address).catch(() => null)) return true;
      const rows = await getJson<unknown[]>(
        `/names/address/${seg(address)}?${query({ limit: 1, offset: 0 })}`
      );
      return Array.isArray(rows) && rows.length > 0;
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** Seed the name cache from a list that already carries names (e.g. `/groups/members`). */
export function primeNames(rows: Array<{ address: string; name?: string | null }>): void {
  for (const row of rows) {
    if (row.name && peekQuery(`name:${row.address}`) === undefined)
      setQueryData(`name:${row.address}`, row.name);
  }
}

/** Core's answer for a name nobody has registered (`404 {"error":401,"message":"name unknown"}`). */
export function isUnknownName(error: unknown): boolean {
  return (
    error instanceof CoreHttpError &&
    (error.status === 404 || /"error"\s*:\s*401|name unknown/i.test(error.body))
  );
}

/**
 * `GET /names/{name}`: the owner's address, or null when the name doesn't
 * exist. Any other failure (the node unreachable, a 5xx) is thrown, so it
 * is never cached as "no such name".
 */
export function getNameOwner(name: string): Promise<string | null> {
  return fetchQuery(
    `nameowner:${name}`,
    async () => {
      try {
        const body = await getJson<{ owner?: string }>(`/names/${seg(name)}`);
        return isAddress(body?.owner) ? body.owner : null;
      } catch (error) {
        if (isUnknownName(error)) return null;
        throw error;
      }
    },
    { ttlMs: 30 * 60_000 }
  );
}

/** Confirmed QORT balance (`GET /addresses/balance/{a}`), as a number of QORT. */
export function getBalance(address: string, options: { force?: boolean } = {}): Promise<number> {
  return fetchQuery(
    `balance:${address}`,
    async () => {
      const text = (await getText(`/addresses/balance/${seg(address)}`)).trim();
      const value = Number(text);
      if (!Number.isFinite(value)) throw new Error(`Unexpected balance "${text}"`);
      return value;
    },
    { ttlMs: 30_000, force: options.force }
  );
}

/** `GET /addresses/lastreference/{a}`: the reference a new transaction from this account uses. */
export async function getLastReference(address: string): Promise<string> {
  const text = (await getText(`/addresses/lastreference/${seg(address)}`)).trim();
  if (!text) throw new Error('This account has no transactions yet, so it cannot sign.');
  return text;
}

export interface Fee {
  atomic: number;
  qort: number;
  /** True when Core's answer could not be read and 0.01 QORT is assumed. */
  estimated: boolean;
}

/** `GET /transactions/unitfee?txType=…` (0.01 QORT for every group transaction today). */
export function getFee(txType: GroupTxType | 'ARBITRARY'): Promise<Fee> {
  return fetchQuery(
    `fee:${txType}`,
    async () => {
      try {
        const atomic = Number((await getText(`/transactions/unitfee?${query({ txType })}`)).trim());
        if (!Number.isSafeInteger(atomic) || atomic <= 0) throw new Error('bad fee');
        return { atomic, qort: atomic / ATOMIC_PER_QORT, estimated: false };
      } catch {
        return {
          atomic: FALLBACK_FEE_ATOMIC,
          qort: FALLBACK_FEE_ATOMIC / ATOMIC_PER_QORT,
          estimated: true,
        };
      }
    },
    { ttlMs: 30 * 60_000 }
  );
}

/** "0.01 QORT". */
export function formatQort(qort: number): string {
  const fixed = qort.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  return `${fixed} QORT`;
}

/** The avatar every Qortal app uses; load it lazily (NameAvatar). */
export function avatarUrl(name: string): string {
  return `/arbitrary/THUMBNAIL/${seg(name)}/qortal_avatar?async=true`;
}

export { effectiveBlocksMinted, levelProgress, type LevelProgress } from '../rules/levels';
