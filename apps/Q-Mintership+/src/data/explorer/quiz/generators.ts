/**
 * The Explorer Quiz's questions (Simon, 2026-10-16: unique, interesting,
 * sometimes tricky questions that make people dig through the Explorer).
 * Each template reads a little of the chain (all GET, small pages, most of
 * them the Explorer's own cached reads, so the answer is what the Explorer
 * shows), picks something at random and asks about it; it answers null when
 * what it found doesn't make a fair question, and another template is tried
 * (makeQuestion). Nothing here writes.
 *
 * Where the randomness comes from: a random MINTER member (the app's member
 * list, read once), or a random stretch of blocks searched for one type of
 * transaction (`/transactions/search` with a block range, 20 rows, as
 * Transactions on Qortal reads it).
 */
import { getAccount, getPrimaryName, isAddress } from '../../accounts';
import { getTip } from '../../chain';
import { getJson, query } from '../../core';
import { getMembers } from '../../group';
import type { TxRow } from '../../types';
import {
  getFirstSeen,
  getGroupLabel,
  getGroupsOf,
  getNamesOf,
  getPrivsRecipient,
} from '../account';
import { getCoreSponsor } from '../sponsorship';
import {
  explorerAccountPath,
  explorerTransactionsPath,
  explorerTxPath,
} from '../../../routes/paths';
import { ALL_TX_TYPES, txTypeLabel, typesFor } from '../../../rules/explorer/txFamilies';
import type {
  QuizAnswer,
  QuizLevel,
  QuizPart,
  QuizQuestion,
} from '../../../rules/explorer/quiz/types';

export type Rng = () => number;

export interface QuizContext {
  rng: Rng;
  tip: number;
  /** Asked before on this device. */
  seen: (key: string) => boolean;
}

type Made = Omit<QuizQuestion, 'v' | 'template' | 'level' | 'tip'>;

export interface QuizTemplate {
  id: string;
  level: QuizLevel;
  make: (ctx: QuizContext) => Promise<Made | null>;
}

// ---- small helpers ---------------------------------------------------------------

const randInt = (rng: Rng, lo: number, hi: number) =>
  lo + Math.floor(rng() * (Math.max(lo, hi) - lo + 1));
const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];
const text = (t: string): QuizPart => ({ kind: 'text', text: t });
const block = (height: number): QuizPart => ({ kind: 'block', height });
const nameP = (name: string): QuizPart => ({ kind: 'name', name });
const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;
const count = (n: number) => n.toLocaleString('en-US');

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
];

async function account(address: string): Promise<QuizPart & { kind: 'account' }> {
  const name = await getPrimaryName(address).catch(() => null);
  return { kind: 'account', address, name };
}

async function answerAccount(address: string): Promise<QuizAnswer> {
  return { kind: 'account', address, name: await getPrimaryName(address).catch(() => null) };
}

const ACCOUNT_PLACEHOLDER = 'A name or an address';

