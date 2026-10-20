/**
 * The Explorer's reads about one account: whether it exists, every name it
 * owns, the groups it is in, whether it mints now, where its first QORT came
 * from, how busy a payer it is, and the recipient of a minting-level move.
 * All GET, cached per address under keys starting with `x` (the store counts
 * loads by the part before the first colon).
 */
import { CoreHttpError } from '../../qortal/client';
import { base58Decode, base58Encode } from '../../qortal/base58';
import { getAccount, getPrimaryName, isAddress } from '../accounts';
import { MINTER_GROUP_ID } from '../constants';
import { getJson, getText, query, seg } from '../core';
import { fetchQuery, peekQuery, setQueryData } from '../query';
import type { AccountInfo, TxRow } from '../types';
import type { LevelLineage, LevelSource, MintingStart } from '../../rules/explorer/onlineShare';

const AT_ADDRESS_RE = /^A[1-9A-HJ-NP-Za-km-z]{33}$/;
const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{86,90}$/;

/** An AT (automated contract) address: 34 base58 characters starting with A. */
export function isAtAddress(value: unknown): value is string {
  return typeof value === 'string' && AT_ADDRESS_RE.test(value);
}

/** Looks like a transaction signature (64 bytes in base58). */
export function isSignature(value: unknown): value is string {
  return typeof value === 'string' && SIGNATURE_RE.test(value);
}

/** Core's answer for a valid address it has never seen (`404 {"error":124}`). */
export function isUnknownAccount(error: unknown): boolean {
  return (
    error instanceof CoreHttpError &&
    error.status === 404 &&
    /"error"\s*:\s*124|account address unknown/i.test(error.body)
  );
}

/** Core's answer for a bad checksum (`400 {"error":102}`). */
export function isInvalidAddressError(error: unknown): boolean {
  return error instanceof CoreHttpError && /"error"\s*:\s*102|invalid address/i.test(error.body);
}

export type ExploredAccount =
  | { kind: 'account'; account: AccountInfo }
  /** A valid address Core has never seen: no transaction ever involved it. */
  | { kind: 'unused'; address: string };

/**
 * `GET /addresses/{a}`, telling "never used" apart from a failure. Primes
 * `account:<a>`, so the Minter Profile and the hooks share the read.
 */
export function exploreAccount(
  address: string,
  options: { force?: boolean } = {}
): Promise<ExploredAccount> {
  return fetchQuery(
    `xacct:${address}`,
    async () => {
      try {
        const account = await getAccount(address, { force: options.force });
        return { kind: 'account', account } as const;
      } catch (error) {
        if (isUnknownAccount(error)) return { kind: 'unused', address } as const;
        throw error;
      }
    },
    { ttlMs: 2 * 60_000, force: options.force }
  );
}

// ---- Names ------------------------------------------------------------------

export interface NamesOf {
  /** Every name the account owns, in Core's order (when each was first registered). */
  names: string[];
  /** True when 5 pages (500 names) were read and Core had more. */
  truncated: boolean;
}

const NAME_PAGES = 5;

