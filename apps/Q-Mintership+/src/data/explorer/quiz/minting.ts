/**
 * Quiz questions from minting's history: who sponsored an account (and
 * that sponsor's sponsor), how many accounts a sponsor sponsored, how long
 * a reward share ran, the nth self share in a stretch of blocks (Qortal's
 * first 10 blocks now and then), how many self shares a stretch held,
 * where a minting level came from, and who sponsored the account it came
 * from. Sponsors are read as Connections reads them (its links search and
 * rules), so "first" means the first one Connections lists, and the first
 * account another account's Transactions tab shows starting a reward share
 * with it, oldest first: viewers without Connections are sent there.
 */
import { getPrivsRecipient } from '../account';
import type { TxRow } from '../../types';
import { ordinal, say } from '../../../rules/explorer/quiz/words';
import {
  ACCOUNT_PLACEHOLDER,
  accountLink,
  accountTxLink,
  answerAccount,
  block,
  blockSubject,
  count,
  day,
  globalLink,
  linksAbout,
  person,
  personP,
  randInt,
  randomMember,
  randomRows,
  searchRange,
  shuffle,
  subjects,
  text,
  where,
  wholeRange,
  type QuizContext,
  type QuizTemplate,
} from './shared';

/** An account's reward shares, oldest first, in its Transactions tab. */
const sharesLink = (address: string) =>
  accountTxLink(address, { kind: 'minting', type: 'REWARD_SHARE', order: 'oldest' });

/** An account's minting level moves in its Transactions tab. */
const movesLink = (address: string) =>
  accountTxLink(address, { kind: 'minting', type: 'TRANSFER_PRIVS' });

/** The first account that sponsored `address`, as Connections lists them (null: none, or capped). */
async function firstSponsor(
  address: string
): Promise<{ sponsor: string; count: number; height: number } | null> {
  const links = await linksAbout(address);
  const first = links?.sponsors[0];
  if (!links || !first) return null;
  // Two sponsors in one block: no clear first.
  if (links.sponsors[1]?.start.height === first.start.height) return null;
  return { sponsor: first.sponsor, count: links.sponsors.length, height: first.start.height };
}

const sponsor: QuizTemplate = {
  id: 'sponsor',
  level: 'medium',
  theme: 'minting',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `sponsor:${m.address}`;
    if (ctx.seen(key)) return null;
    const first = await firstSponsor(m.address);
    if (!first || first.sponsor === m.address) return null;
    return {
      key,
      parts:
        first.count === 1
          ? say(ctx.rng, [
              [text('Who sponsored '), personP(m), text('?')],
              [text('Every minter has a sponsor. Who was '), personP(m), text('’s?')],
            ])
          : [personP(m), text(` had ${count(first.count)} sponsors. Which one came first?`)],
      answer: await answerAccount(first.sponsor),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Sponsors are in Connections, under Reward shares.',
          how: 'Connections → Reward shares: “Sponsored by …”, the earliest first.',
          link: accountLink(m.address, 'connections'),
          linkLabel: 'Open its Connections',
        },
        {
          hint: 'A sponsor starts a reward share with the new minter: its Transactions tab can show just those, oldest first.',
          how: 'Its Transactions tab → Minting → Reward share, Oldest first: the first account that “started a reward share with this account”.',
          link: sharesLink(m.address),
          linkLabel: 'Show its reward shares',
        }
      ),
      fact: `That reward share started in block ${count(first.height)}.`,
      subjects: subjects(m.address, first.sponsor),
    };
  },
};

const sponsorOfSponsor: QuizTemplate = {
  id: 'sponsorOfSponsor',
  level: 'expert',
  theme: 'detective',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `sponsor2:${m.address}`;
    if (ctx.seen(key)) return null;
    const first = await firstSponsor(m.address);
    if (!first || first.sponsor === m.address) return null;
    const second = await firstSponsor(first.sponsor);
    if (!second || second.sponsor === first.sponsor || second.sponsor === m.address) return null;
    const middle = await person(first.sponsor);
    return {
      key,
      parts: [
        text('Sponsor-ception: who sponsored the account that sponsored '),
        personP(m),
        text('? (Each time, the first sponsor.)'),
      ],
      answer: await answerAccount(second.sponsor),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Two steps through Connections → Reward shares.',
          how: 'Its Connections → Reward shares names its sponsor; open that account, and its Connections names the next one.',
          link: accountLink(first.sponsor, 'connections'),
          linkLabel: 'Open the sponsor’s Connections',
        },
        {
          hint: 'Two steps through Transactions tabs: each account’s reward shares, oldest first.',
          how: 'Its Transactions tab → Minting → Reward share, Oldest first: the first account that started a reward share with it is its sponsor. Open that account and do the same.',
          link: sharesLink(first.sponsor),
          linkLabel: 'Show the sponsor’s reward shares',
        }
      ),
      fact: `The middle step: ${middle.name ?? middle.address}.`,
      subjects: subjects(m.address, first.sponsor, second.sponsor),
    };
  },
};