/** Transactions on Qortal at a block range, with the type, the narrowing and the order. */
function globalLink(
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

/** Confirmed transactions in blocks [start, start + span), oldest first (20 a page). */
async function searchRange(
  types: readonly string[],
  start: number,
  span: number,
  offset = 0
): Promise<TxRow[]> {
  const body = await getJson<unknown>(
    `/transactions/search?${query({
      txType: types,
      startBlock: start,
      blockLimit: span,
      confirmationStatus: 'CONFIRMED',
      limit: 20,
      offset,
      reverse: false,
    })}`
  );
  return (Array.isArray(body) ? body : []).filter(
    (row): row is TxRow =>
      Boolean(row) && typeof row === 'object' && typeof (row as TxRow).signature === 'string'
  );
}

/** Every row in a range, up to `pages` pages; null when there are more. */
async function wholeRange(
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
async function randomRows(
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

/** A random MINTER member, one with a name 9 times in 10. */
async function randomMember(ctx: QuizContext): Promise<{ address: string; name: string | null }> {
  const { members } = await getMembers();
  const named = members.filter((m) => m.primaryName);
  const pool = named.length && ctx.rng() < 0.9 ? named : members;
  const row = pick(ctx.rng, pool);
  return { address: row.member, name: row.primaryName ?? null };
}

const memberPart = (m: { address: string; name: string | null }): QuizPart => ({
  kind: 'account',
  address: m.address,
  name: m.name,
});

const accountLink = (address: string, tab?: Parameters<typeof explorerAccountPath>[1]) =>
  explorerAccountPath(address, tab);

// ---- easy ----------------------------------------------------------------------------

const level: QuizTemplate = {
  id: 'level',
  level: 'easy',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `level:${m.address}`;
    if (ctx.seen(key)) return null;
    const info = await getAccount(m.address);
    return {
      key,
      parts: [text('What minting level is '), memberPart(m), text(' at?')],
      answer: { kind: 'number', value: String(info.level) },
      placeholder: 'A number',
      hint: 'Search for the account. Its level is in the page’s header, and in At a glance.',
      how: 'An account’s level is in its header and in Overview → At a glance, with how far it is to the next one.',
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
    };
  },
};

const firstSeenBlock: QuizTemplate = {
  id: 'firstSeenBlock',
  level: 'easy',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstSeen:${m.address}`;
    if (ctx.seen(key)) return null;
    const seen = await getFirstSeen(m.address);
    if (!seen.firstSeen) return null;
    return {
      key,
      parts: [text('In which block was '), memberPart(m), text(' first seen on the chain?')],
      answer: { kind: 'number', value: String(seen.firstSeen.height) },
      placeholder: 'A block number',
      hint: 'Overview → At a glance has a fact for exactly this.',
      how: 'Overview → At a glance → First seen gives the date and the block of its first transaction, or of the first one it received.',
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
    };
  },
};

const primaryName: QuizTemplate = {
  id: 'primaryName',
  level: 'easy',
  async make(ctx) {
    const m = await randomMember(ctx);
    if (!m.name) return null;
    const key = `primaryName:${m.address}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('Which name does the account '),
        { kind: 'account', address: m.address, name: null },
        text(' go by (its primary name)?'),
      ],
      answer: { kind: 'text', accepted: [m.name], shown: m.name },
      placeholder: 'A name',
      hint: 'Copy the address into the Explorer’s search.',
      how: 'An address typed or pasted into the search opens its account, with its primary name at the top.',
      link: accountLink(m.address),
      linkLabel: 'Open the account',
    };
  },
};

const namesCount: QuizTemplate = {
  id: 'namesCount',
  level: 'easy',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `namesCount:${m.address}`;
    if (ctx.seen(key)) return null;
    const names = await getNamesOf(m.address);
    if (names.truncated) return null;
    return {
      key,
      parts: [text('How many names does '), memberPart(m), text(' own?')],
      answer: { kind: 'number', value: String(names.names.length) },
      placeholder: 'A number',
      hint: 'An account has a tab just for its names.',
      how: 'The Names tab lists every name the account owns now (and, under them, the names it had).',
      link: accountLink(m.address, 'names'),
      linkLabel: 'Open its Names',
    };
  },
};

const groupsCount: QuizTemplate = {
  id: 'groupsCount',
  level: 'easy',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `groupsCount:${m.address}`;
    if (ctx.seen(key)) return null;
    const groups = await getGroupsOf(m.address);
    // MINTER alone makes a dull answer.
    if (groups.length < 2) return null;
    return {
      key,
      parts: [text('How many groups is '), memberPart(m), text(' a member of?')],
      answer: { kind: 'number', value: String(groups.length) },
      placeholder: 'A number',
      hint: 'Overview → At a glance counts them; the Groups section lists them.',
      how: 'Overview → At a glance → Groups counts the groups it is in, MINTER included.',
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
    };
  },
};

