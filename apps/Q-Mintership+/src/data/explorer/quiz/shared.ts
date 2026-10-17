/**
 * What the Explorer Quiz's question makers share: their shape, randomness,
 * question parts, and the reads they make (all GET, small pages, most of
 * them the Explorer's own cached reads, so an answer is what the Explorer
 * shows). The makers are in this folder by theme; generators.ts picks one.
 *
 * Where the randomness comes from: MINTER's members (the app's member list,
 * read once), or a random stretch of blocks searched for one type of
 * transaction (`/transactions/search` with a block range, 20 rows, oldest
 * first, as Transactions on Qortal reads it), or the chain's very first
 * transaction of a type (one read without a range, `limit=1`).
 */
import { getPrimaryName, isAddress } from '../../accounts';
import { getJson, query } from '../../core';
import { getMembers } from '../../group';
import { fetchQuery } from '../../query';
import type { GroupMemberRow, TxRow } from '../../types';
import { getGroupLabel } from '../account';
import { getLinks } from '../links';
import { explorerAccountPath, explorerTransactionsPath } from '../../../routes/paths';
import { linksOf, type Links } from '../../../rules/explorer/connections';
import type {
  QuizAnswer,
  QuizLevel,
  QuizOption,
  QuizPart,
  QuizQuestion,
  QuizTheme,
} from '../../../rules/explorer/quiz/types';
import { formatDate } from '../../../utils/format';

export type Rng = () => number;

export interface QuizContext {
  rng: Rng;
  tip: number;
  /** Asked before on this device. */
  seen: (key: string) => boolean;
  /** Not in a question lately (an address, `n:<name>`, `b:<height>`, `g:<group>`). */
  fresh: (subject: string) => boolean;
}

export type Made = Omit<QuizQuestion, 'v' | 'template' | 'level' | 'tip' | 'theme'>;

export interface QuizTemplate {
  id: string;
  level: QuizLevel;
  theme: QuizTheme;
  /** How often it comes up against the others of its level (1 by default). */
  weight?: number;
  make: (ctx: QuizContext) => Promise<Made | null>;
  /** A live answer read again (from the question's `args`). */
  recheck?: (args: Record<string, string | number>) => Promise<QuizAnswer | null>;
}

// ---- randomness ------------------------------------------------------------------

export const randInt = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(rng() * (Math.max(lo, hi) - lo + 1));