const sponseesCount: QuizTemplate = {
  id: 'sponseesCount',
  level: 'tricky',
  theme: 'minting',
  full: true,
  async make(ctx) {
    const m = await randomMember(ctx);
    const first = await firstSponsor(m.address);
    if (!first || !ctx.fresh(first.sponsor)) return null;
    const key = `sponsees:${first.sponsor}`;
    if (ctx.seen(key)) return null;
    const links = await linksAbout(first.sponsor);
    const n = links?.sponsees.length ?? 0;
    if (!links || n < 2) return null;
    const s = await person(first.sponsor);
    return {
      key,
      parts: say(ctx.rng, [
        [text('How many accounts has '), personP(s), text(' sponsored?')],
        [personP(s), text(' likes to help. How many accounts has it sponsored?')],
      ]),
      answer: { kind: 'number', value: String(n) },
      placeholder: 'A number',
      hint: 'Connections, under Reward shares, counts them.',
      how: 'Its Connections → Reward shares: “Sponsored N accounts”, with a link to the list.',
      fact: `${m.name ?? m.address} is one of them.`,
      link: accountLink(first.sponsor, 'connections'),
      linkLabel: 'Open its Connections',
      live: true,
      args: { address: first.sponsor },
      subjects: subjects(first.sponsor, m.address),
    };
  },
  async recheck(args) {
    const links = await linksAbout(String(args.address), true);
    return links ? { kind: 'number', value: String(links.sponsees.length) } : null;
  },
};

const shareRun: QuizTemplate = {
  id: 'shareRun',
  level: 'tricky',
  theme: 'minting',
  async make(ctx) {
    const m = await randomMember(ctx);
    const links = await linksAbout(m.address);
    // Without Connections's sentence, only a share started once and removed once is clear.
    const ended =
      links?.sponsors.filter(
        (s) => s.blocks !== null && s.removal && (ctx.full || s.txs.length === 2)
      ) ?? [];
    const share = ended[Math.floor(ctx.rng() * ended.length)];
    if (!share || share.sponsor === m.address) return null;
    const key = `shareRun:${m.address}:${share.sponsor}`;
    if (ctx.seen(key)) return null;
    const s = await person(share.sponsor);
    return {
      key,
      parts: [
        personP(s),
        text(' sponsored '),
        personP(m),
        text('. For how many blocks did that reward share run before it was removed?'),
      ],
      answer: { kind: 'number', value: String(share.blocks) },
      placeholder: 'A number of blocks',
      ...where(
        ctx,
        {
          hint: 'Connections → Reward shares says how long each sponsor’s share ran.',
          how: 'Connections → Reward shares: “Sponsored by … at … % for N blocks”.',
          link: accountLink(m.address, 'connections'),
          linkLabel: 'Open its Connections',
        },
        {
          hint: 'Its Transactions tab can show just its reward shares: find when that one started and when it was removed.',
          how: 'Its Transactions tab → Minting → Reward share: the block where the sponsor “removed its reward share with this account”, less the block where it “started a reward share with this account”.',
          link: sharesLink(m.address),
          linkLabel: 'Show its reward shares',
        }
      ),
      fact: `From block ${count(share.start.height)} to block ${count(share.removal?.height ?? 0)}.`,
      subjects: subjects(m.address, share.sponsor),
    };
  },
};

const isSelf = (row: TxRow) =>
  Boolean(row.creatorAddress) &&
  row.creatorAddress === row.recipient &&
  Number(row.sharePercent) >= 0;

/** The nth self share (in the Explorer's oldest-first order) of a stretch, for nth in [lo, hi]. */
async function selfShareQuestion(
  ctx: QuizContext,
  lo: number,
  hi: number,
  genesisOdds: number
): Promise<{ key: string; start: number; span: 10 | 1000; nth: number; tx: TxRow } | null> {
  // Qortal's first blocks (block 2 alone holds 19 self shares) come up now and then.
  const genesis = ctx.rng() < genesisOdds;
  const start = genesis ? 1 : randInt(ctx.rng, 3, ctx.tip - 1000);
  const span = genesis ? 10 : 1000;
  if (!ctx.fresh(blockSubject(start))) return null;
  const rows: TxRow[] = [];
  for (let page = 0; page < 3; page += 1) {
    const chunk = await searchRange(['REWARD_SHARE'], start, span, page * 20);
    rows.push(...chunk);
    if (chunk.length < 20 || rows.filter(isSelf).length >= hi) break;
  }
  const self = rows.filter(isSelf);
  if (self.length < lo) return null;
  const nth = randInt(ctx.rng, lo, Math.min(hi, self.length));
  const key = `nthSelf:${start}:${nth}`;
  if (ctx.seen(key)) return null;
  return { key, start, span, nth, tx: self[nth - 1] };
}