const paymentInBlock: QuizTemplate = {
  id: 'paymentInBlock',
  level: 'easy',
  async make(ctx) {
    const found = await randomRows(ctx, ['PAYMENT'], 1000, 1_000_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const to = str(tx.recipient);
    const amount = str(tx.amount);
    // A person paid, not a trade contract (an AT).
    if (!tx.creatorAddress || !to?.startsWith('Q') || !amount || typeof tx.blockHeight !== 'number')
      return null;
    const key = `payment:${tx.signature}`;
    if (ctx.seen(key)) return null;
    // One payment between them in that block, or the question has two answers.
    const same = (await searchRange(['PAYMENT'], tx.blockHeight, 1)).filter(
      (row) => row.creatorAddress === tx.creatorAddress && row.recipient === to
    );
    if (same.length !== 1) return null;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight),
        text(', '),
        await account(tx.creatorAddress),
        text(' paid '),
        await account(to),
        text('. How much QORT?'),
      ],
      answer: { kind: 'number', value: amount, unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Transactions on Qortal can show just one block.',
      how: 'Transactions on Qortal → Payment → From a block, “Just this block”, lists every payment in it; the payer’s Transactions tab has it too.',
      link: globalLink('PAYMENT', tx.blockHeight, 1),
      linkLabel: 'Show that block’s payments',
    };
  },
};

// ---- medium --------------------------------------------------------------------------

const kickedBy: QuizTemplate = {
  id: 'kickedBy',
  level: 'medium',
  async make(ctx) {
    const found = await randomRows(ctx, ['GROUP_KICK'], 10_000, 500_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const member = str(tx.member);
    if (!member || !tx.creatorAddress || typeof tx.groupId !== 'number' || !tx.blockHeight)
      return null;
    const key = `kick:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const group = await getGroupLabel(tx.groupId).catch(() => null);
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight),
        text(', '),
        await account(member),
        text(' was removed from the group '),
        { kind: 'group', id: tx.groupId, name: group?.name ?? null },
        text('. Who removed it?'),
      ],
      answer: await answerAccount(tx.creatorAddress),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Transactions on Qortal has a type for removals from a group, and can look at one block.',
      how: 'Transactions on Qortal → Removal from a group → From a block, “Just this block”: the row says who removed whom, and from which group.',
      link: globalLink('GROUP_KICK', tx.blockHeight, 1),
      linkLabel: 'Show that block’s removals',
    };
  },
};

const blockCount: QuizTemplate = {
  id: 'blockCount',
  level: 'medium',
  async make(ctx) {
    const found = await randomRows(
      ctx,
      ['PAYMENT', 'REGISTER_NAME', 'ARBITRARY', 'REWARD_SHARE', 'JOIN_GROUP'],
      1000,
      100_000
    );
    if (!found) return null;
    const height = pick(ctx.rng, found.rows).blockHeight;
    if (typeof height !== 'number') return null;
    const key = `blockCount:${height}`;
    if (ctx.seen(key)) return null;
    // Transactions on Qortal's All: every type but messages.
    const messages = new Set(typesFor('messages'));
    const rows = await wholeRange(
      ALL_TX_TYPES.filter((type) => !messages.has(type)),
      height,
      1
    );
    if (!rows || rows.length < 2) return null;
    return {
      key,
      parts: [
        text('How many transactions, not counting messages, are in '),
        block(height),
        text('?'),
      ],
      answer: { kind: 'number', value: String(rows.length) },
      placeholder: 'A number',
      hint: 'Transactions on Qortal: every type, one block.',
      how: 'Transactions on Qortal → All types → From a block, “Just this block”: the line under the list counts them (messages are never listed there).',
      link: globalLink('all', height, 1, { order: 'oldest' }),
      linkLabel: 'Show that block',
    };
  },
};

const namesInBlocks: QuizTemplate = {
  id: 'namesInBlocks',
  level: 'medium',
  async make(ctx) {
    let start = 0;
    let rows: TxRow[] | null = null;
    for (let i = 0; i < 3 && !(rows && rows.length >= 2); i += 1) {
      start = randInt(ctx.rng, 200_000, ctx.tip - 100);
      rows = await wholeRange(['REGISTER_NAME'], start, 100);
    }
    const key = `namesIn:${start}`;
    if (!rows || rows.length < 2 || ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('How many names were registered in the 100 blocks from '),
        block(start),
        text(' to '),
        block(start + 99),
        text('?'),
      ],
      answer: { kind: 'number', value: String(rows.length) },
      placeholder: 'A number',
      hint: 'Transactions on Qortal can show a type over 100 blocks from a block.',
      how: 'Transactions on Qortal → Name registration → From a block, “100 blocks”: the line under the list counts them once all are shown.',
      link: globalLink('REGISTER_NAME', start, 100),
      linkLabel: 'Show those blocks',
    };
  },
};

const firstQortFrom: QuizTemplate = {
  id: 'firstQortFrom',
  level: 'medium',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstQort:${m.address}`;
    if (ctx.seen(key)) return null;
    const seen = await getFirstSeen(m.address);
    const funding = seen.funding;
    if (!funding?.from || (funding.kind !== 'payment' && funding.kind !== 'multiPayment'))
      return null;
    if (!isAddress(funding.from)) return null;
    return {
      key,
      parts: [text('Which account sent '), memberPart(m), text(' its very first QORT payment?')],
      answer: await answerAccount(funding.from),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Connections → In common says where its first QORT came from.',
      how: 'Connections → In common: “First QORT payment received: … from …”.',
      link: accountLink(m.address, 'connections'),
      linkLabel: 'Open its Connections',
    };
  },
};

const sponsor: QuizTemplate = {
  id: 'sponsor',
  level: 'medium',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `sponsor:${m.address}`;
    if (ctx.seen(key)) return null;
    const found = await getCoreSponsor(m.address);
    if (!found || found === m.address) return null;
    return {
      key,
      parts: [
        text('Who sponsored '),
        memberPart(m),
        text('? If more than one account did, the one Core counts.'),
      ],
      answer: await answerAccount(found),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Sponsors are in Connections, under Reward shares.',
      how: 'Connections → Reward shares: “Sponsored by …”. When several accounts sponsored it, the one Core counts is marked “the sponsor Core counts”.',
      link: accountLink(m.address, 'connections'),
      linkLabel: 'Open its Connections',
    };
  },
};