/** `GET /names/address/{a}`, 100 a page, at most 5 pages. */
export function getNamesOf(address: string, options: { force?: boolean } = {}): Promise<NamesOf> {
  return fetchQuery(
    `xnames:${address}`,
    async () => {
      const names: string[] = [];
      for (let page = 0; page < NAME_PAGES; page++) {
        const rows = await getJson<Array<{ name?: string }>>(
          `/names/address/${seg(address)}?${query({ limit: 100, offset: page * 100 })}`
        );
        const chunk = (Array.isArray(rows) ? rows : [])
          .map((row) => row?.name)
          .filter((name): name is string => typeof name === 'string' && name.length > 0);
        names.push(...chunk);
        if (chunk.length < 100) return { names, truncated: false };
      }
      return { names, truncated: true };
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}

/** A name's own record (`GET /names/{name}`). */
export interface NameData {
  name: string;
  reducedName?: string;
  owner: string;
  data?: string;
  registered?: number;
  updated?: number;
  isForSale?: boolean;
  salePrice?: string;
}

/**
 * `GET /names/{name}`, or null when nobody has it. Core matches the reduced
 * name, so `T00LS` finds "Tools": compare `name` with what was typed.
 * Primes `nameowner:<name>` (the app's owner lookup) with the same answer.
 */
export function getNameData(name: string): Promise<NameData | null> {
  return fetchQuery(
    `xnamedata:${name}`,
    async () => {
      try {
        const body = await getJson<Partial<NameData>>(`/names/${seg(name)}`);
        if (!body || !isAddress(body.owner) || typeof body.name !== 'string') return null;
        const data: NameData = {
          name: body.name,
          owner: body.owner,
          ...(typeof body.reducedName === 'string' ? { reducedName: body.reducedName } : {}),
          ...(typeof body.data === 'string' ? { data: body.data } : {}),
          ...(typeof body.registered === 'number' ? { registered: body.registered } : {}),
          ...(typeof body.updated === 'number' ? { updated: body.updated } : {}),
          ...(typeof body.isForSale === 'boolean' ? { isForSale: body.isForSale } : {}),
          ...(typeof body.salePrice === 'string' ? { salePrice: body.salePrice } : {}),
        };
        if (peekQuery(`nameowner:${name}`) === undefined)
          setQueryData(`nameowner:${name}`, data.owner);
        return data;
      } catch (error) {
        if (error instanceof CoreHttpError && error.status === 404) return null;
        throw error;
      }
    },
    { ttlMs: 10 * 60_000 }
  );
}

// ---- Groups -----------------------------------------------------------------

/** A row of `GET /groups/member/{a}`: one group the account is in. */
export interface GroupOf {
  groupId: number;
  groupName: string;
  owner?: string;
  ownerPrimaryName?: string;
  isOpen?: boolean;
  memberCount?: number;
  isAdmin?: boolean;
  created?: number;
  /** The group's own description, as its owner wrote it (trimmed; absent when empty). */
  description?: string;
}

/**
 * Every group the account is in (`GET /groups/member/{a}`, one read, no
 * paging in Core). Primes `membership:<a>` (data/group.ts) with the same
 * answer, reduced to MINTER.
 */
export function getGroupsOf(
  address: string,
  options: { force?: boolean } = {}
): Promise<GroupOf[]> {
  return fetchQuery(
    `xgroups:${address}`,
    async () => {
      const rows = await getJson<unknown>(`/groups/member/${seg(address)}`);
      const groups: GroupOf[] = (Array.isArray(rows) ? rows : [])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .map((row) => ({
          groupId: Number(row.groupId),
          groupName: String(row.groupName ?? ''),
          ...(typeof row.owner === 'string' ? { owner: row.owner } : {}),
          ...(typeof row.ownerPrimaryName === 'string'
            ? { ownerPrimaryName: row.ownerPrimaryName }
            : {}),
          ...(typeof row.isOpen === 'boolean' ? { isOpen: row.isOpen } : {}),
          ...(typeof row.memberCount === 'number' ? { memberCount: row.memberCount } : {}),
          ...(row.isAdmin === true ? { isAdmin: true } : {}),
          ...(typeof row.created === 'number' ? { created: row.created } : {}),
          ...(typeof row.description === 'string' && row.description.trim()
            ? { description: row.description.trim() }
            : {}),
        }))
        .filter((group) => Number.isFinite(group.groupId));
      const minter = groups.find((group) => group.groupId === MINTER_GROUP_ID);
      setQueryData(`membership:${address}`, {
        isMember: Boolean(minter),
        isAdmin: Boolean(minter?.isAdmin),
      });
      return groups;
    },
    { ttlMs: 5 * 60_000, force: options.force }
  );
}

// ---- Minting now ----------------------------------------------------------------

/** A row of `GET /addresses/online`: one reward share minting right now. */
export interface OnlineShare {
  minterAddress: string;
  recipientAddress: string;
  minterLevel?: number;
  isMinterMember?: boolean;
}

/** Every online reward share (one read of about 125 KB, kept 5 minutes, never polled). */
export function getOnline(): Promise<OnlineShare[]> {
  return fetchQuery(
    'xonline',
    async () => {
      const rows = await getJson<unknown>('/addresses/online');
      return (Array.isArray(rows) ? rows : [])
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
        .filter((row) => isAddress(row.minterAddress) && isAddress(row.recipientAddress))
        .map((row) => ({
          minterAddress: row.minterAddress as string,
          recipientAddress: row.recipientAddress as string,
          ...(typeof row.minterLevel === 'number' ? { minterLevel: row.minterLevel } : {}),
          ...(typeof row.isMinterMember === 'boolean'
            ? { isMinterMember: row.isMinterMember }
            : {}),
        }));
    },
    { ttlMs: 5 * 60_000 }
  );
}

/** The online shares an account is part of, as minter or recipient. */
export function onlineSharesOf(shares: OnlineShare[], address: string): OnlineShare[] {
  return shares.filter(
    (share) => share.minterAddress === address || share.recipientAddress === address
  );
}

/**
 * Where an account started minting (`xmintstart:<a>`): its oldest reward
 * share, as the minter or the recipient, and its newest minting-level move,
 * if any (rules/explorer/onlineShare.ts). Two searches of one row each.
 */
export function getMintingStart(address: string): Promise<MintingStart> {
  const search = (txType: string, reverse: boolean) =>
    getJson<TxRow[]>(
      `/transactions/search?${query({
        txType,
        address,
        confirmationStatus: 'CONFIRMED',
        limit: 1,
        reverse,
      })}`
    ).then((rows) => (Array.isArray(rows) ? rows : [])[0] ?? null);
  return fetchQuery(
    `xmintstart:${address}`,
    async () => {
      const [share, move] = await Promise.all([
        search('REWARD_SHARE', false),
        search('TRANSFER_PRIVS', true),
      ]);
      return {
        firstShare:
          share && typeof share.blockHeight === 'number'
            ? { height: share.blockHeight, timestamp: share.timestamp, signature: share.signature }
            : null,
        moved:
          move && typeof move.blockHeight === 'number'
            ? { height: move.blockHeight, away: move.creatorAddress === address }
            : null,
      };
    },
    { ttlMs: 10 * 60_000 }
  );
}

/** The minting-level moves into an account: who sent each, newest first, at most 20 (`xlevelin:<a>`). */
export function getLevelMovesIn(
  address: string
): Promise<Array<{ from: string; height: number; timestamp: number; signature: string }>> {
  return fetchQuery(
    `xlevelin:${address}`,
    async () => {
      const rows = await getJson<TxRow[]>(
        `/transactions/search?${query({
          txType: 'TRANSFER_PRIVS',
          address,
          confirmationStatus: 'CONFIRMED',
          limit: 20,
          reverse: true,
        })}`
      );
      return (Array.isArray(rows) ? rows : [])
        .filter(
          (tx) =>
            typeof tx.blockHeight === 'number' &&
            isAddress(tx.creatorAddress) &&
            tx.creatorAddress !== address
        )
        .map((tx) => ({
          from: tx.creatorAddress as string,
          height: tx.blockHeight as number,
          timestamp: tx.timestamp,
          signature: tx.signature,
        }));
    },
    { ttlMs: 10 * 60_000 }
  );
}

/** Accounts followed back at most, and how many moves back. */
export const LINEAGE_MAX_SOURCES = 6;
export const LINEAGE_MAX_DEPTH = 3;

/**
 * Where an account's minting level was minted (`xlineage:<a>`; Simon,
 * 2026-10-20: "when the minter level was moved from another account can you
 * fetch that another account data for statistics as well"): the accounts it
 * moved from, and the ones those got it from, each with its first reward
 * share and the block it moved on, and the account itself since its own
 * first share. Core adds a sender's blocks minted to the recipient's and
 * clears the sender's, so the level's blocks minted are counted over all of
 * them (rules/explorer/onlineShare.ts lineageShare). Per account: its
 * moves in, its minting start and its name (one search, two of one row,
 * one name), at most LINEAGE_MAX_SOURCES accounts, LINEAGE_MAX_DEPTH back.
 */
export function getLevelLineage(address: string): Promise<LevelLineage> {
  return fetchQuery(
    `xlineage:${address}`,
    async () => {
      const own = await getMintingStart(address);
      const periods: LevelLineage['periods'] = own.firstShare
        ? [{ address, from: own.firstShare.height, to: null }]
        : [];
      const sources: LevelSource[] = [];
      const seen = new Set([address]);
      let truncated = false;
      const queue: Array<{ address: string; until: number; depth: number }> = [
        { address, until: Number.POSITIVE_INFINITY, depth: 0 },
      ];
      while (queue.length) {
        const next = queue.shift() as { address: string; until: number; depth: number };
        const moves = (await getLevelMovesIn(next.address)).filter((m) => m.height <= next.until);
        for (const move of moves) {
          if (seen.has(move.from)) continue;
          if (sources.length >= LINEAGE_MAX_SOURCES || next.depth >= LINEAGE_MAX_DEPTH) {
            truncated = true;
            continue;
          }
          seen.add(move.from);
          const [start, name] = await Promise.all([
            getMintingStart(move.from),
            getPrimaryName(move.from).catch(() => null),
          ]);
          const first =
            start.firstShare && start.firstShare.height < move.height
              ? start.firstShare.height
              : null;
          sources.push({
            address: move.from,
            name,
            to: next.address,
            height: move.height,
            timestamp: move.timestamp,
            signature: move.signature,
            firstShare: first,
          });
          if (first !== null) periods.push({ address: move.from, from: first, to: move.height });
          queue.push({ address: move.from, until: move.height, depth: next.depth + 1 });
        }
      }
      return { periods, sources, truncated };
    },
    { ttlMs: 10 * 60_000 }
  );
}

/** The newest block an account's current keys signed (`/blocks/signer`; needs a public key). */
export interface LastSigned {
  height: number;
  timestamp: number;
}

export function getLastSigned(address: string): Promise<LastSigned | null> {
  return fetchQuery(
    `xsigned:${address}`,
    async () => {
      const rows = await getJson<Array<{ height?: number; timestamp?: number }>>(
        `/blocks/signer/${seg(address)}?${query({ limit: 1, reverse: true })}`
      );
      // Core reads the live and the archived blocks apart and can answer up to two rows.
      const best = (Array.isArray(rows) ? rows : [])
        .filter((row) => typeof row?.height === 'number')
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
      return best
        ? { height: best.height as number, timestamp: Number(best.timestamp ?? 0) }
        : null;
    },
    { ttlMs: 5 * 60_000 }
  );
}

// ---- Transactions by signature ------------------------------------------------

/**
 * `GET /transactions/signature/{sig}`: null when Core doesn't know it (404),
 * thrown on any other failure. A confirmed transaction never changes, so it
 * is kept for the session; a waiting one is read again after 20 s.
 */
export function getTx(signature: string, options: { force?: boolean } = {}): Promise<TxRow | null> {
  return fetchQuery(
    `xtxsig:${signature}`,
    async () => {
      try {
        return await getJson<TxRow>(`/transactions/signature/${seg(signature)}`);
      } catch (error) {
        if (error instanceof CoreHttpError && error.status === 404) return null;
        throw error;
      }
    },
    {
      ttlMs:
        typeof peekQuery<TxRow | null>(`xtxsig:${signature}`)?.blockHeight === 'number'
          ? Number.POSITIVE_INFINITY
          : 20_000,
      force: options.force,
    }
  );
}

/**
 * The recipient of a TRANSFER_PRIVS (a minting level moved to a new key).
 * Core's JSON leaves it out, so it is read from the raw bytes: type (4),
 * timestamp (8), txGroupId (4), reference (64), sender's public key (32),
 * then the recipient's 25-byte address.
 */
export function decodePrivsRecipient(raw: string): string | null {
  let bytes: Uint8Array;
  try {
    bytes = base58Decode(raw.trim());
  } catch {
    return null;
  }
  if (bytes.length < 137) return null;
  const type = new DataView(bytes.buffer, bytes.byteOffset, 4).getInt32(0);
  if (type !== 40) return null;
  const address = base58Encode(bytes.slice(112, 137));
  return isAddress(address) ? address : null;
}

export function getPrivsRecipient(signature: string): Promise<string | null> {
  return fetchQuery(
    `xprivs:${signature}`,
    async () =>
      decodePrivsRecipient(await getText(`/transactions/signature/${seg(signature)}/raw`)),
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

// ---- Where the first QORT came from --------------------------------------------

export type FundingKind =
  'payment' | 'multiPayment' | 'transferAsset' | 'at' | 'rewardShare' | 'transferPrivs' | 'genesis';

export interface Funding {
  /**
   * The kind of transaction. A multi-payment counts as 'multiPayment' only
   * when it paid the account QORT; one that paid it another asset is an
   * asset transfer.
   */
  kind: FundingKind;
  /** Who it came from (an AT's own address for an AT payout); null for the genesis block. */
  from: string | null;
  amount?: string;
  /** The asset of `amount` (0 is QORT), for asset transfers, multi-payments and the genesis block. */
  assetId?: number;
  assetName?: string;
  sharePercent?: string;
  height: number;
  timestamp: number;
  signature: string;
}

export interface FirstSeen {
  /** The account's first own transaction (oldest first), when it has sent any. */
  firstOwn: { type: string; height: number; timestamp: number; signature: string } | null;
  /** Its first incoming transaction that Core recorded (or its first QORT payment received). */
  funding: Funding | null;
  /** The lower of the two. */
  firstSeen: { height: number; timestamp: number } | null;
}

/** Core's asset id (absent means QORT); NaN when it isn't a number. */
function assetIdOf(value: unknown): number {
  return value === undefined || value === null ? 0 : Number(value);
}

/** The asset of a row or payment, as Funding carries it. */
function assetOf(row: Readonly<Record<string, unknown>>): Pick<Funding, 'assetId' | 'assetName'> {
  return {
    assetId: assetIdOf(row.assetId),
    ...(typeof row.assetName === 'string' && row.assetName ? { assetName: row.assetName } : {}),
  };
}

/** What `tx` gave `address`, if `tx` is a transaction that sends something to it. */
export function fundingFrom(tx: TxRow, address: string): Funding | null {
  if (typeof tx.blockHeight !== 'number') return null;
  const base = { height: tx.blockHeight, timestamp: tx.timestamp, signature: tx.signature };
  const creator = typeof tx.creatorAddress === 'string' ? tx.creatorAddress : null;
  switch (tx.type) {
    case 'PAYMENT':
      return tx.recipient === address
        ? { ...base, kind: 'payment', from: creator, amount: String(tx.amount ?? '') }
        : null;
    case 'TRANSFER_ASSET':
      return tx.recipient === address
        ? {
            ...base,
            kind: 'transferAsset',
            from: creator,
            amount: String(tx.amount ?? ''),
            ...assetOf(tx),
          }
        : null;
    case 'MULTI_PAYMENT': {
      // Core takes a multi-payment of any asset as a new account's first
      // transaction: it is a QORT payment only when it paid QORT.
      const payments = Array.isArray(tx.payments)
        ? (tx.payments as Array<{ recipient?: string; amount?: string; assetId?: unknown }>)
        : [];
      const mine = payments.filter((payment) => payment?.recipient === address);
      const qort = mine.find((payment) => assetIdOf(payment.assetId) === 0);
      const paid = qort ?? mine[0];
      return paid
        ? {
            ...base,
            kind: qort ? 'multiPayment' : 'transferAsset',
            from: creator,
            amount: String(paid.amount ?? ''),
            ...assetOf(paid),
          }
        : null;
    }
    case 'AT':
      return tx.recipient === address
        ? {
            ...base,
            kind: 'at',
            from: typeof tx.atAddress === 'string' ? tx.atAddress : null,
            amount: String(tx.amount ?? ''),
          }
        : null;
    case 'REWARD_SHARE':
      return tx.recipient === address && creator !== address
        ? {
            ...base,
            kind: 'rewardShare',
            from: creator,
            sharePercent: String(tx.sharePercent ?? ''),
          }
        : null;
    case 'TRANSFER_PRIVS':
      // The recipient isn't in Core's JSON; the reference chain names it.
      return creator && creator !== address
        ? { ...base, kind: 'transferPrivs', from: creator }
        : null;
    case 'GENESIS':
      // The genesis block gave out other assets than QORT: keep which one.
      return tx.recipient === address
        ? { ...base, kind: 'genesis', from: null, amount: String(tx.amount ?? ''), ...assetOf(tx) }
        : null;
    default:
      return null;
  }
}

/** Fee-less first transactions whose reference isn't a real transaction. */
const NO_REAL_REFERENCE = new Set(['PUBLICIZE', 'ARBITRARY']);

/**
 * When the account was first seen and where its first QORT (or minting key)
 * came from:
 * - no own transaction yet: its reference is its first incoming transaction;
 * - otherwise its oldest own transaction's reference is, unless that was a
 *   PUBLICIZE or an ARBITRARY (they take any reference);
 * - the answer must name the account as recipient; else, the first QORT
 *   payment it received (`payments/between`, oldest first).
 */
export function getFirstSeen(address: string): Promise<FirstSeen> {
  return fetchQuery(
    `xfirst:${address}`,
    async () => {
      const account = await getAccount(address);
      let firstOwn: FirstSeen['firstOwn'] = null;
      let reference: string | undefined;
      if (account.publicKey) {
        const rows = await getJson<TxRow[]>(
          `/transactions/creator/${seg(account.publicKey)}?${query({
            confirmationStatus: 'CONFIRMED',
            limit: 1,
          })}`
        );
        const first = Array.isArray(rows) ? rows[0] : undefined;
        if (first && typeof first.blockHeight === 'number') {
          firstOwn = {
            type: first.type,
            height: first.blockHeight,
            timestamp: first.timestamp,
            signature: first.signature,
          };
          if (!NO_REAL_REFERENCE.has(first.type)) reference = first.reference;
        }
      } else {
        reference = account.reference;
      }
      let funding: Funding | null = null;
      if (reference) {
        // getTx answers null only when Core doesn't know the transaction; any
        // other failure rejects this load, so it is never kept as "none found".
        const tx = await getTx(reference);
        funding = tx ? fundingFrom(tx, address) : null;
      }
      if (!funding) {
        const rows = await getJson<TxRow[]>(
          `/transactions/payments/between?${query({
            recipientAddress: address,
            confirmationStatus: 'CONFIRMED',
            limit: 1,
          })}`
        );
        const first = Array.isArray(rows) ? rows[0] : undefined;
        funding = first ? fundingFrom(first, address) : null;
      }
      const heights = [firstOwn, funding].filter(
        (x): x is NonNullable<typeof x> => x !== null && typeof x.height === 'number'
      );
      const earliest = heights.sort((a, b) => a.height - b.height)[0];
      return {
        firstOwn,
        funding,
        firstSeen: earliest ? { height: earliest.height, timestamp: earliest.timestamp } : null,
      };
    },
    { ttlMs: 30 * 60_000 }
  );
}

// ---- How busy a payer is --------------------------------------------------------

/** At least this many QORT payments sent: 0, 100, 500 or 1,000. */
export type PayerBand = 0 | 100 | 500 | 1000;

const BANDS: PayerBand[] = [100, 500, 1000];

/**
 * How many QORT payments an account has sent, in bands (PAYMENT only): one
 * `payments/between` read at offset 99, then 499 and 999 while they answer
 * a row. 3–30 ms each on a busy node, so it is cheap enough for every
 * counterparty a list shows.
 */
export function getPayerBand(address: string): Promise<PayerBand> {
  return fetchQuery(
    `xbusy:${address}`,
    async () => {
      let band: PayerBand = 0;
      for (const step of BANDS) {
        const rows = await getJson<unknown[]>(
          `/transactions/payments/between?${query({
            senderAddress: address,
            confirmationStatus: 'CONFIRMED',
            limit: 1,
            offset: step - 1,
          })}`
        );
        if (!Array.isArray(rows) || rows.length === 0) break;
        band = step;
      }
      return band;
    },
    { ttlMs: 30 * 60_000 }
  );
}

/** "has sent 1,000+ payments", or null under 100. */
export function payerBandWords(band: PayerBand): string | null {
  return band ? `has sent ${band.toLocaleString('en-US')}+ payments` : null;
}

// ---- Group names ----------------------------------------------------------------

/** A group's name, and its owner's primary name (whose THUMBNAIL is the group's avatar). */
export interface GroupLabel {
  name: string | null;
  ownerName: string | null;
}

/**
 * A group's name and owner's name (`GET /groups/{id}`), kept for the
 * session; MINTER needs no read (its owner, Core's null account, has no
 * name). Both null when Core doesn't know the group.
 */
export function getGroupLabel(groupId: number): Promise<GroupLabel> {
  if (groupId === MINTER_GROUP_ID) return Promise.resolve({ name: 'MINTER', ownerName: null });
  return fetchQuery(
    `xgroup:${groupId}`,
    async () => {
      try {
        const body = await getJson<{ groupName?: string; ownerPrimaryName?: string }>(
          `/groups/${seg(groupId)}`
        );
        return {
          name: typeof body?.groupName === 'string' && body.groupName ? body.groupName : null,
          ownerName:
            typeof body?.ownerPrimaryName === 'string' && body.ownerPrimaryName
              ? body.ownerPrimaryName
              : null,
        };
      } catch (error) {
        if (error instanceof CoreHttpError && error.status === 404)
          return { name: null, ownerName: null };
        throw error;
      }
    },
    { ttlMs: 60 * 60_000 }
  );
}