function nthSelfShareTemplate(
  id: string,
  level: 'tricky' | 'expert',
  lo: number,
  hi: number,
  genesisOdds: number
): QuizTemplate {
  return {
    id,
    level,
    theme: 'minting',
    async make(ctx) {
      const found = await selfShareQuestion(ctx, lo, hi, genesisOdds);
      if (!found || !found.tx.creatorAddress) return null;
      const { start, span, nth, tx } = found;
      return {
        key: found.key,
        parts: say(ctx.rng, [
          [
            text(
              `Which account made the ${ordinal(nth)} self share (an account starting to mint on its own) in the ${count(span)} blocks from `
            ),
            block(start),
            text('?'),
          ],
          [
            text(`Who made the ${ordinal(nth)} self share in the ${count(span)} blocks from `),
            block(start),
            text('? (A self share: an account starting to mint on its own.)'),
          ],
        ]),
        answer: await answerAccount(tx.creatorAddress as string),
        placeholder: ACCOUNT_PLACEHOLDER,
        hint: 'Oldest first, and reward shares can be narrowed to self shares.',
        how: `Transactions on Qortal → Reward share → From a block (${count(span)} blocks), Oldest first, Reward share kind “Self shares”: count down the list.`,
        fact: `It came in block ${count(tx.blockHeight ?? 0)}, ${day(tx.timestamp)}.`,
        link: globalLink('REWARD_SHARE', start, span, { order: 'oldest', share: 'self' }),
        linkLabel: 'Show those self shares',
        subjects: subjects(tx.creatorAddress, blockSubject(start)),
      };
    },
  };
}

const selfSharesInRange: QuizTemplate = {
  id: 'selfSharesInRange',
  level: 'tricky',
  theme: 'minting',
  async make(ctx) {
    const start = randInt(ctx.rng, 3, ctx.tip - 1000);
    const key = `selfCount:${start}`;
    if (ctx.seen(key) || !ctx.fresh(blockSubject(start))) return null;
    const rows = await wholeRange(['REWARD_SHARE'], start, 1000, 5);
    const n = rows?.filter(isSelf).length ?? 0;
    if (!rows || n < 2) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [
          text(
            'How many accounts started minting on their own (self shares) in the 1,000 blocks from '
          ),
          block(start),
          text('?'),
        ],
        [
          text(
            'Count the self shares (accounts starting to mint on their own) in the 1,000 blocks from '
          ),
          block(start),
          text('.'),
        ],
      ]),
      answer: { kind: 'number', value: String(n) },
      placeholder: 'A number',
      hint: 'Reward shares can be narrowed to self shares; read on until the list ends.',
      how: 'Transactions on Qortal → Reward share → From a block, “1,000 blocks”, Reward share kind “Self shares”, then Look further until the list ends.',
      fact: `Out of ${count(rows.length)} reward share transactions in those blocks.`,
      link: globalLink('REWARD_SHARE', start, 1000, { share: 'self' }),
      linkLabel: 'Show those self shares',
      subjects: [blockSubject(start)],
    };
  },
};

const block2Party: QuizTemplate = {
  id: 'block2Party',
  level: 'medium',
  theme: 'history',
  async make(ctx) {
    const key = 'block2party';
    if (ctx.seen(key)) return null;
    // Block 1 is the genesis block; block 2 is the first one minted after it.
    const rows = await wholeRange(['REWARD_SHARE'], 2, 1, 3);
    const self = rows?.filter(isSelf) ?? [];
    if (self.length < 2) return null;
    const times = self.map((row) => row.timestamp);
    const minutes = Math.round((Math.max(...times) - Math.min(...times)) / 60_000);
    return {
      key,
      parts: [
        text('Right after the genesis block came '),
        block(2),
        text('. How many accounts started minting on their own (a self share) in it?'),
      ],
      answer: { kind: 'number', value: String(self.length) },
      placeholder: 'A number',
      hint: 'Transactions on Qortal can show one block, and only its self shares.',
      how: 'Transactions on Qortal → Reward share → From block 2, “Just this block”, Reward share kind “Self shares”.',
      fact: `All of them within ${count(minutes)} minutes, ${day(Math.min(...times))}.`,
      link: globalLink('REWARD_SHARE', 2, 1, { order: 'oldest', share: 'self' }),
      linkLabel: 'Show block 2',
      subjects: [blockSubject(2)],
    };
  },
};