/** A name bought in a random stretch: what it cost, or who sold it. */
async function nameSale(ctx: QuizContext): Promise<TxRow | null> {
  const found = await randomRows(ctx, ['BUY_NAME'], 10_000, 300_000);
  if (!found) return null;
  const tx = pick(ctx.rng, found.rows);
  return str(tx.name) && str(tx.amount) && tx.creatorAddress && isAddress(tx.seller) ? tx : null;
}

const namePrice: QuizTemplate = {
  id: 'namePrice',
  level: 'medium',
  async make(ctx) {
    const tx = await nameSale(ctx);
    if (!tx) return null;
    const key = `namePrice:${tx.signature}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight as number),
        text(', '),
        await account(tx.creatorAddress as string),
        text(' bought the name '),
        nameP(tx.name as string),
        text('. How much QORT did it pay?'),
      ],
      answer: { kind: 'number', value: tx.amount as string, unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Name purchases are a type of their own in Transactions on Qortal; the buyer’s Connections lists them too.',
      how: 'Transactions on Qortal → Name purchase at that block, or the buyer’s Connections → Names: “Bought … from … for … QORT”.',
      link: globalLink('BUY_NAME', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s name purchases',
    };
  },
};

const nameSeller: QuizTemplate = {
  id: 'nameSeller',
  level: 'medium',
  async make(ctx) {
    const tx = await nameSale(ctx);
    if (!tx) return null;
    const key = `nameSeller:${tx.signature}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('Who sold the name '),
        nameP(tx.name as string),
        text(' to '),
        await account(tx.creatorAddress as string),
        text('?'),
      ],
      answer: await answerAccount(tx.seller as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Look at the buyer’s connections, or the name’s history.',
      how: 'The buyer’s Connections → Names says who sold it; the Names tab shows each name’s history too.',
      link: accountLink(tx.creatorAddress as string, 'connections'),
      linkLabel: 'Open the buyer’s Connections',
    };
  },
};

const adminGroups: QuizTemplate = {
  id: 'adminGroups',
  level: 'medium',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `adminGroups:${m.address}`;
    if (ctx.seen(key)) return null;
    const groups = await getGroupsOf(m.address);
    const admin = groups.filter((g) => g.isAdmin).length;
    if (groups.length < 3 || admin < 1) return null;
    return {
      key,
      parts: [
        text('Of the groups '),
        memberPart(m),
        text(' is in, how many is it an admin of (owner included)?'),
      ],
      answer: { kind: 'number', value: String(admin) },
      placeholder: 'A number',
      hint: 'Overview → Groups marks Owner and Admin, and can sort by role.',
      how: 'Overview → Groups: each group it owns or runs carries an Owner or Admin mark; “Sort” by role puts them first.',
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
    };
  },
};