export const pick = <T>(rng: Rng, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/** A shuffled copy (Fisher–Yates). */
export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- parts -----------------------------------------------------------------------

export const text = (t: string): QuizPart => ({ kind: 'text', text: t });
export const block = (height: number): QuizPart => ({ kind: 'block', height });
export const nameP = (name: string): QuizPart => ({ kind: 'name', name });
export const groupP = (id: number, name: string | null): QuizPart => ({ kind: 'group', id, name });

export interface Person {
  address: string;
  name: string | null;
}

export const personP = (p: Person): QuizPart => ({
  kind: 'account',
  address: p.address,
  name: p.name,
});

/** An account with its primary name (cached), for a question. */
export async function person(address: string): Promise<Person> {
  return { address, name: await getPrimaryName(address).catch(() => null) };
}

export async function accountP(address: string): Promise<QuizPart> {
  return personP(await person(address));
}

export async function answerAccount(address: string): Promise<QuizAnswer> {
  const p = await person(address);
  return { kind: 'account', address: p.address, name: p.name };
}

/** A person as an option of a multiple choice. */
export const personOption = (p: Person): QuizOption => ({
  parts: [personP(p)],
  label: p.name ?? p.address,
});

export const wordOption = (label: string): QuizOption => ({ parts: [text(label)], label });

export const ACCOUNT_PLACEHOLDER = 'A name or an address';

export const count = (n: number) => n.toLocaleString('en-US');

/** "12 Mar 2025", as the Explorer shows dates. */
export const day = (timestamp: number) => formatDate(timestamp);

/** The year of `timestamp` here, as the Explorer's dates show it. */
export const yearOf = (timestamp: number) => new Date(timestamp).getFullYear();

/** Subjects for a question: addresses as they are, the rest tagged. */
export const subjects = (...items: Array<string | null | undefined | false>) =>
  items.filter((item): item is string => Boolean(item));
export const nameSubject = (name: string) => `n:${name.toLowerCase()}`;
export const blockSubject = (height: number) => `b:${height}`;
export const groupSubject = (id: number) => `g:${id}`;

// ---- links -----------------------------------------------------------------------

export const accountLink = explorerAccountPath;

/** Transactions on Qortal at a block range, with the type, the narrowing and the order. */
export function globalLink(
  type: string,
  start: number,
  span: 1 | 10 | 100 | 1000 | 10000,
  more: Record<string, string> = {}
): string {
  const params = new URLSearchParams({ type, blocks: `from-${start}` });
  if (span !== 10000) params.set('span', String(span));
  for (const [key, value] of Object.entries(more)) params.set(key, value);
  return `${explorerTransactionsPath()}?${params.toString()}`;
}

/** The 10,000-block stretch (as Transactions on Qortal offers it) that holds `height`. */
export function stretchOf(height: number): number {
  return Math.max(1, height - (height % 10_000));
}

// ---- reads -----------------------------------------------------------------------

const asRows = (body: unknown): TxRow[] =>
  (Array.isArray(body) ? body : []).filter(
    (row): row is TxRow =>
      Boolean(row) && typeof row === 'object' && typeof (row as TxRow).signature === 'string'
  );

/** Confirmed transactions in blocks [start, start + span), oldest first, 20 a page. */
export async function searchRange(
  types: readonly string[],
  start: number,
  span: number,
  offset = 0
): Promise<TxRow[]> {
  return asRows(
    await getJson<unknown>(
      `/transactions/search?${query({
        txType: types,
        startBlock: start,
        blockLimit: span,
        confirmationStatus: 'CONFIRMED',
        limit: 20,
        offset,
        reverse: false,
      })}`
    )
  );
}

/** Every row in a range, up to `pages` pages; null when there are more. */
export async function wholeRange(
  types: readonly string[],
  start: number,
  span: number,
  pages = 3
): Promise<TxRow[] | null> {
  const rows: TxRow[] = [];
  for (let page = 0; page < pages; page += 1) {
    const chunk = await searchRange(types, start, span, page * 20);
    rows.push(...chunk);
    if (chunk.length < 20) return rows;
  }
  return null;
}

/**
 * Rows of `types` in a random stretch of `span` blocks after `from`, trying
 * up to `tries` stretches until one has some.
 */
export async function randomRows(
  ctx: QuizContext,
  types: readonly string[],
  span: number,
  from = 2,
  tries = 3
): Promise<{ rows: TxRow[]; start: number } | null> {
  for (let i = 0; i < tries; i += 1) {
    const start = randInt(ctx.rng, from, Math.max(from, ctx.tip - span));
    const rows = await searchRange(types, start, span);
    if (rows.length) return { rows, start };
  }
  return null;
}

/**
 * One of `rows` at random, preferring one whose people (`who`) all have a
 * name and haven't been in a question lately; null when none is fresh.
 */
export async function pickRow(
  ctx: QuizContext,
  rows: readonly TxRow[],
  who: (row: TxRow) => Array<string | null | undefined>
): Promise<TxRow | null> {
  let fallback: TxRow | null = null;
  for (const row of shuffle(ctx.rng, rows).slice(0, 6)) {
    const people = who(row);
    if (people.some((a) => !isAddress(a) || !ctx.fresh(a))) continue;
    const named = await Promise.all(
      people.map((a) => getPrimaryName(a as string).catch(() => null))
    );
    if (named.every(Boolean)) return row;
    fallback ??= row;
  }
  return fallback;
}

/** The block with the most of `rows` in it, and how many (ties: the first). */
export function densestBlock(rows: readonly TxRow[]): { height: number; n: number } | null {
  const counts = new Map<number, number>();
  for (const row of rows)
    if (typeof row.blockHeight === 'number')
      counts.set(row.blockHeight, (counts.get(row.blockHeight) ?? 0) + 1);
  let best: { height: number; n: number } | null = null;
  for (const [height, n] of counts) if (!best || n > best.n) best = { height, n };
  return best;
}

/**
 * A block with at least `min` rows of `types`, from random stretches of
 * 1,000 blocks after `from` (the busiest block of each stretch's first
 * rows), up to `tries` stretches; null when none was busy enough.
 */
export async function busyBlockOf(
  ctx: QuizContext,
  types: readonly string[],
  min: number,
  from: number,
  tries = 3
): Promise<number | null> {
  for (let i = 0; i < tries; i += 1) {
    const found = await randomRows(ctx, types, 1000, from, 1);
    const best = found ? densestBlock(found.rows) : null;
    if (best && best.n >= min && ctx.fresh(blockSubject(best.height))) return best.height;
  }
  return null;
}

/** MINTER's members (the app's list, read once). */
export async function members(): Promise<GroupMemberRow[]> {
  return (await getMembers()).members;
}

/** A random MINTER member not in a question lately, one with a name unless `anyName`. */
export async function randomMember(
  ctx: QuizContext,
  options: { anyName?: boolean; except?: ReadonlySet<string> } = {}
): Promise<Person> {
  const list = await members();
  const pool = list.filter(
    (m) =>
      (options.anyName || Boolean(m.primaryName)) &&
      !options.except?.has(m.member) &&
      ctx.fresh(m.member)
  );
  const row = pick(ctx.rng, pool.length ? pool : list);
  return { address: row.member, name: row.primaryName ?? null };
}

/** `n` different named members, not in a question lately. */
export async function randomMembers(ctx: QuizContext, n: number): Promise<Person[]> {
  const list = (await members()).filter((m) => m.primaryName && ctx.fresh(m.member));
  return shuffle(ctx.rng, list)
    .slice(0, n)
    .map((m) => ({ address: m.member, name: m.primaryName ?? null }));
}

/** The chain's very first confirmed transaction of `type` (one read, kept for the session). */
export function firstEver(type: string): Promise<TxRow | null> {
  return fetchQuery(
    `xquizfirst:${type}`,
    async () =>
      asRows(
        await getJson<unknown>(
          `/transactions/search?${query({
            txType: type,
            confirmationStatus: 'CONFIRMED',
            limit: 1,
            reverse: false,
          })}`
        )
      )[0] ?? null,
    { ttlMs: Number.POSITIVE_INFINITY }
  );
}

export async function groupName(id: number): Promise<string | null> {
  return (await getGroupLabel(id).catch(() => null))?.name ?? null;
}

/**
 * What Connections says about an account's reward shares and level moves
 * (the same read and rules); null when its links were capped, since then
 * the earliest ones may be missing.
 */
export async function linksAbout(address: string, force = false): Promise<Links | null> {
  const links = await getLinks(address, { scope: 'explorer-quiz', force });
  return links.truncated ? null : linksOf(links.rows, address, links.privs);
}

/** Exact sums of QORT amounts ("12.34000000"), in units of 10⁻⁸. */
export function atomic(amount: string): bigint {
  const [int, frac = ''] = String(amount).split('.');
  return BigInt(int || '0') * 100_000_000n + BigInt((frac + '00000000').slice(0, 8));
}

export function fromAtomic(value: bigint): string {
  return `${value / 100_000_000n}.${(value % 100_000_000n).toString().padStart(8, '0')}`;
}

/** Days from `timestamp` to now, rounded down. */
export const daysAgo = (timestamp: number) =>
  Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