/** A minting level moved in a random stretch: who moved it, and to whom. */
async function levelMove(
  ctx: QuizContext
): Promise<{ from: string; to: string; tx: TxRow } | null> {
  const found = await randomRows(ctx, ['TRANSFER_PRIVS'], 50_000, 900_000);
  if (!found) return null;
  let fallback: { from: string; to: string; tx: TxRow } | null = null;
  // A recipient with a name reads better: try a few.
  for (const tx of shuffle(ctx.rng, found.rows).slice(0, 4)) {
    if (!tx.creatorAddress || !ctx.fresh(tx.creatorAddress)) continue;
    const to = await getPrivsRecipient(tx.signature);
    if (!to || to === tx.creatorAddress || !ctx.fresh(to)) continue;
    const move = { from: tx.creatorAddress, to, tx };
    if ((await person(to)).name) return move;
    fallback ??= move;
  }
  return fallback;
}

const levelMoveFrom: QuizTemplate = {
  id: 'levelMoveFrom',
  level: 'tricky',
  theme: 'minting',
  async make(ctx) {
    const move = await levelMove(ctx);
    if (!move) return null;
    const key = `privs:${move.tx.signature}`;
    if (ctx.seen(key)) return null;
    const to = await person(move.to);
    return {
      key,
      parts: say(ctx.rng, [
        [personP(to), text(' got its minting level from another account. Which one?')],
        [personP(to), text(' inherited its minting level. From whom?')],
      ]),
      answer: await answerAccount(move.from),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Minting level moves are recorded between the two accounts.',
          how: 'Connections → “Got its minting level from …” (the Explorer reads the recipient from the transaction’s raw bytes, since Core’s JSON leaves it out).',
          link: accountLink(move.to, 'connections'),
          linkLabel: 'Open its Connections',
        },
        {
          hint: 'Minting level moves are recorded between the two accounts: its Transactions tab can show just those.',
          how: 'Its Transactions tab → Minting → Minting level move: “Got its minting level from …” (the Explorer reads the recipient from the transaction’s raw bytes, since Core’s JSON leaves it out).',
          link: movesLink(move.to),
          linkLabel: 'Show its minting level moves',
        }
      ),
      fact: `Moved in block ${count(move.tx.blockHeight ?? 0)}, ${day(move.tx.timestamp)}.`,
      subjects: subjects(move.to, move.from),
    };
  },
};

const levelMoveThenSponsor: QuizTemplate = {
  id: 'levelMoveThenSponsor',
  level: 'expert',
  theme: 'detective',
  async make(ctx) {
    const move = await levelMove(ctx);
    if (!move) return null;
    const key = `privsSponsor:${move.tx.signature}`;
    if (ctx.seen(key)) return null;
    const first = await firstSponsor(move.from);
    if (!first || first.sponsor === move.from || first.sponsor === move.to) return null;
    const to = await person(move.to);
    const from = await person(move.from);
    return {
      key,
      parts: [
        personP(to),
        text(
          ' got its minting level from another account. Who sponsored that account (its first sponsor)?'
        ),
      ],
      answer: await answerAccount(first.sponsor),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Two steps through Connections: where its level came from, then that account’s sponsor.',
          how: 'Its Connections names who its level came from; that account’s Connections → Reward shares names its sponsor.',
          link: accountLink(move.from, 'connections'),
          linkLabel: 'Open the giver’s Connections',
        },
        {
          hint: 'Two steps through Transactions tabs: where its level came from, then the first reward share another account started with that one.',
          how: 'Its Transactions tab → Minting → Minting level move names who its level came from; that account’s Transactions tab → Minting → Reward share, Oldest first: the first account that started a reward share with it.',
          link: sharesLink(move.from),
          linkLabel: 'Show the giver’s reward shares',
        }
      ),
      fact: `The level came from ${from.name ?? from.address}.`,
      subjects: subjects(move.to, move.from, first.sponsor),
    };
  },
};

export const MINTING_TEMPLATES: readonly QuizTemplate[] = [
  sponsor,
  sponsorOfSponsor,
  sponseesCount,
  shareRun,
  nthSelfShareTemplate('nthSelfShare', 'tricky', 2, 7, 0.25),
  nthSelfShareTemplate('nthSelfShareDeep', 'expert', 8, 19, 0.6),
  selfSharesInRange,
  block2Party,
  levelMoveFrom,
  levelMoveThenSponsor,
];