const renamedTo: QuizTemplate = {
  id: 'renamedTo',
  level: 'medium',
  async make(ctx) {
    const found = await randomRows(ctx, ['UPDATE_NAME'], 10_000, 300_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const old = str(tx.name);
    const renamed = str(tx.newName);
    if (!old || !renamed || old === renamed || !tx.blockHeight) return null;
    const key = `renamed:${tx.signature}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight),
        text(', the name '),
        nameP(old),
        text(' was renamed. What is it called now?'),
      ],
      answer: { kind: 'text', accepted: [renamed], shown: renamed },
      placeholder: 'A name',
      hint: 'Transactions on Qortal has a type for name updates.',
      how: 'Transactions on Qortal → Name update at that block: “renamed … to …”.',
      link: globalLink('UPDATE_NAME', tx.blockHeight, 1),
      linkLabel: 'Show that block’s name updates',
    };
  },
};

const groupCreator: QuizTemplate = {
  id: 'groupCreator',
  level: 'medium',
  async make(ctx) {
    const found = await randomRows(ctx, ['CREATE_GROUP'], 10_000, 100_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const groupName = str(tx.groupName);
    if (!groupName || !tx.creatorAddress || !tx.blockHeight) return null;
    const key = `groupCreator:${tx.signature}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('Who created the group '),
        nameP(groupName),
        text(', in '),
        block(tx.blockHeight),
        text('?'),
      ],
      answer: await answerAccount(tx.creatorAddress),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Transactions on Qortal has a type for groups created; “Only rows with” finds a group by its name.',
      how: 'Transactions on Qortal → Group created at that block: “… created the group …”.',
      link: globalLink('CREATE_GROUP', tx.blockHeight, 1),
      linkLabel: 'Show that block’s new groups',
    };
  },
};

// ---- tricky --------------------------------------------------------------------------

const nthSelfShare: QuizTemplate = {
  id: 'nthSelfShare',
  level: 'tricky',
  async make(ctx) {
    // Block 2 is where minting began: its self shares make a fine question too.
    const start = ctx.rng() < 0.25 ? 1 : randInt(ctx.rng, 3, ctx.tip - 1000);
    const span = start === 1 ? 10 : 1000;
    // The nth from the start needs only the first rows: two pages at most.
    const rows = await searchRange(['REWARD_SHARE'], start, span);
    if (rows.length === 20) rows.push(...(await searchRange(['REWARD_SHARE'], start, span, 20)));
    const self = rows.filter(
      (row) =>
        row.creatorAddress && row.creatorAddress === row.recipient && Number(row.sharePercent) >= 0
    );
    if (self.length < 3) return null;
    const nth = randInt(ctx.rng, 2, Math.min(self.length, ORDINALS.length));
    const tx = self[nth - 1];
    const key = `nthSelf:${start}:${nth}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text(
          `Which account made the ${ORDINALS[nth - 1]} self share (an account starting to mint on its own) in the ${count(span)} blocks from `
        ),
        block(start),
        text('?'),
      ],
      answer: await answerAccount(tx.creatorAddress as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Oldest first, and reward shares can be narrowed to self shares.',
      how: `Transactions on Qortal → Reward share → From a block (${count(span)} blocks), Oldest first, Reward share kind “Self shares”: count down the list.`,
      link: globalLink('REWARD_SHARE', start, span as 10 | 1000, {
        order: 'oldest',
        share: 'self',
      }),
      linkLabel: 'Show those self shares',
    };
  },
};

const sponsorOfSponsor: QuizTemplate = {
  id: 'sponsorOfSponsor',
  level: 'tricky',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `sponsor2:${m.address}`;
    if (ctx.seen(key)) return null;
    const first = await getCoreSponsor(m.address);
    if (!first || first === m.address) return null;
    const second = await getCoreSponsor(first);
    if (!second || second === first || second === m.address) return null;
    return {
      key,
      parts: [text('Who sponsored the account that sponsored '), memberPart(m), text('?')],
      answer: await answerAccount(second),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Two steps: find its sponsor, then that account’s sponsor (Core’s count when there are several).',
      how: 'Connections → Reward shares names its sponsor; open that account, and its Connections names the next one.',
      link: accountLink(m.address, 'connections'),
      linkLabel: 'Open its Connections',
    };
  },
};

const levelMoveFrom: QuizTemplate = {
  id: 'levelMoveFrom',
  level: 'tricky',
  async make(ctx) {
    const found = await randomRows(ctx, ['TRANSFER_PRIVS'], 50_000, 900_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    if (!tx.creatorAddress) return null;
    const key = `privs:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const to = await getPrivsRecipient(tx.signature);
    if (!to || to === tx.creatorAddress) return null;
    return {
      key,
      parts: [await account(to), text(' got its minting level from another account. Which one?')],
      answer: await answerAccount(tx.creatorAddress),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Minting level moves are recorded between the two accounts.',
      how: 'Connections → “Got its minting level from …” (the Explorer reads the recipient from the transaction’s raw bytes, since Core’s JSON leaves it out).',
      link: accountLink(to, 'connections'),
      linkLabel: 'Open its Connections',
    };
  },
};

const firstOwnType: QuizTemplate = {
  id: 'firstOwnType',
  level: 'tricky',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstOwn:${m.address}`;
    if (ctx.seen(key)) return null;
    const seen = await getFirstSeen(m.address);
    const own = seen.firstOwn;
    if (!own) return null;
    const label = txTypeLabel(own.type);
    return {
      key,
      parts: [
        text('What type was the very first transaction '),
        memberPart(m),
        text(' made itself (not one it received)?'),
      ],
      answer: {
        kind: 'text',
        accepted: [label, own.type, own.type.replace(/_/g, ' ')],
        shown: `${label} (${own.type})`,
      },
      placeholder: 'A type, like Payment',
      hint: 'Its Transactions tab can list oldest first; skip what it received.',
      how: `Transactions tab, Oldest first: the first row it made itself was a ${label.toLowerCase()} in block ${count(own.height)}.`,
      link: explorerTxPath(own.signature),
      linkLabel: 'Open that transaction',
    };
  },
};

const multiPaymentCount: QuizTemplate = {
  id: 'multiPaymentCount',
  level: 'tricky',
  async make(ctx) {
    const found = await randomRows(ctx, ['MULTI_PAYMENT'], 200_000, 100_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const payments = Array.isArray(tx.payments) ? tx.payments : [];
    if (payments.length < 2 || !tx.creatorAddress || !tx.blockHeight) return null;
    const key = `multi:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const same = (await searchRange(['MULTI_PAYMENT'], tx.blockHeight, 1)).filter(
      (row) => row.creatorAddress === tx.creatorAddress
    );
    if (same.length !== 1) return null;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight),
        text(', '),
        await account(tx.creatorAddress),
        text(' sent a multi-payment. How many payments did it hold?'),
      ],
      answer: { kind: 'number', value: String(payments.length) },
      placeholder: 'A number',
      hint: 'Find the multi-payment, then open the transaction itself.',
      how: 'Transactions on Qortal → Multi-payment at that block; its own page lists every payment in Details.',
      link: explorerTxPath(tx.signature),
      linkLabel: 'Open that multi-payment',
    };
  },
};

/** QORT `from` paid `to` in PAYMENTs (fewer than 100 sent in all), or null. */
async function paidBetween(
  from: string,
  to: string
): Promise<{ total: string; count: number } | null> {
  const sent = await getJson<TxRow[]>(
    `/transactions/payments/between?${query({ senderAddress: from, confirmationStatus: 'CONFIRMED', limit: 100 })}`
  );
  if (!Array.isArray(sent) || sent.length >= 100) return null;
  // Multi-payments and asset transfers count in Connections too: leave such pairs out.
  const other = await getJson<TxRow[]>(
    `/transactions/search?${query({
      address: from,
      txType: ['MULTI_PAYMENT', 'TRANSFER_ASSET'],
      confirmationStatus: 'CONFIRMED',
      limit: 100,
    })}`
  );
  if (!Array.isArray(other) || other.length >= 100) return null;
  if (other.some((row) => JSON.stringify(row).includes(to))) return null;
  const rows = sent.filter((row) => row.recipient === to && typeof row.amount === 'string');
  if (!rows.length) return null;
  // Exact sums in units of 10⁻⁸.
  const atomic = rows.reduce((sum, row) => {
    const [int, frac = ''] = String(row.amount).split('.');
    return sum + BigInt(int) * 100_000_000n + BigInt((frac + '00000000').slice(0, 8));
  }, 0n);
  const total = `${atomic / 100_000_000n}.${(atomic % 100_000_000n).toString().padStart(8, '0')}`;
  return { total, count: rows.length };
}

const payTotal: QuizTemplate = {
  id: 'payTotal',
  level: 'tricky',
  async make(ctx) {
    const found = await randomRows(ctx, ['PAYMENT'], 10_000, 500_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const to = str(tx.recipient);
    if (!tx.creatorAddress || !to || to === tx.creatorAddress) return null;
    const asTotal = ctx.rng() < 0.5;
    const key = `${asTotal ? 'payTotal' : 'payCount'}:${tx.creatorAddress}:${to}`;
    if (ctx.seen(key)) return null;
    const paid = await paidBetween(tx.creatorAddress, to);
    if (!paid || (!asTotal && paid.count < 2)) return null;
    const from = await account(tx.creatorAddress);
    const target = await account(to);
    return {
      key,
      parts: asTotal
        ? [
            text('How much QORT has '),
            from,
            text(' paid '),
            target,
            text(' in all, over every payment?'),
          ]
        : [text('How many payments has '), from, text(' sent '), target, text('?')],
      answer: asTotal
        ? { kind: 'number', value: paid.total, unit: 'QORT' }
        : { kind: 'number', value: String(paid.count) },
      placeholder: asTotal ? 'An amount of QORT' : 'A number',
      hint: 'Connections groups payments by the other account.',
      how: 'The payer’s Connections → Payments → Sent to: “Paid … QORT in … payments”.',
      link: accountLink(tx.creatorAddress, 'connections'),
      linkLabel: 'Open the payer’s Connections',
    };
  },
};

const latestAtSignature: QuizTemplate = {
  id: 'latestAtSignature',
  level: 'tricky',
  async make(ctx) {
    const found = await randomRows(ctx, ['AT'], 20_000, 200_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    const to = str(tx.recipient);
    if (!to || !isAddress(to) || !to.startsWith('Q')) return null;
    const latest = await getJson<TxRow[]>(
      `/transactions/search?${query({
        address: to,
        txType: 'AT',
        confirmationStatus: 'CONFIRMED',
        limit: 1,
        reverse: true,
      })}`
    );
    const sig = Array.isArray(latest) ? latest[0]?.signature : null;
    if (!sig) return null;
    const key = `latestAt:${to}:${sig}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text(
          'What are the first 8 characters of the signature of the newest AT transaction that paid '
        ),
        await account(to),
        text('?'),
      ],
      answer: { kind: 'prefix', value: sig, min: 8 },
      placeholder: 'The first 8 characters',
      hint: 'An AT (a trade contract) pays the account; the account’s Transactions tab can show only AT transactions.',
      how: 'Its Transactions tab → Trading → AT transaction: open the newest, and its page shows the signature with Copy.',
      link: explorerTxPath(sig),
      linkLabel: 'Open that transaction',
    };
  },
};

const biggestPayInBlock: QuizTemplate = {
  id: 'biggestPayInBlock',
  level: 'tricky',
  async make(ctx) {
    const found = await randomRows(ctx, ['PAYMENT'], 1000, 1_000_000);
    if (!found) return null;
    const height = pick(ctx.rng, found.rows).blockHeight;
    if (typeof height !== 'number') return null;
    const key = `biggestPay:${height}`;
    if (ctx.seen(key)) return null;
    const rows = await wholeRange(['PAYMENT'], height, 1, 1);
    if (!rows || rows.length < 3) return null;
    const sorted = [...rows].sort((a, b) => Number(b.amount) - Number(a.amount));
    if (Number(sorted[0].amount) === Number(sorted[1].amount) || !str(sorted[0].recipient))
      return null;
    return {
      key,
      parts: [
        text(`${count(rows.length)} payments were made in `),
        block(height),
        text('. Which account received the biggest one?'),
      ],
      answer: await answerAccount(sorted[0].recipient as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Show just that block’s payments and compare the amounts.',
      how: 'Transactions on Qortal → Payment → From a block, “Just this block”: the amounts are in bold on each row.',
      link: globalLink('PAYMENT', height, 1),
      linkLabel: 'Show that block’s payments',
    };
  },
};

const groupJoins: QuizTemplate = {
  id: 'groupJoins',
  level: 'tricky',
  async make(ctx) {
    const found = await randomRows(ctx, ['JOIN_GROUP'], 1000, 500_000);
    if (!found) return null;
    const tx = pick(ctx.rng, found.rows);
    if (typeof tx.groupId !== 'number') return null;
    const key = `joins:${found.start}:${tx.groupId}`;
    if (ctx.seen(key)) return null;
    const rows = await wholeRange(['JOIN_GROUP'], found.start, 1000, 5);
    if (!rows) return null;
    const joins = rows.filter((row) => row.groupId === tx.groupId).length;
    if (joins < 2) return null;
    const group = await getGroupLabel(tx.groupId).catch(() => null);
    return {
      key,
      parts: [
        text('How many “Joining a group” transactions for the group '),
        { kind: 'group', id: tx.groupId, name: group?.name ?? null },
        text(' are there in the 1,000 blocks from '),
        block(found.start),
        text('?'),
      ],
      answer: { kind: 'number', value: String(joins) },
      placeholder: 'A number',
      hint: 'Narrow the rows to the group’s number, and look further until all are read.',
      how: `Transactions on Qortal → Joining a group → From a block, “1,000 blocks”, Only rows with “#${tx.groupId}”, then Look further until the list ends.`,
      link: globalLink('JOIN_GROUP', found.start, 1000, { find: `#${tx.groupId}` }),
      linkLabel: 'Show those joins',
    };
  },
};

export const QUIZ_TEMPLATES: readonly QuizTemplate[] = [
  level,
  firstSeenBlock,
  primaryName,
  namesCount,
  groupsCount,
  paymentInBlock,
  kickedBy,
  blockCount,
  namesInBlocks,
  firstQortFrom,
  sponsor,
  namePrice,
  nameSeller,
  adminGroups,
  renamedTo,
  groupCreator,
  nthSelfShare,
  sponsorOfSponsor,
  levelMoveFrom,
  firstOwnType,
  multiPaymentCount,
  payTotal,
  latestAtSignature,
  biggestPayInBlock,
  groupJoins,
];

/** How often each level comes up when any level will do. */
const LEVEL_WEIGHT: Record<QuizLevel, number> = { easy: 0.35, medium: 0.4, tricky: 0.25 };

export interface MakeOptions {
  rng?: Rng;
  /** Only this level; any by default. */
  level?: QuizLevel | null;
  seen?: (key: string) => boolean;
  /** The template asked last: not twice in a row. */
  last?: string | null;
  /** Templates tried at most before giving up. */
  attempts?: number;
  templates?: readonly QuizTemplate[];
}

/**
 * A new question: a level (the one asked for, or by weight), then a
 * template of it at random, until one makes a question. Null when none did
 * (the node is busy or offline); a template that fails is skipped.
 */
export async function makeQuestion(options: MakeOptions = {}): Promise<QuizQuestion | null> {
  const rng = options.rng ?? Math.random;
  const templates = options.templates ?? QUIZ_TEMPLATES;
  const tip = (await getTip()).height;
  const ctx: QuizContext = { rng, tip, seen: options.seen ?? (() => false) };
  const attempts = options.attempts ?? 10;
  for (let i = 0; i < attempts; i += 1) {
    let wanted = options.level ?? null;
    if (!wanted) {
      const roll = rng();
      wanted =
        roll < LEVEL_WEIGHT.easy
          ? 'easy'
          : roll < LEVEL_WEIGHT.easy + LEVEL_WEIGHT.medium
            ? 'medium'
            : 'tricky';
    }
    const pool = templates.filter((t) => t.level === wanted && t.id !== options.last);
    const template = pool.length ? pick(rng, pool) : pick(rng, templates);
    try {
      const made = await template.make(ctx);
      if (made) return { v: 1, template: template.id, level: template.level, tip, ...made };
    } catch {
      // A read failed: try another template.
    }
  }
  return null;
}
